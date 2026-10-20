import { getAddress, isAddress } from 'viem';

import { getServerRpcUrl } from '../config/chain.js';
import { forwardToRpc } from './rpcForward.js';

/**
 * EVM 原生币余额的 RPC 兜底路径。
 *
 * 调用链：`routes/evmGateway.ts` 的 native-balance(s) 路由 → 本模块。
 * Etherscan 未配置 / 不可达，或 `SERVER_RPC_URL` 已配置时使用；批量查询走单次
 * JSON-RPC batch（`eth_chainId` + 每个地址的 `eth_getBalance`）。
 *
 * 安全边界：只读链上数据，不接触私钥；RPC URL 仅来自服务端环境变量，本模块不记录其值。
 * 链一致性：先校验 RPC 的 `eth_chainId` 与请求 `chainId` 相同，避免把其它链余额当成目标链。
 */

export type NativeBalanceRpcResult = {
  chainId: number;
  address: `0x${string}`;
  balanceWei: string;
};

export class NativeBalanceRpcError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'NativeBalanceRpcError';
  }
}

type RpcCall = {
  method: string;
  params: unknown[];
};

type RpcResponseItem = {
  id?: unknown;
  result?: unknown;
  error?: { message?: unknown };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRpcResponseItem(value: unknown): value is RpcResponseItem {
  return isRecord(value);
}

/** 发起一次 JSON-RPC batch，并按请求 id 还原结果顺序。 */
async function rpcBatch(calls: RpcCall[]): Promise<unknown[]> {
  const rpcUrl = getServerRpcUrl();
  if (!rpcUrl) {
    throw new NativeBalanceRpcError('rpc_not_configured', 503);
  }

  let json: unknown;
  try {
    json = await forwardToRpc(
      rpcUrl,
      calls.map((call, index) => ({
        jsonrpc: '2.0',
        id: index + 1,
        method: call.method,
        params: call.params
      }))
    );
  } catch {
    throw new NativeBalanceRpcError('rpc_unreachable', 502);
  }

  if (!Array.isArray(json)) {
    throw new NativeBalanceRpcError('rpc_invalid_response', 502);
  }

  const byId = new Map<number, RpcResponseItem>();
  for (const item of json) {
    if (!isRpcResponseItem(item)) {
      continue;
    }
    const id =
      typeof item.id === 'number'
        ? item.id
        : Number.parseInt(String(item.id), 10);
    if (Number.isInteger(id)) {
      byId.set(id, item);
    }
  }

  return calls.map((_, index) => {
    const item = byId.get(index + 1);
    if (!item) {
      throw new NativeBalanceRpcError('rpc_missing_response', 502);
    }
    if (item.error) {
      throw new NativeBalanceRpcError('rpc_upstream_error', 502);
    }
    return item.result;
  });
}

function parseChainId(value: unknown): number {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new NativeBalanceRpcError('rpc_invalid_chain_id', 502);
  }
  const id = Number.parseInt(value, 16);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new NativeBalanceRpcError('rpc_invalid_chain_id', 502);
  }
  return id;
}

function parseBalanceWei(value: unknown): string {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new NativeBalanceRpcError('rpc_invalid_balance', 502);
  }
  return BigInt(value).toString();
}

function normalizeAddress(address: string): `0x${string}` {
  if (!isAddress(address)) {
    throw new NativeBalanceRpcError('invalid_address', 400);
  }
  return getAddress(address);
}

/**
 * 通过服务端 RPC 查询一批地址的原生币余额。
 *
 * @throws {NativeBalanceRpcError} 未配置 RPC、RPC 不可达、链不一致或返回格式异常
 */
export async function getNativeBalancesRpc(params: {
  chainId: number;
  addresses: string[];
}): Promise<NativeBalanceRpcResult[]> {
  if (params.addresses.length === 0) {
    throw new NativeBalanceRpcError('addresses_empty', 400);
  }

  const addresses = params.addresses.map(normalizeAddress);
  const results = await rpcBatch([
    { method: 'eth_chainId', params: [] },
    ...addresses.map((address) => ({
      method: 'eth_getBalance',
      params: [address, 'latest']
    }))
  ]);

  const rpcChainId = parseChainId(results[0]);
  if (rpcChainId !== params.chainId) {
    throw new NativeBalanceRpcError('rpc_chain_mismatch', 503);
  }

  return addresses.map((address, index) => ({
    chainId: params.chainId,
    address,
    balanceWei: parseBalanceWei(results[index + 1])
  }));
}
