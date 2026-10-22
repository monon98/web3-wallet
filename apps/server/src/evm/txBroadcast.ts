import { getAddress, parseTransaction, recoverTransactionAddress } from 'viem';

import { getServerRpcUrl } from '../config/chain.js';
import { forwardToRpc } from './rpcForward.js';

/**
 * 服务端 EVM 交易广播。
 *
 * 调用链：`routes/tx.ts`（Cookie + CSRF 或 Bearer 会话校验后）→ 本模块 → `SERVER_RPC_URL`。
 * 安全边界：只接收**已签名 raw tx**，不接触私钥 / 助记词；不把 raw tx 写入日志。
 * 链一致性：先校验 raw tx 的 chainId 与请求一致，再校验 RPC `eth_chainId`，避免跨链广播。
 */

export type TxBroadcastErrorStatus = 400 | 403 | 422 | 502 | 503;

export class TxBroadcastError extends Error {
  constructor(
    message: string,
    readonly statusCode: TxBroadcastErrorStatus,
    readonly detail?: string
  ) {
    super(message);
    this.name = 'TxBroadcastError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseChainIdHex(value: unknown): number {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new TxBroadcastError('rpc_invalid_chain_id', 502);
  }
  const chainId = Number.parseInt(value, 16);
  if (!Number.isSafeInteger(chainId) || chainId <= 0) {
    throw new TxBroadcastError('rpc_invalid_chain_id', 502);
  }
  return chainId;
}

function parseUpstreamMessage(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const message = value.trim();
  if (!message) {
    return undefined;
  }
  // 上游错误可能包含长字符串或内部信息；只回传有限长度，且不记录 raw tx。
  return message.length > 300 ? `${message.slice(0, 300)}…` : message;
}

/**
 * 广播一笔已签名 EVM 交易。
 *
 * @param params.chainId 目标链 ID（须与 raw tx、服务端 RPC 一致）
 * @param params.signedTransaction 0x 前缀的已签名 raw transaction
 * @param params.from 可选：登录会话地址；传入时强制校验交易签名者
 * @throws {TxBroadcastError} 未配置 RPC、链不一致、交易无效或上游拒绝
 */
export async function broadcastEvmTransaction(params: {
  chainId: number;
  signedTransaction: string;
  from?: string;
}): Promise<{ hash: `0x${string}` }> {
  const rpcUrl = getServerRpcUrl();
  if (!rpcUrl) {
    throw new TxBroadcastError('rpc_not_configured', 503);
  }

  const serialized = params.signedTransaction as Parameters<
    typeof recoverTransactionAddress
  >[0]['serializedTransaction'];
  let txChainId: number | undefined;
  try {
    const tx = parseTransaction(serialized);
    txChainId = tx.chainId;
  } catch {
    throw new TxBroadcastError('invalid_signed_transaction', 400);
  }

  // 必须带 chainId（EIP-155），否则无法把签名交易绑定到目标链。
  if (txChainId === undefined || txChainId !== params.chainId) {
    throw new TxBroadcastError('tx_chain_mismatch', 400);
  }

  if (params.from) {
    let signer: `0x${string}`;
    try {
      signer = await recoverTransactionAddress({
        serializedTransaction: serialized
      });
    } catch {
      throw new TxBroadcastError('invalid_signed_transaction', 400);
    }
    if (getAddress(signer) !== getAddress(params.from)) {
      throw new TxBroadcastError('tx_sender_mismatch', 403);
    }
  }

  let chainResponse: unknown;
  try {
    chainResponse = await forwardToRpc(rpcUrl, {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_chainId',
      params: []
    });
  } catch {
    throw new TxBroadcastError('rpc_unreachable', 502);
  }

  const rpcChainId = parseChainIdHex(
    isRecord(chainResponse) ? chainResponse.result : undefined
  );
  if (rpcChainId !== params.chainId) {
    throw new TxBroadcastError('rpc_chain_mismatch', 503);
  }

  let sendResponse: unknown;
  try {
    sendResponse = await forwardToRpc(rpcUrl, {
      jsonrpc: '2.0',
      id: 2,
      method: 'eth_sendRawTransaction',
      params: [serialized]
    });
  } catch {
    throw new TxBroadcastError('rpc_unreachable', 502);
  }

  if (!isRecord(sendResponse)) {
    throw new TxBroadcastError('rpc_invalid_response', 502);
  }

  if (sendResponse.error) {
    const detail = isRecord(sendResponse.error)
      ? parseUpstreamMessage(sendResponse.error.message)
      : undefined;
    throw new TxBroadcastError('broadcast_rejected', 422, detail);
  }

  const hash = sendResponse.result;
  if (typeof hash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
    throw new TxBroadcastError('rpc_invalid_transaction_hash', 502);
  }

  return { hash: hash as `0x${string}` };
}
