/**
 * 桥接与弹窗相关的 **字符串常量**（channel、`postMessage` source、`runtime` 消息 `type`）。
 *
 * **须同步修改的消费者**：`background.ts` / `extension/background/serviceWorker.ts`（`runtime.onMessage`）、`contents/allUrls.ts`、`contents/inpageEvm.ts`、
 * `tabs/siteConnect.tsx`、`tabs/signPersonal.tsx`、`tabs/signTypedData.tsx`、`tabs/signSendTransaction.tsx`、侧栏 `~/hooks/useWalletPanel.ts`。
 * 字符串值漂移会导致消息对不上、挂起无法解析。
 *
 * 本文件不含运行时逻辑；开发态日志见 `~lib/extensionLog` 与各 bridge / `resolvePending*` 模块。
 */

/** 隔离脚本 ↔ runtime 的 chrome.runtime.sendMessage channel */
export const WEB3_WALLET_BRIDGE_RUNTIME_CHANNEL = 'web3-wallet-bridge' as const;

/** window.postMessage 信封 source（inpage 实现时需与此一致） */
export const WEB3_WALLET_POSTMESSAGE_INPAGE_SOURCE = 'web3-wallet-inpage-v0' as const;
export const WEB3_WALLET_POSTMESSAGE_CONTENT_SOURCE = 'web3-wallet-content-v0' as const;

/** background → 隔离脚本：挂起请求已有结果；`type` 同 `DeferredBridgeRuntimeMessage`（`allUrls.ts` 监听） */
export const RUNTIME_MSG_DEFERRED_BRIDGE_RESULT = 'web3-wallet-deferred-bridge-result' as const;

/** 侧栏 / 弹窗 → background：批准或拒绝待处理的站点连接 */
export const RUNTIME_MSG_APPROVE_SITE_CONNECT = 'web3-wallet-approve-site-connect' as const;
export const RUNTIME_MSG_REJECT_SITE_CONNECT = 'web3-wallet-reject-site-connect' as const;

/** 签名弹窗 → background：`personal_sign` 口令确认或拒绝 */
export const RUNTIME_MSG_APPROVE_PERSONAL_SIGN = 'web3-wallet-approve-personal-sign' as const;
export const RUNTIME_MSG_REJECT_PERSONAL_SIGN = 'web3-wallet-reject-personal-sign' as const;

/** 签名弹窗 → background：EIP-712 `eth_signTypedData*` 口令确认或拒绝 */
export const RUNTIME_MSG_APPROVE_TYPED_DATA_SIGN = 'web3-wallet-approve-typed-data-sign' as const;
export const RUNTIME_MSG_REJECT_TYPED_DATA_SIGN = 'web3-wallet-reject-typed-data-sign' as const;

/** 发送交易弹窗 → background：`eth_sendTransaction` 口令确认或拒绝 */
export const RUNTIME_MSG_APPROVE_SEND_TRANSACTION = 'web3-wallet-approve-send-transaction' as const;
export const RUNTIME_MSG_REJECT_SEND_TRANSACTION = 'web3-wallet-reject-send-transaction' as const;

/** 隔离脚本 → inpage：`kind` 与 `ContentBridgePending` 一致，inpage 据此延长 RPC 超时 */
export const BRIDGE_POSTMESSAGE_KIND_PENDING = 'bridge-pending' as const;
