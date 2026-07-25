# DApp 桥（`extension/utils/bridge`）

网页 `window.ethereum` → 隔离脚本 → background 的请求处理与「挂起审批」逻辑。

## 目录结构（按功能）

| 子目录 | 职责 |
|--------|------|
| **根目录** | **`constants.ts`**：channel / runtime / postMessage 常量（全局引用）。**`handleBridgeMessage.ts`**：总入口 `handleBridgeRequest`，EIP-1193 分发与同步 RPC。 |
| **`siteConnect/`** | 站点连接：`pendingSiteConnect`、`openSiteConnectPopup`、`resolvePendingSiteConnect`、`resolveConnectApprovalAddress`。 |
| **`personalSign/`** | `personal_sign` / `eth_sign`：`personalSignBridge`、`pendingPersonalSign`、`openPersonalSignPopup`、`resolvePendingPersonalSign`。 |
| **`typedData/`** | EIP-712：`typedDataSignBridge`、`pendingTypedDataSign`、`openTypedDataSignPopup`、`resolvePendingTypedDataSign`。 |
| **`transaction/`** | `eth_sendTransaction` / `eth_signTransaction`：`sendTransactionBridge`、`pendingSendTransaction`、`openSendTransactionPopup`、`resolvePendingSendTransaction`、`eip1193SendTransactionParams`。 |

## 类型定义

挂起态与 `BridgeHandlerResult` 定义在 **`~/types/bridge`**（物理路径 `extension/types/bridge/`），由 `~/types` 根出口聚合。

## 维护优先级（核心）

1. **`handleBridgeMessage.ts`** — 所有 DApp 请求的入口与安全边界（origin、授权、方法分流）。
2. **`constants.ts`** — 与 `contents/`、`tabs/`、`serviceWorker.ts` 必须字符串一致。
3. **各模块 `resolvePending*.ts`** — 口令解密、签名、向页面回传结果；禁止记录私钥与口令。

其余实现按子目录迭代即可；改挂起结构须同步 **`types/bridge/`** 与对应 `pending*.ts`。
