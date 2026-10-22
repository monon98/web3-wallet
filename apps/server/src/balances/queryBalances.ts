import { randomUUID } from 'node:crypto';
import {
  BALANCE_FAMILIES,
  type BalanceQueryError,
  type BalanceQueryRequest,
  type BalanceQueryResponse,
  type BtcBalanceResult,
  type EvmBalanceResult,
  type TronBalanceResult
} from '@plugin/shared';
import { getAddress, isAddress } from 'viem';

import { isBtcMainnetAddress } from '../btc/btcAddress.js';
import { getBtcAddressBalancesBatch } from '../btc/esplora.js';
import {
  getAddressTokenHoldingsBatchEtherscan,
  getEtherscanCooldownRemainingMs,
  type EtherscanAddressTokenHoldingsResult
} from '../evm/etherscanV2.js';
import { loadNativeBalances } from '../evm/nativeBalances.js';
import { isTronBase58Address } from '../tron/tronAddress.js';
import { getTronAccountBalancesBatch } from '../tron/tronGrid.js';
import { withBalanceCache } from './balanceCache.js';

/**
 * 统一多链余额查询编排。
 *
 * 调用链：`routes/balances.ts` → 本模块 → EVM（RPC / Etherscan）、TronGrid、Esplora。
 * 三组链并行执行；单组失败写入 `errors`，单地址失败保留在行内 `error`，不阻断其它结果。
 * 缓存与限流由调用方 / `balanceCache` 提供；本模块不记录私钥或待签数据。
 */

export class BalanceQueryServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly detail?: string
  ) {
    super(message);
    this.name = 'BalanceQueryServiceError';
  }
}

type QueryOptions = {
  auth: 'anonymous' | 'session';
};

function uniqueBy<T>(items: T[], keyOf: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normalizeEvmAddresses(addresses: string[]): string[] {
  const normalized = addresses.map((address) => {
    if (!isAddress(address)) {
      throw new BalanceQueryServiceError('invalid_evm_address', 400, address);
    }
    return getAddress(address);
  });
  return uniqueBy(normalized, (address) => address.toLowerCase());
}

function normalizeTronAddresses(addresses: string[]): string[] {
  for (const address of addresses) {
    if (!isTronBase58Address(address)) {
      throw new BalanceQueryServiceError('invalid_tron_address', 400, address);
    }
  }
  return uniqueBy(addresses, (address) => address);
}

function normalizeBtcAddresses(addresses: string[]): string[] {
  for (const address of addresses) {
    if (!isBtcMainnetAddress(address)) {
      throw new BalanceQueryServiceError('invalid_btc_address', 400, address);
    }
  }
  return uniqueBy(addresses, (address) => address);
}

function sortForCache(addresses: string[]): string[] {
  return [...addresses].sort((a, b) => a.localeCompare(b));
}

function tokenFailure(error: unknown): {
  code: string;
  retryAfterMs?: number;
} {
  const code = error instanceof Error ? error.message : 'etherscan_unreachable';
  const retryAfterMs = getEtherscanCooldownRemainingMs();
  return {
    code,
    ...(retryAfterMs > 0 ? { retryAfterMs } : {})
  };
}

async function queryEvm(input: {
  chainId: number;
  addresses: string[];
  includeTokens: boolean;
}): Promise<EvmBalanceResult> {
  const cached = await withBalanceCache(
    ['evm', input.chainId, sortForCache(input.addresses), input.includeTokens],
    async () => {
      const native = await loadNativeBalances({
        chainId: input.chainId,
        addresses: input.addresses
      });

      let tokenRows: EtherscanAddressTokenHoldingsResult[] = [];
      if (input.includeTokens) {
        try {
          tokenRows = await getAddressTokenHoldingsBatchEtherscan({
            chainId: input.chainId,
            addresses: input.addresses,
            page: 1,
            offset: 100
          });
        } catch (error) {
          const failure = tokenFailure(error);
          tokenRows = input.addresses.map((address) => ({
            chainId: input.chainId,
            address: address as `0x${string}`,
            tokens: [],
            error: failure.code,
            ...(failure.retryAfterMs !== undefined
              ? { retryAfterMs: failure.retryAfterMs }
              : {})
          }));
        }
      }

      const tokenByAddress = new Map(
        tokenRows.map((row) => [row.address.toLowerCase(), row])
      );

      const rows = native.rows.map((row) => {
        if (!input.includeTokens) {
          return {
            address: row.address,
            balanceWei: row.balanceWei
          };
        }
        const token = tokenByAddress.get(row.address.toLowerCase());
        return {
          address: row.address,
          balanceWei: row.balanceWei,
          tokens: token?.tokens ?? [],
          ...(token?.error ? { tokenError: token.error } : {}),
          ...(token?.cachedAt ? { tokenCachedAt: token.cachedAt } : {}),
          ...(token?.stale ? { tokenStale: true } : {}),
          ...(token?.retryAfterMs !== undefined
            ? { tokenRetryAfterMs: token.retryAfterMs }
            : {})
        };
      });

      return { source: native.source, rows };
    }
  );

  return {
    chainId: input.chainId,
    source: cached.value.source,
    meta: cached.meta,
    rows: cached.value.rows
  };
}

async function queryTron(input: {
  addresses: string[];
  includeTokens: boolean;
}): Promise<TronBalanceResult> {
  const cached = await withBalanceCache(
    ['tron', sortForCache(input.addresses), input.includeTokens],
    async () => {
      const accounts = await getTronAccountBalancesBatch(input.addresses);
      return input.includeTokens
        ? accounts
        : accounts.map((account) => ({ ...account, trc20: [] }));
    }
  );

  return { meta: cached.meta, accounts: cached.value };
}

async function queryBtc(input: {
  addresses: string[];
}): Promise<BtcBalanceResult> {
  const cached = await withBalanceCache(
    ['btc', sortForCache(input.addresses)],
    () => getBtcAddressBalancesBatch(input.addresses)
  );

  return { meta: cached.meta, addresses: cached.value };
}

function toFamilyError(
  family: (typeof BALANCE_FAMILIES)[number],
  error: unknown
): BalanceQueryError {
  const code = error instanceof Error ? error.message : 'internal_error';
  const retryAfterMs = getEtherscanCooldownRemainingMs();
  return {
    family,
    code,
    message: code,
    ...(family === 'evm' && retryAfterMs > 0 ? { retryAfterMs } : {})
  };
}

/**
 * 执行统一余额查询。地址在进入上游调用前完成格式校验与去重；
 * 上游错误以按链 / 按地址的粒度返回。
 */
export async function runBalanceQuery(
  request: BalanceQueryRequest,
  options: QueryOptions
): Promise<BalanceQueryResponse> {
  const startedAt = Date.now();
  const normalizedEvm = request.evm
    ? {
        ...request.evm,
        addresses: normalizeEvmAddresses(request.evm.addresses)
      }
    : undefined;
  const normalizedTron = request.tron
    ? {
        ...request.tron,
        addresses: normalizeTronAddresses(request.tron.addresses)
      }
    : undefined;
  const normalizedBtc = request.btc
    ? {
        ...request.btc,
        addresses: normalizeBtcAddresses(request.btc.addresses)
      }
    : undefined;

  const errors: BalanceQueryError[] = [];
  let evm: EvmBalanceResult | undefined;
  let tron: TronBalanceResult | undefined;
  let btc: BtcBalanceResult | undefined;

  const jobs: Promise<void>[] = [];
  if (normalizedEvm) {
    jobs.push(
      queryEvm(normalizedEvm)
        .then((result) => {
          evm = result;
        })
        .catch((error: unknown) => {
          errors.push(toFamilyError('evm', error));
        })
    );
  }
  if (normalizedTron) {
    jobs.push(
      queryTron(normalizedTron)
        .then((result) => {
          tron = result;
        })
        .catch((error: unknown) => {
          errors.push(toFamilyError('tron', error));
        })
    );
  }
  if (normalizedBtc) {
    jobs.push(
      queryBtc(normalizedBtc)
        .then((result) => {
          btc = result;
        })
        .catch((error: unknown) => {
          errors.push(toFamilyError('btc', error));
        })
    );
  }

  await Promise.all(jobs);
  errors.sort(
    (a, b) =>
      BALANCE_FAMILIES.indexOf(a.family) - BALANCE_FAMILIES.indexOf(b.family)
  );

  const partial =
    errors.length > 0 ||
    Boolean(evm?.meta.stale) ||
    Boolean(tron?.meta.stale) ||
    Boolean(btc?.meta.stale) ||
    Boolean(evm?.rows.some((row) => row.tokenError)) ||
    Boolean(tron?.accounts.some((account) => account.error)) ||
    Boolean(btc?.addresses.some((address) => address.error));

  return {
    requestId: randomUUID(),
    partial,
    durationMs: Math.max(0, Date.now() - startedAt),
    auth: options.auth,
    ...(evm ? { evm } : {}),
    ...(tron ? { tron } : {}),
    ...(btc ? { btc } : {}),
    errors
  };
}
