/**
 * 常用 EIP-1193 Provider 错误码（便于 Web 与扩展统一处理）
 * @see https://eips.ethereum.org/EIPS/eip-1193
 */
export const EIP1193_ERROR_CODES = {
  USER_REJECTED: 4001,
  UNAUTHORIZED: 4100,
  UNSUPPORTED_METHOD: 4200,
  DISCONNECTED: 4900,
  CHAIN_DISCONNECTED: 4901
} as const;

export type Eip1193NumericErrorCode =
  (typeof EIP1193_ERROR_CODES)[keyof typeof EIP1193_ERROR_CODES];
