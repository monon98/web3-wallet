/**
 * 轻量 JSON-RPC 代理：仅放行常见只读方法 + 广播（由服务端代发 raw tx）。
 * 后续可按链/鉴权收紧。
 */
export const RPC_ALLOWED_METHODS = new Set([
  'net_version',
  'eth_chainId',
  'eth_blockNumber',
  'eth_gasPrice',
  'eth_getBalance',
  'eth_getCode',
  'eth_getStorageAt',
  'eth_getTransactionCount',
  'eth_getBlockByHash',
  'eth_getBlockByNumber',
  'eth_getTransactionByHash',
  'eth_getTransactionReceipt',
  'eth_call',
  'eth_estimateGas',
  'eth_getLogs',
  'eth_sendRawTransaction'
]);

export const RPC_MAX_BATCH = 10;
