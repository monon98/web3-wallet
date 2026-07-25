/**
 * 应用层错误码（HTTP / bridge 业务语义扩展，与 EIP-1193 数值码区分）
 */
export const AppErrorCode = {
  BRIDGE_INVALID_ORIGIN: 'BRIDGE_INVALID_ORIGIN',
  BRIDGE_TIMEOUT: 'BRIDGE_TIMEOUT',
  VAULT_LOCKED: 'VAULT_LOCKED',
  AUTH_INVALID_SIGNATURE: 'AUTH_INVALID_SIGNATURE',
  TX_BROADCAST_REJECTED: 'TX_BROADCAST_REJECTED'
} as const;

export type AppErrorCodeType = (typeof AppErrorCode)[keyof typeof AppErrorCode];
