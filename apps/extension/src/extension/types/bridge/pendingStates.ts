/**
 * DApp 桥挂起态（与 chrome.storage.session 持久结构一致）。
 * 实现见 extension/utils/bridge 下各 pending*.ts 模块。
 */

export type PendingSiteConnectKind = 'eth_requestAccounts' | 'connect';

export type PendingSiteConnect = {
  bridgeRequestId: string;
  kind: PendingSiteConnectKind;
  origin: string;
  tabId: number;
  windowId: number;
  ts: number;
  /** 独立审批 popup 的 chrome.windows id */
  approvalWindowId?: number;
};

/** 待用户确认的 personal_sign / eth_sign（与站点连接互斥）。 */
export type PendingPersonalSign = {
  bridgeRequestId: string;
  origin: string;
  tabId: number;
  windowId: number;
  ts: number;
  signerAddress: `0x${string}`;
  messageHex: `0x${string}`;
  approvalWindowId?: number;
};

/** EIP-712：eth_signTypedData、eth_signTypedData_v3、eth_signTypedData_v4 共用 */
export type SerializableEip712TypedData = {
  domain: Record<string, unknown>;
  types: Record<string, ReadonlyArray<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type PendingTypedDataSign = {
  bridgeRequestId: string;
  origin: string;
  tabId: number;
  windowId: number;
  ts: number;
  signerAddress: `0x${string}`;
  typedData: SerializableEip712TypedData;
  approvalWindowId?: number;
};

/** 与 EIP-1193 一致：`eth_sendTransaction` 受全局「交易提交方式」影响；`eth_signTransaction` 固定仅返回已签名 RLP */
export type PendingTxRpcMethod = 'eth_sendTransaction' | 'eth_signTransaction';

/** 待用户确认的 `eth_sendTransaction` / `eth_signTransaction` */
export type PendingSendTransaction = {
  bridgeRequestId: string;
  origin: string;
  tabId: number;
  windowId: number;
  ts: number;
  signerAddress: `0x${string}`;
  pendingTxRpcMethod: PendingTxRpcMethod;
  /** DApp 传入的交易对象（字段多为 hex 字符串） */
  transaction: Record<string, unknown>;
  approvalWindowId?: number;
};
