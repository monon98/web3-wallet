import { createPublicClient, getAddress, http, isAddress } from 'viem';

import { getServerRpcUrl } from '../config/chain.js';
import { withUpstreamMetrics } from '../observability/metrics.js';

/** 与 `packages/contracts/src/evm/BalanceBatchReader.sol`（`BalanceBatchReader`）对外 view 一致（含原子化方法与组合 `getBalances`） */
export const evmBalanceBatchReaderAbi = [
  {
    type: 'function',
    name: 'getNativeBalances',
    stateMutability: 'view',
    inputs: [{ name: 'accounts', type: 'address[]' }],
    outputs: [{ name: 'balances', type: 'uint256[]' }]
  },
  {
    type: 'function',
    name: 'getErc20Balances',
    stateMutability: 'view',
    inputs: [
      { name: 'accounts', type: 'address[]' },
      { name: 'tokens', type: 'address[]' }
    ],
    outputs: [
      { name: 'balances', type: 'uint256[]' },
      { name: 'ok', type: 'bool[]' }
    ]
  },
  {
    type: 'function',
    name: 'getAllowances',
    stateMutability: 'view',
    inputs: [
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'holders', type: 'address[]' }
    ],
    outputs: [
      { name: 'amounts', type: 'uint256[]' },
      { name: 'ok', type: 'bool[]' }
    ]
  },
  {
    type: 'function',
    name: 'getBalances',
    stateMutability: 'view',
    inputs: [
      { name: 'accounts', type: 'address[]' },
      { name: 'tokens', type: 'address[]' }
    ],
    outputs: [
      { name: 'nativeBalances', type: 'uint256[]' },
      { name: 'tokenBalances', type: 'uint256[]' },
      { name: 'tokenBalanceOk', type: 'bool[]' }
    ]
  }
] as const;

export class BalanceReaderError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'BalanceReaderError';
  }
}

/**
 * `EVM_BALANCE_READER_ADDRESSES_JSON`：形如 `{"1":"0x...","11155111":"0x..."}`（键为十进制 chainId）。
 */
/** 状态接口用：是否存在至少一条合法的 chainId → reader 映射 */
export function hasAnyBalanceReaderAddress(): boolean {
  const raw = process.env.EVM_BALANCE_READER_ADDRESSES_JSON?.trim();
  if (!raw) {
    return false;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return false;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return false;
  }
  for (const v of Object.values(parsed as Record<string, unknown>)) {
    if (typeof v === 'string' && isAddress(v)) {
      return true;
    }
  }
  return false;
}

export function getBalanceReaderAddressForChain(
  chainId: number
): `0x${string}` | undefined {
  const raw = process.env.EVM_BALANCE_READER_ADDRESSES_JSON?.trim();
  if (!raw) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined;
  }
  const v = (parsed as Record<string, unknown>)[String(chainId)];
  if (typeof v !== 'string' || !isAddress(v)) {
    return undefined;
  }
  return getAddress(v);
}

export type EvmBalanceReaderQueryResult = {
  chainId: number;
  readerAddress: `0x${string}`;
  native: { address: `0x${string}`; balanceWei: string }[];
  tokens: {
    address: `0x${string}`;
    tokenAddress: `0x${string}`;
    balanceRaw: string;
    ok: boolean;
  }[];
};

export async function queryEvmBalanceBatch(params: {
  chainId: number;
  rpcUrl: string;
  readerAddress: `0x${string}`;
  accounts: `0x${string}`[];
  tokenAddresses: `0x${string}`[];
}): Promise<EvmBalanceReaderQueryResult> {
  const client = createPublicClient({
    transport: http(params.rpcUrl, { timeout: 30_000 })
  });

  let nativeBalances: readonly bigint[];
  let tokenBalances: readonly bigint[];
  let tokenBalanceOk: readonly boolean[];

  try {
    const out = await withUpstreamMetrics('rpc', () =>
      client.readContract({
        address: params.readerAddress,
        abi: evmBalanceBatchReaderAbi,
        functionName: 'getBalances',
        args: [params.accounts, params.tokenAddresses]
      })
    );
    nativeBalances = out[0];
    tokenBalances = out[1];
    tokenBalanceOk = out[2];
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'rpc_read_failed';
    throw new BalanceReaderError(msg, 502);
  }

  const native = params.accounts.map((address, i) => ({
    address,
    balanceWei: (nativeBalances[i] ?? 0n).toString()
  }));

  const m = params.tokenAddresses.length;
  const tokens: EvmBalanceReaderQueryResult['tokens'] = [];
  for (let i = 0; i < params.accounts.length; i += 1) {
    for (let j = 0; j < m; j += 1) {
      const idx = i * m + j;
      tokens.push({
        address: params.accounts[i]!,
        tokenAddress: params.tokenAddresses[j]!,
        balanceRaw: (tokenBalances[idx] ?? 0n).toString(),
        ok: tokenBalanceOk[idx] ?? false
      });
    }
  }

  return {
    chainId: params.chainId,
    readerAddress: params.readerAddress,
    native,
    tokens
  };
}

export async function runEvmBalanceReaderQuery(body: {
  chainId: number;
  addresses: string[];
  tokenAddresses: string[];
}): Promise<EvmBalanceReaderQueryResult> {
  const rpcUrl = getServerRpcUrl();
  if (!rpcUrl) {
    throw new BalanceReaderError('rpc_not_configured', 503);
  }

  const readerAddress = getBalanceReaderAddressForChain(body.chainId);
  if (!readerAddress) {
    throw new BalanceReaderError('balance_reader_not_configured', 503);
  }

  const accounts: `0x${string}`[] = [];
  for (const a of body.addresses) {
    if (!isAddress(a)) {
      throw new BalanceReaderError('invalid_address', 400);
    }
    accounts.push(getAddress(a));
  }

  const tokenAddresses: `0x${string}`[] = [];
  for (const t of body.tokenAddresses) {
    if (!isAddress(t)) {
      throw new BalanceReaderError('invalid_token_address', 400);
    }
    tokenAddresses.push(getAddress(t));
  }

  return queryEvmBalanceBatch({
    chainId: body.chainId,
    rpcUrl,
    readerAddress,
    accounts,
    tokenAddresses
  });
}
