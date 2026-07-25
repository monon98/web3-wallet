import { WALLET_BUILTIN_EVM_CHAINS } from '@plugin/shared';
import type { Address, Hex } from 'viem';
import type { Chain } from 'viem/chains';

import { extLogWarn } from '~lib/extensionLog';
import { createPublicClient, http, numberToHex } from '~web3/evm/viem';
import { arbitrum, base, bsc, mainnet, optimism, polygon, sepolia } from '~web3/evm/viemChains';

/**
 * **只读 JSON-RPC**（不经用�?RPC URL）：�?viem 内置 **公共 HTTP** �?`@plugin/shared` 内置链拉�?
 * `eth_getBalance` / `eth_blockNumber`。链 ID 须在 `WALLET_BUILTIN_EVM_CHAINS` 内，否则 `resolveChain` 失败�?
 *
 * �?`handleEip1193JsonRpc` 在已授权站点上调用；**�?*用于发交易或自定�?RPC�?
 */

const VIEM_BY_ID: ReadonlyMap<number, Chain> = new Map(
  [mainnet, sepolia, arbitrum, optimism, base, polygon, bsc].map((c) => [c.id, c])
);

/** �?`@plugin/shared` 内置链表选用 viem 公共 RPC；缺链时构建期即失败�?*/
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

function resolveChain(chainIdHex: string): Chain | null {
  if (typeof chainIdHex !== 'string' || !chainIdHex.startsWith('0x')) {
    return null;
  }
  let id: number;
  try {
    id = Number.parseInt(chainIdHex, 16);
  } catch {
    return null;
  }
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }
  return CHAINS_BY_ID.get(id) ?? null;
}

/** 解析钱包当前 `chainId`（内置链列表）对应的 viem `Chain`，用于发交易等与只读 RPC 同源。 */
export function getWalletBuiltinChain(chainIdHex: string): Chain | null {
  return resolveChain(chainIdHex);
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

/**
 * EIP-1474 `eth_getBalance`：返�?wei �?0x 十六进制字符串�?
 */
export async function fetchEthGetBalanceHex(
  chainIdHex: string,
  address: Address,
  blockParam: string
): Promise<`0x${string}`> {
  const chain = resolveChain(chainIdHex);
  if (!chain) {
    extLogWarn('readonly_rpc_error', {
      method: 'eth_getBalance',
      chainIdHex,
      message: 'no_bundled_chain'
    });
    throw new Error(`No bundled public RPC for chainId ${chainIdHex}`);
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
    const message = e instanceof Error ? e.message : String(e);
    extLogWarn('readonly_rpc_error', { method: 'eth_getBalance', chainIdHex, message });
    throw e;
  }
}

/**
 * EIP-1474 `eth_blockNumber`：返回当前链最新区块号�?0x 十六进制字符串�?
 */
/**
 * `eth_sendRawTransaction`：提交已签名序列化交易，返回交易哈希（内置公共 RPC）。
 */
export async function broadcastSignedRawTransaction(
  chainIdHex: string,
  serializedTransaction: Hex
): Promise<`0x${string}`> {
  const chain = resolveChain(chainIdHex);
  if (!chain) {
    extLogWarn('readonly_rpc_error', {
      method: 'eth_sendRawTransaction',
      chainIdHex,
      message: 'no_bundled_chain'
    });
    throw new Error(`No bundled public RPC for chainId ${chainIdHex}`);
  }
  const client = createPublicClient({ chain, transport: http() });
  try {
    return await client.sendRawTransaction({ serializedTransaction });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    extLogWarn('readonly_rpc_error', { method: 'eth_sendRawTransaction', chainIdHex, message });
    throw e;
  }
}

export async function fetchEthBlockNumberHex(chainIdHex: string): Promise<`0x${string}`> {
  const chain = resolveChain(chainIdHex);
  if (!chain) {
    extLogWarn('readonly_rpc_error', {
      method: 'eth_blockNumber',
      chainIdHex,
      message: 'no_bundled_chain'
    });
    throw new Error(`No bundled public RPC for chainId ${chainIdHex}`);
  }
  const client = createPublicClient({ chain, transport: http() });
  try {
    const n = await client.getBlockNumber();
    return numberToHex(n);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    extLogWarn('readonly_rpc_error', { method: 'eth_blockNumber', chainIdHex, message });
    throw e;
  }
}
