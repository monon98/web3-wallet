import { RPC_ALLOWED_METHODS, RPC_MAX_BATCH } from './rpcAllowlist.js';

type RpcItem = {
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
};

function isRpcItem(v: unknown): v is RpcItem {
  return typeof v === 'object' && v !== null;
}

export class RpcForwardError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'RpcForwardError';
  }
}

function assertAllowedMethod(method: string): void {
  if (!RPC_ALLOWED_METHODS.has(method)) {
    throw new RpcForwardError(`method_not_allowed:${method}`, 400);
  }
}

function validateSingle(body: unknown): void {
  if (!isRpcItem(body)) {
    throw new RpcForwardError('invalid_jsonrpc_envelope', 400);
  }
  if (body.jsonrpc !== '2.0') {
    throw new RpcForwardError('jsonrpc_must_be_2.0', 400);
  }
  if (typeof body.method !== 'string' || !body.method) {
    throw new RpcForwardError('invalid_method', 400);
  }
  assertAllowedMethod(body.method);
  if (
    body.params !== undefined &&
    !Array.isArray(body.params) &&
    typeof body.params !== 'object'
  ) {
    throw new RpcForwardError('params_must_be_array_or_object', 400);
  }
}

export function validateRpcPayload(body: unknown): void {
  if (Array.isArray(body)) {
    if (body.length === 0) {
      throw new RpcForwardError('empty_batch', 400);
    }
    if (body.length > RPC_MAX_BATCH) {
      throw new RpcForwardError(`batch_max_${RPC_MAX_BATCH}`, 400);
    }
    for (const item of body) {
      validateSingle(item);
    }
    return;
  }
  validateSingle(body);
}

export async function forwardToRpc(
  rpcUrl: string,
  body: unknown
): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000)
  });

  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text) as unknown;
  } catch {
    throw new RpcForwardError('upstream_non_json', 502);
  }

  if (!res.ok) {
    throw new RpcForwardError(`upstream_http_${res.status}`, 502);
  }

  return json;
}
