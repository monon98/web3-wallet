import { getAddress, isAddress } from 'viem';

import { MemoryTtlCache } from '../balances/memoryTtlCache.js';
import { getEtherscanApiKey, getEtherscanApiUrl } from '../config/chain.js';

export class EtherscanError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'EtherscanError';
  }
}

/** 与 Etherscan `balance` 单次请求一致 @see https://docs.etherscan.io/api-reference/endpoint/balance */
export const ETHERSCAN_MAX_BALANCE_ADDRESSES = 20;

/** 网络失败 / 限流后的冷却时间，避免每个请求都等 30s 超时。 */
const ETHERSCAN_COOLDOWN_MS = 60_000;
let etherscanCooldownUntil = 0;

export function isEtherscanCoolingDown(now = Date.now()): boolean {
  return now < etherscanCooldownUntil;
}

export function getEtherscanCooldownRemainingMs(now = Date.now()): number {
  return Math.max(0, etherscanCooldownUntil - now);
}

export function markEtherscanUnavailable(
  durationMs = ETHERSCAN_COOLDOWN_MS
): void {
  etherscanCooldownUntil = Date.now() + Math.max(0, durationMs);
}

/**
 * 判断是否为网络 / 限流类失败；这类失败统一进入冷却，并允许使用 stale 缓存。
 */
export function isEtherscanNetworkFailure(error: unknown): boolean {
  if (error instanceof EtherscanError) {
    return (
      error.message === 'etherscan_unreachable' ||
      error.message === 'etherscan_http_error' ||
      error.message === 'etherscan_rate_limited' ||
      error.statusCode === 429
    );
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === 'TimeoutError' ||
    error.name === 'AbortError' ||
    error.message.includes('fetch failed')
  );
}

export type EtherscanNativeBalanceResult = {
  chainId: number;
  address: `0x${string}`;
  /** 原生币余额，wei 十进制字符串（与 Etherscan result 一致） */
  balanceWei: string;
};

export type EtherscanTokenHolding = {
  tokenAddress: `0x${string}`;
  tokenName: string;
  tokenSymbol: string;
  /** 原始数量字符串（未除 divisor） */
  tokenQuantity: string;
  tokenDivisor: string;
  tokenPriceUsd?: string;
};

export type EtherscanAddressTokenHoldingsResult = {
  chainId: number;
  address: `0x${string}`;
  tokens: EtherscanTokenHolding[];
  /** Etherscan 非 OK 时的人类可读原因（不含 api key） */
  error?: string;
  /** 是否来自服务端缓存 */
  cached?: boolean;
  /** 上游失败时回退到过期缓存 */
  stale?: boolean;
  /** 缓存写入时间（ISO） */
  cachedAt?: string;
  /** 冷却 / 限流建议等待时间 */
  retryAfterMs?: number;
};

type EtherscanRawEnvelope = {
  status?: string;
  message?: string;
  result?: unknown;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function proEndpointMinIntervalMs(): number {
  const raw = process.env.ETHERSCAN_PRO_MIN_INTERVAL_MS?.trim();
  if (raw === undefined || raw === '') {
    return 550;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 550;
}

function parseNonNegativeInt(
  raw: string | undefined,
  fallback: number
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function tokenCacheOptions(): { ttlMs: number; staleTtlMs: number } {
  const ttlMs = parseNonNegativeInt(
    process.env.ETHERSCAN_TOKEN_CACHE_TTL_MS,
    60_000
  );
  const staleTtlMs = Math.max(
    ttlMs,
    parseNonNegativeInt(process.env.ETHERSCAN_TOKEN_STALE_TTL_MS, 1_800_000)
  );
  return { ttlMs, staleTtlMs };
}

export function getEtherscanTokenCacheTtlMs(): number {
  return tokenCacheOptions().ttlMs;
}

export function getEtherscanTokenCacheStaleTtlMs(): number {
  return tokenCacheOptions().staleTtlMs;
}

const tokenCache = new MemoryTtlCache<EtherscanTokenHolding[]>({
  maxEntries: 5_000
});

function buildTokenCacheKey(params: {
  chainId: number;
  address: string;
  page: number;
  offset: number;
}): string {
  return `${params.chainId}:${params.address}:${params.page}:${params.offset}`;
}

function tokenResultFromCache(params: {
  chainId: number;
  address: `0x${string}`;
  cache: { value: EtherscanTokenHolding[]; storedAt: number; stale: boolean };
  error?: string;
  retryAfterMs?: number;
}): EtherscanAddressTokenHoldingsResult {
  return {
    chainId: params.chainId,
    address: params.address,
    tokens: params.cache.value,
    cached: true,
    stale: params.cache.stale || undefined,
    cachedAt: new Date(params.cache.storedAt).toISOString(),
    ...(params.error ? { error: params.error } : {}),
    ...(params.retryAfterMs !== undefined
      ? { retryAfterMs: params.retryAfterMs }
      : {})
  };
}

function isRateLimitMessage(message: string | undefined): boolean {
  const m = (message ?? '').toLowerCase();
  return m.includes('rate') || m.includes('limit') || m.includes('max rate');
}

async function etherscanGet(
  query: Record<string, string>
): Promise<EtherscanRawEnvelope> {
  const apiKey = getEtherscanApiKey();
  if (!apiKey) {
    throw new EtherscanError('etherscan_not_configured', 503);
  }

  const base = getEtherscanApiUrl().replace(/\/$/, '');
  const search = new URLSearchParams({ ...query, apikey: apiKey });

  let res: Response;
  try {
    res = await fetch(`${base}?${search.toString()}`, {
      method: 'GET',
      signal: AbortSignal.timeout(30_000)
    });
  } catch {
    throw new EtherscanError('etherscan_unreachable', 502);
  }

  if (!res.ok) {
    throw new EtherscanError(
      res.status === 429 ? 'etherscan_rate_limited' : 'etherscan_http_error',
      res.status === 429 ? 429 : 502
    );
  }

  let raw: EtherscanRawEnvelope;
  try {
    raw = (await res.json()) as EtherscanRawEnvelope;
  } catch {
    throw new EtherscanError('invalid_etherscan_result', 502);
  }

  return raw;
}

function statusToHttpHint(message: string | undefined): number {
  const m = (message ?? '').toLowerCase();
  if (m.includes('rate') || m.includes('limit') || m.includes('max rate')) {
    return 429;
  }
  return 502;
}

/**
 * Etherscan API V2：最多 20 个地址的原生币余额（逗号分隔请求与响应）。
 * @see https://docs.etherscan.io/api-reference/endpoint/balance
 */
export async function getNativeBalancesBatchEtherscan(params: {
  chainId: number;
  addresses: string[];
}): Promise<EtherscanNativeBalanceResult[]> {
  if (!Number.isInteger(params.chainId) || params.chainId <= 0) {
    throw new EtherscanError('invalid_chainId', 400);
  }

  if (params.addresses.length === 0) {
    throw new EtherscanError('addresses_empty', 400);
  }

  if (params.addresses.length > ETHERSCAN_MAX_BALANCE_ADDRESSES) {
    throw new EtherscanError(
      `addresses_max_${ETHERSCAN_MAX_BALANCE_ADDRESSES}`,
      400
    );
  }

  const normalized: `0x${string}`[] = [];
  for (const a of params.addresses) {
    if (!isAddress(a)) {
      throw new EtherscanError('invalid_address', 400);
    }
    normalized.push(getAddress(a));
  }

  const raw = await etherscanGet({
    chainid: String(params.chainId),
    module: 'account',
    action: 'balance',
    address: normalized.join(','),
    tag: 'latest'
  });

  if (raw.status !== '1' || raw.result === undefined) {
    const hint = raw.message ?? 'etherscan_error';
    throw new EtherscanError(hint, statusToHttpHint(raw.message));
  }

  if (typeof raw.result !== 'string') {
    throw new EtherscanError('invalid_etherscan_result', 502);
  }

  const parts = raw.result.split(',');
  if (parts.length !== normalized.length) {
    throw new EtherscanError('etherscan_balance_count_mismatch', 502);
  }

  const out: EtherscanNativeBalanceResult[] = [];
  for (let i = 0; i < normalized.length; i += 1) {
    const balanceWei = parts[i]?.trim() ?? '';
    if (!/^\d+$/.test(balanceWei)) {
      throw new EtherscanError('invalid_etherscan_result', 502);
    }
    out.push({
      chainId: params.chainId,
      address: normalized[i]!,
      balanceWei
    });
  }

  return out;
}

/**
 * 单地址原生币余额（内部走批量接口）。
 * @see https://docs.etherscan.io/api-reference/endpoint/balance
 */
export async function getNativeBalanceEtherscan(params: {
  chainId: number;
  address: string;
}): Promise<EtherscanNativeBalanceResult> {
  const list = await getNativeBalancesBatchEtherscan({
    chainId: params.chainId,
    addresses: [params.address]
  });
  return list[0]!;
}

function parseTokenRow(
  row: Record<string, unknown>
): EtherscanTokenHolding | null {
  const addrRaw = row.TokenAddress;
  if (typeof addrRaw !== 'string' || !isAddress(addrRaw)) {
    return null;
  }
  const tokenAddress = getAddress(addrRaw);
  const tokenName = typeof row.TokenName === 'string' ? row.TokenName : '';
  const tokenSymbol =
    typeof row.TokenSymbol === 'string' ? row.TokenSymbol : '';
  const tokenQuantity =
    typeof row.TokenQuantity === 'string' ? row.TokenQuantity : '';
  const tokenDivisor =
    typeof row.TokenDivisor === 'string' ? row.TokenDivisor : '';
  const tokenPriceUsd =
    typeof row.TokenPriceUSD === 'string' ? row.TokenPriceUSD : undefined;
  return {
    tokenAddress,
    tokenName,
    tokenSymbol,
    tokenQuantity,
    tokenDivisor,
    tokenPriceUsd
  };
}

/**
 * 单地址 ERC-20 持仓（分页）。PRO 端点，供应商侧约 2 次/秒限流。
 *
 * 缓存策略：新鲜期内直接返回；上游网络 / 限流失败时，在过期保留期内回退旧数据
 * 并标记 `stale`，同时给出可操作的错误原因与等待时间。
 * @see https://docs.etherscan.io/api-reference/endpoint/addresstokenbalance
 */
export async function getAddressTokenHoldingsEtherscan(params: {
  chainId: number;
  address: string;
  page: number;
  offset: number;
}): Promise<EtherscanAddressTokenHoldingsResult> {
  if (!Number.isInteger(params.chainId) || params.chainId <= 0) {
    throw new EtherscanError('invalid_chainId', 400);
  }

  if (!isAddress(params.address)) {
    throw new EtherscanError('invalid_address', 400);
  }

  const address = getAddress(params.address);
  const cacheKey = buildTokenCacheKey({
    chainId: params.chainId,
    address,
    page: params.page,
    offset: params.offset
  });
  const cached = tokenCache.get(cacheKey);

  if (cached && !cached.stale) {
    return tokenResultFromCache({
      chainId: params.chainId,
      address,
      cache: cached
    });
  }

  if (isEtherscanCoolingDown()) {
    const retryAfterMs = getEtherscanCooldownRemainingMs();
    if (cached) {
      return tokenResultFromCache({
        chainId: params.chainId,
        address,
        cache: cached,
        error: 'etherscan_unreachable',
        retryAfterMs
      });
    }
    throw new EtherscanError('etherscan_unreachable', 502);
  }

  let raw: EtherscanRawEnvelope;
  try {
    raw = await etherscanGet({
      chainid: String(params.chainId),
      module: 'account',
      action: 'addresstokenbalance',
      address,
      page: String(params.page),
      offset: String(params.offset)
    });
  } catch (e) {
    if (isEtherscanNetworkFailure(e)) {
      markEtherscanUnavailable();
    }
    if (cached) {
      return tokenResultFromCache({
        chainId: params.chainId,
        address,
        cache: cached,
        error:
          e instanceof EtherscanError ? e.message : 'etherscan_unreachable',
        retryAfterMs: getEtherscanCooldownRemainingMs() || undefined
      });
    }
    throw e;
  }

  if (raw.status !== '1') {
    const msg = raw.message ?? 'etherscan_error';
    if (isRateLimitMessage(msg)) {
      markEtherscanUnavailable();
    }
    const retryAfterMs = getEtherscanCooldownRemainingMs();
    if (cached) {
      return tokenResultFromCache({
        chainId: params.chainId,
        address,
        cache: cached,
        error: msg,
        retryAfterMs: retryAfterMs || undefined
      });
    }
    return {
      chainId: params.chainId,
      address,
      tokens: [],
      error: msg,
      ...(retryAfterMs > 0 ? { retryAfterMs } : {})
    };
  }

  if (!Array.isArray(raw.result)) {
    const error = new EtherscanError('invalid_etherscan_result', 502);
    if (cached) {
      return tokenResultFromCache({
        chainId: params.chainId,
        address,
        cache: cached,
        error: error.message
      });
    }
    throw error;
  }

  const tokens: EtherscanTokenHolding[] = [];
  for (const item of raw.result) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const parsed = parseTokenRow(item as Record<string, unknown>);
    if (parsed) {
      tokens.push(parsed);
    }
  }

  tokenCache.set(cacheKey, tokens, tokenCacheOptions());

  return {
    chainId: params.chainId,
    address,
    tokens
  };
}

/**
 * 多地址 ERC-20 持仓：按地址串行请求，间隔 `ETHERSCAN_PRO_MIN_INTERVAL_MS`（默认 550ms）以降低触达 PRO 端 2/s 限流概率。
 * 单地址网络 / 限流失败优先返回 stale 缓存；无缓存时以条目内 `error` 返回，不中断整批。
 */
export async function getAddressTokenHoldingsBatchEtherscan(params: {
  chainId: number;
  addresses: string[];
  page: number;
  offset: number;
}): Promise<EtherscanAddressTokenHoldingsResult[]> {
  if (!Number.isInteger(params.chainId) || params.chainId <= 0) {
    throw new EtherscanError('invalid_chainId', 400);
  }

  if (params.addresses.length === 0) {
    throw new EtherscanError('addresses_empty', 400);
  }

  if (params.addresses.length > ETHERSCAN_MAX_BALANCE_ADDRESSES) {
    throw new EtherscanError(
      `addresses_max_${ETHERSCAN_MAX_BALANCE_ADDRESSES}`,
      400
    );
  }

  for (const a of params.addresses) {
    if (!isAddress(a)) {
      throw new EtherscanError('invalid_address', 400);
    }
  }

  const interval = proEndpointMinIntervalMs();
  const out: EtherscanAddressTokenHoldingsResult[] = [];

  for (let i = 0; i < params.addresses.length; i += 1) {
    if (i > 0 && interval > 0) {
      await sleep(interval);
    }
    const inputAddress = params.addresses[i]!;
    const address = getAddress(inputAddress);
    try {
      out.push(
        await getAddressTokenHoldingsEtherscan({
          chainId: params.chainId,
          address,
          page: params.page,
          offset: params.offset
        })
      );
    } catch (e) {
      if (!(e instanceof EtherscanError)) {
        throw e;
      }
      if (isEtherscanNetworkFailure(e)) {
        markEtherscanUnavailable();
      }
      const retryAfterMs = getEtherscanCooldownRemainingMs();
      out.push({
        chainId: params.chainId,
        address,
        tokens: [],
        error: e.message,
        ...(retryAfterMs > 0 ? { retryAfterMs } : {})
      });
    }
  }

  return out;
}
