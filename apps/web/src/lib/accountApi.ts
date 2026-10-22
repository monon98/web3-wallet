import { getAddress, isAddress, toHex, type Address, type Hex } from 'viem';

/**
 * Web `/account` 页的服务端调用封装。
 *
 * 调用链：`app/account/page.tsx` → 本模块 → Fastify `/api/v1/auth/*`、`/api/v1/tx/broadcast`、
 * `/api/v1/evm/rpc`。只传输公开地址、签名与已签名 raw tx；**不接触私钥 / 助记词**。
 *
 * 会话（P4-5）：服务端通过 HttpOnly Cookie 保存 token；本模块只在内存保存 `/me` 返回的
 * `csrfToken`，写操作放在 `x-csrf-token` 头，不再使用 sessionStorage。
 */

export class AccountApiError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly code?: string,
    readonly detail?: string
  ) {
    super(message);
    this.name = 'AccountApiError';
  }
}

export type AuthChallenge = {
  challengeId: string;
  message: string;
  expiresAt: string;
};

export type AuthSession = {
  address: Address;
  chainId?: number;
  expiresAt: string;
};

export type StoredAuthSession = AuthSession & {
  csrfToken: string;
};

export type TxBroadcastResult = {
  chainId: number;
  hash: `0x${string}`;
};

export type PreparedEvmTx = {
  nonce: Hex;
  gas: Hex;
  gasPrice: Hex;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AccountApiError(
      '服务端返回的不是 JSON。',
      response.status,
      'invalid_response'
    );
  }
}

function toApiError(response: Response, body: unknown): AccountApiError {
  const code =
    isRecord(body) && typeof body.error === 'string' ? body.error : undefined;
  const detail =
    isRecord(body) && typeof body.detail === 'string' ? body.detail : undefined;
  return new AccountApiError(
    code ?? `HTTP ${response.status}`,
    response.status,
    code,
    detail
  );
}

async function requestJson(
  apiBase: string,
  path: string,
  init: RequestInit
): Promise<unknown> {
  if (!apiBase) {
    throw new AccountApiError('未配置服务端 API 基址。', 0, 'api_base_missing');
  }

  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      credentials: 'include',
      ...init
    });
  } catch {
    throw new AccountApiError(
      '无法连接服务端，请确认 Fastify 已启动。',
      0,
      'network_error'
    );
  }

  const body = await readJson(response);
  if (!response.ok) {
    throw toApiError(response, body);
  }
  return body;
}

/** 将常见服务端错误码转为可直接展示的中文提示。 */
export function describeAccountError(error: unknown): string {
  if (error instanceof AccountApiError) {
    const suffix = error.detail ? `：${error.detail}` : '';
    switch (error.code) {
      case 'api_base_missing':
        return error.message;
      case 'network_error':
        return error.message;
      case 'unauthorized':
        return '登录已失效，请重新获取登录消息并签名。';
      case 'invalid_body':
        return `请求参数无效${suffix}`;
      case 'invalid_address':
        return '钱包地址格式无效。';
      case 'challenge_not_found':
        return '登录消息不存在或已过期，请重新获取。';
      case 'address_mismatch':
        return '签名地址与登录消息中的地址不一致。';
      case 'invalid_signature':
        return '签名校验失败，请重新签名。';
      case 'csrf_invalid':
        return '页面安全令牌已失效，请刷新页面后重试。';
      case 'rpc_not_configured':
        return '服务端未配置 SERVER_RPC_URL，无法读取链上参数或广播交易。';
      case 'rpc_unreachable':
        return '服务端 RPC 不可达，请稍后重试。';
      case 'rpc_chain_mismatch':
        return '服务端 RPC 的链 ID 与钱包当前链不一致，请切换服务端配置或钱包网络。';
      case 'tx_chain_mismatch':
        return '交易 chainId 与请求 chainId 不一致。';
      case 'tx_sender_mismatch':
        return '交易签名者与当前登录地址不一致。';
      case 'invalid_signed_transaction':
        return '已签名交易格式无效。';
      case 'broadcast_rejected':
        return `链上节点拒绝交易${suffix}`;
      default:
        return `${error.message}${suffix}`;
    }
  }
  return error instanceof Error ? error.message : String(error);
}

export async function requestAuthChallenge(
  apiBase: string,
  address: Address,
  chainId: number
): Promise<AuthChallenge> {
  const body = await requestJson(apiBase, '/api/v1/auth/challenge', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, chainId })
  });
  if (
    !isRecord(body) ||
    typeof body.challengeId !== 'string' ||
    typeof body.message !== 'string' ||
    typeof body.expiresAt !== 'string'
  ) {
    throw new AccountApiError(
      '登录 challenge 响应格式无效。',
      200,
      'invalid_response'
    );
  }
  return {
    challengeId: body.challengeId,
    message: body.message,
    expiresAt: body.expiresAt
  };
}

export async function verifyAuthSignature(
  apiBase: string,
  params: { challengeId: string; address: Address; signature: string }
): Promise<StoredAuthSession> {
  const body = await requestJson(apiBase, '/api/v1/auth/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(params)
  });
  if (
    !isRecord(body) ||
    typeof body.address !== 'string' ||
    !isAddress(body.address) ||
    typeof body.csrfToken !== 'string' ||
    typeof body.expiresAt !== 'string'
  ) {
    throw new AccountApiError(
      '登录校验响应格式无效。',
      200,
      'invalid_response'
    );
  }
  return {
    address: getAddress(body.address),
    csrfToken: body.csrfToken,
    expiresAt: body.expiresAt
  };
}

function parseAuthSession(body: unknown): StoredAuthSession {
  if (
    !isRecord(body) ||
    typeof body.address !== 'string' ||
    !isAddress(body.address) ||
    typeof body.csrfToken !== 'string' ||
    typeof body.expiresAt !== 'string'
  ) {
    throw new AccountApiError('会话响应格式无效。', 200, 'invalid_response');
  }
  return {
    address: getAddress(body.address),
    chainId:
      typeof body.chainId === 'number' && Number.isInteger(body.chainId)
        ? body.chainId
        : undefined,
    csrfToken: body.csrfToken,
    expiresAt: body.expiresAt
  };
}

export async function fetchAuthSession(
  apiBase: string
): Promise<StoredAuthSession> {
  const body = await requestJson(apiBase, '/api/v1/auth/me', {
    method: 'GET'
  });
  return parseAuthSession(body);
}

export async function logoutAuthSession(
  apiBase: string,
  csrfToken: string
): Promise<void> {
  await requestJson(apiBase, '/api/v1/auth/logout', {
    method: 'POST',
    headers: { 'x-csrf-token': csrfToken }
  });
}

export async function broadcastSignedTransaction(
  apiBase: string,
  csrfToken: string,
  chainId: number,
  signedTransaction: string
): Promise<TxBroadcastResult> {
  const body = await requestJson(apiBase, '/api/v1/tx/broadcast', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-csrf-token': csrfToken
    },
    body: JSON.stringify({ chainId, signedTransaction })
  });
  if (
    !isRecord(body) ||
    typeof body.chainId !== 'number' ||
    typeof body.hash !== 'string' ||
    !/^0x[0-9a-fA-F]{64}$/.test(body.hash)
  ) {
    throw new AccountApiError(
      '交易广播响应格式无效。',
      200,
      'invalid_response'
    );
  }
  return { chainId: body.chainId, hash: body.hash as `0x${string}` };
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

function parseHexQuantity(value: unknown, field: string): Hex {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) {
    throw new AccountApiError(
      `RPC 返回的 ${field} 格式无效。`,
      502,
      'invalid_rpc_response'
    );
  }
  return value as Hex;
}

async function rpcBatch(apiBase: string, calls: RpcCall[]): Promise<unknown[]> {
  const body = await requestJson(apiBase, '/api/v1/evm/rpc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(
      calls.map((call, index) => ({
        jsonrpc: '2.0',
        id: index + 1,
        method: call.method,
        params: call.params
      }))
    )
  });

  if (!Array.isArray(body)) {
    throw new AccountApiError(
      'RPC 批量响应格式无效。',
      502,
      'invalid_rpc_response'
    );
  }

  const byId = new Map<number, RpcResponseItem>();
  for (const item of body) {
    if (!isRecord(item)) {
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
      throw new AccountApiError(
        'RPC 批量响应缺少条目。',
        502,
        'invalid_rpc_response'
      );
    }
    if (item.error) {
      const message =
        typeof item.error.message === 'string'
          ? item.error.message
          : 'RPC 上游返回错误';
      throw new AccountApiError(message, 502, 'rpc_upstream_error');
    }
    return item.result;
  });
}

/**
 * 通过服务端 JSON-RPC 转发获取签名所需的 nonce / gas / gasPrice。
 * 先校验服务端 RPC 链 ID，避免用错链参数签出交易。
 */
export async function prepareEvmTransaction(
  apiBase: string,
  params: { from: Address; to: Address; valueWei: bigint; chainId: number }
): Promise<PreparedEvmTx> {
  const valueHex = toHex(params.valueWei);
  const results = await rpcBatch(apiBase, [
    { method: 'eth_chainId', params: [] },
    { method: 'eth_getTransactionCount', params: [params.from, 'pending'] },
    {
      method: 'eth_estimateGas',
      params: [{ from: params.from, to: params.to, value: valueHex }]
    },
    { method: 'eth_gasPrice', params: [] }
  ]);

  const rpcChainIdHex = parseHexQuantity(results[0], 'eth_chainId');
  const rpcChainId = Number.parseInt(rpcChainIdHex, 16);
  if (!Number.isSafeInteger(rpcChainId) || rpcChainId !== params.chainId) {
    throw new AccountApiError(
      '服务端 RPC 链 ID 与钱包当前链不一致。',
      409,
      'rpc_chain_mismatch'
    );
  }

  return {
    nonce: parseHexQuantity(results[1], 'nonce'),
    gas: parseHexQuantity(results[2], 'gas'),
    gasPrice: parseHexQuantity(results[3], 'gasPrice')
  };
}
