/** 余额查询集成测试的上游 fetch 模拟工具（仅测试使用）。 */

export type FetchHandler = (
  url: string,
  init: RequestInit
) => Promise<Response> | Response;

let activeHandler: FetchHandler | null = null;
let originalFetch: typeof globalThis.fetch | null = null;

export function installFetchMock(handler: FetchHandler): void {
  activeHandler = handler;
  if (!originalFetch) {
    originalFetch = globalThis.fetch;
  }
  globalThis.fetch = (async (input, init) => {
    if (!activeHandler) {
      throw new Error('fetch_handler_not_configured');
    }
    return activeHandler(String(input), init ?? {});
  }) as typeof globalThis.fetch;
}

export function setFetchHandler(handler: FetchHandler): void {
  activeHandler = handler;
}

export function restoreFetchMock(): void {
  activeHandler = null;
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

/** 模拟服务端 JSON-RPC batch：`eth_chainId` 返回指定链，其余方法返回固定余额。 */
export function evmRpcResponse(
  init: RequestInit,
  params: { chainId: number; balanceWei: string }
): Response {
  const calls = JSON.parse(String(init.body)) as Array<{
    id?: unknown;
    method?: string;
  }>;
  return jsonResponse(
    calls.map((call) => ({
      jsonrpc: '2.0',
      id: call.id ?? null,
      result:
        call.method === 'eth_chainId'
          ? `0x${params.chainId.toString(16)}`
          : params.balanceWei
    }))
  );
}

export function etherscanTokenResponse(
  tokens: Array<{
    tokenAddress: string;
    tokenName: string;
    tokenSymbol: string;
    tokenQuantity: string;
    tokenDivisor: string;
  }>
): Response {
  return jsonResponse({
    status: '1',
    message: 'OK',
    result: tokens.map((token) => ({
      TokenAddress: token.tokenAddress,
      TokenName: token.tokenName,
      TokenSymbol: token.tokenSymbol,
      TokenQuantity: token.tokenQuantity,
      TokenDivisor: token.tokenDivisor
    }))
  });
}

export function tronAccountResponse(params: {
  balanceSun: number;
  trc20?: Array<{ contractAddress: string; balanceRaw: string }>;
}): Response {
  const trc20: Record<string, string> = {};
  for (const token of params.trc20 ?? []) {
    trc20[token.contractAddress] = token.balanceRaw;
  }
  return jsonResponse({
    success: true,
    data: [{ balance: params.balanceSun, trc20: [trc20] }]
  });
}

export function esploraAddressResponse(params: {
  balanceSat: number;
  mempoolBalanceSat?: number;
  txCount?: number;
}): Response {
  return jsonResponse({
    chain_stats: {
      funded_txo_sum: params.balanceSat,
      spent_txo_sum: 0,
      tx_count: params.txCount ?? 0
    },
    mempool_stats: {
      funded_txo_sum: params.mempoolBalanceSat ?? 0,
      spent_txo_sum: 0,
      tx_count: 0
    }
  });
}
