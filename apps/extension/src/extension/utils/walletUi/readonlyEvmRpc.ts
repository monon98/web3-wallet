import { WALLET_BUILTIN_EVM_CHAINS } from '@plugin/shared';
import type { Address, Hex } from 'viem';
import type { Chain } from 'viem/chains';

import { extLogWarn } from '~lib/extensionLog';
import { createPublicClient, http, numberToHex } from '~web3/evm/viem';
import { arbitrum, base, bsc, mainnet, optimism, polygon, sepolia } from '~web3/evm/viemChains';

import { customEvmChainIdFromHex, customEvmChainToViemChain, getCustomEvmChainByChainIdHex } from './customEvmChains';

/**
 * **只读 JSON-RPC 与已签名交易广播**：按当前钱包 `chainId` 解析 viem `Chain`。
 *
 * - 内置链使用 `@plugin/shared` 的 `WALLET_BUILTIN_EVM_CHAINS` 与 viem 内置公共 RPC；
 * - 自定义链使用侧栏保存的 RPC URL（`customEvmChains.ts`），仅 HTTPS 或 localhost HTTP；
 * - 本模块由 `handleEip1193JsonRpc`（background）在已授权站点 / 广播路径调用；
 * - 不记录 RPC URL，错误信息也不拼接完整 URL（可能含节点访问 key）。
 */

/** 未配置 RPC 的稳定错误前缀；桥接层据此映射为 EIP-1193 `UNSUPPORTED_METHOD`。 */
export const NO_CONFIGURED_RPC_ERROR_PREFIX = 'No configured RPC for chainId' as const;

const VIEM_BY_ID: ReadonlyMap<number, Chain> = new Map(
  [mainnet, sepolia, arbitrum, optimism, base, polygon, bsc].map((c) => [c.id, c])
);

/** 校验内置链表与 viem 导入保持一致；缺链时构建期即失败。 */
const CHAINS_BY_ID: ReadonlyMap<number, Chain> = (() => {
  const m = new Map<number, Chain>();
  for (const meta of WALLET_BUILTIN_EVM_CHAINS) {
    const chain = VIEM_BY_ID.get(meta.id);
    if (!chain) {
      throw new Error(`readonlyEvmRpc: add viem chain import for builtin id ${meta.id} (${meta.name})`);
    }
    m.set(meta.id, chain);
  }
  return m;
})();

function noConfiguredRpcError(chainIdHex: string): Error {
  return new Error(`${NO_CONFIGURED_RPC_ERROR_PREFIX} ${chainIdHex}`);
}

async function resolveChain(chainIdHex: string): Promise<Chain | null> {
  const chainId = customEvmChainIdFromHex(chainIdHex);
  if (chainId === null) {
    return null;
  }
  const builtin = CHAINS_BY_ID.get(chainId);
  if (builtin) {
    return builtin;
  }
  const custom = await getCustomEvmChainByChainIdHex(chainIdHex);
  return custom ? customEvmChainToViemChain(custom) : null;
}

/**
 * 解析当前钱包 `chainId` 对应的 viem `Chain`。
 * 返回 `null` 表示既不是内置链，也没有在侧栏配置自定义 RPC。
 */
export async function getWalletEvmChain(chainIdHex: string): Promise<Chain | null> {
  return resolveChain(chainIdHex);
}

/** 当前链是否已配置（内置或侧栏自定义链）；供 `wallet_switchEthereumChain` 校验。 */
export async function isWalletEvmChainConfigured(chainIdHex: string): Promise<boolean> {
  return (await resolveChain(chainIdHex)) !== null;
}

type RpcErrorLike = {
  name?: unknown;
  status?: unknown;
  details?: unknown;
  code?: unknown;
};

/**
 * 把 viem / fetch 错误收敛成**可安全展示与记录**的摘要。
 *
 * viem 的原始 `message` 可能包含 RPC URL（自定义链可能带 API key）、请求体和已签名交易；
 * 因此不使用 `error.message`。自定义链只保留错误类型 / HTTP 状态，内置链可附带节点
 * `details`，并先移除 URL 与长 hex。
 */
export function safeRpcErrorMessage(error: unknown, customChain: boolean): string {
  if (!error || typeof error !== 'object') {
    return 'RPC request failed';
  }
  const e = error as RpcErrorLike;
  const name = typeof e.name === 'string' ? e.name : '';
  if (name === 'TimeoutError' || name === 'AbortError') {
    return 'RPC request timed out';
  }
  const status = typeof e.status === 'number' && Number.isFinite(e.status) ? e.status : undefined;
  if (status !== undefined) {
    return `RPC request failed (HTTP ${status})`;
  }
  if (customChain) {
    const code = typeof e.code === 'number' && Number.isFinite(e.code) ? e.code : undefined;
    return code !== undefined ? `RPC error (code ${code})` : 'RPC request failed';
  }
  const details = typeof e.details === 'string' ? e.details : '';
  if (details !== '') {
    const safe = details
      .replace(/https?:\/\/[^\s"'<>]+/gi, '[rpc-url]')
      .replace(/0x[0-9a-fA-F]{128,}/g, '[hex-data]')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200);
    if (safe !== '') {
      return `RPC error: ${safe}`;
    }
  }
  const code = typeof e.code === 'number' && Number.isFinite(e.code) ? e.code : undefined;
  return code !== undefined ? `RPC error (code ${code})` : 'RPC request failed';
}

function parseBlockArg(block: string): {
  blockTag?: 'latest' | 'earliest' | 'pending';
  blockNumber?: bigint;
} {
  if (block === 'latest' || block === 'earliest' || block === 'pending') {
    return { blockTag: block };
  }
  try {
    return { blockNumber: BigInt(block) };
  } catch {
    return { blockTag: 'latest' };
  }
}

/** EIP-1474 `eth_getBalance`：返回 wei 的 `0x` 十六进制字符串。 */
export async function fetchEthGetBalanceHex(
  chainIdHex: string,
  address: Address,
  blockParam: string
): Promise<`0x${string}`> {
  const chain = await resolveChain(chainIdHex);
  if (!chain) {
    extLogWarn('readonly_rpc_error', {
      method: 'eth_getBalance',
      chainIdHex,
      message: 'no_configured_chain'
    });
    throw noConfiguredRpcError(chainIdHex);
  }
  const client = createPublicClient({ chain, transport: http() });
  const { blockTag, blockNumber } = parseBlockArg(blockParam);
  try {
    const wei =
      blockNumber !== undefined
        ? await client.getBalance({ address, blockNumber })
        : await client.getBalance({ address, blockTag: blockTag ?? 'latest' });
    return numberToHex(wei);
  } catch (e) {
    const message = safeRpcErrorMessage(e, !CHAINS_BY_ID.has(chain.id));
    extLogWarn('readonly_rpc_error', { method: 'eth_getBalance', chainIdHex, message });
    throw new Error(message);
  }
}

/** EIP-1474 `eth_blockNumber`：返回当前链最新区块号的 `0x` 十六进制字符串。 */
export async function fetchEthBlockNumberHex(chainIdHex: string): Promise<`0x${string}`> {
  const chain = await resolveChain(chainIdHex);
  if (!chain) {
    extLogWarn('readonly_rpc_error', {
      method: 'eth_blockNumber',
      chainIdHex,
      message: 'no_configured_chain'
    });
    throw noConfiguredRpcError(chainIdHex);
  }
  const client = createPublicClient({ chain, transport: http() });
  try {
    const n = await client.getBlockNumber();
    return numberToHex(n);
  } catch (e) {
    const message = safeRpcErrorMessage(e, !CHAINS_BY_ID.has(chain.id));
    extLogWarn('readonly_rpc_error', { method: 'eth_blockNumber', chainIdHex, message });
    throw new Error(message);
  }
}

/** `eth_sendRawTransaction`：提交已签名序列化交易，返回交易哈希。 */
export async function broadcastSignedRawTransaction(
  chainIdHex: string,
  serializedTransaction: Hex
): Promise<`0x${string}`> {
  const chain = await resolveChain(chainIdHex);
  if (!chain) {
    extLogWarn('readonly_rpc_error', {
      method: 'eth_sendRawTransaction',
      chainIdHex,
      message: 'no_configured_chain'
    });
    throw noConfiguredRpcError(chainIdHex);
  }
  const client = createPublicClient({ chain, transport: http() });
  try {
    return await client.sendRawTransaction({ serializedTransaction });
  } catch (e) {
    const message = safeRpcErrorMessage(e, !CHAINS_BY_ID.has(chain.id));
    extLogWarn('readonly_rpc_error', { method: 'eth_sendRawTransaction', chainIdHex, message });
    throw new Error(message);
  }
}
