# 扩展 bridge 模块约定

> 作用域：`apps/extension/src/extension/utils/bridge/**`（并约定 `src/extension/types/bridge/**` 的类型出口）。OpenCode 在读取本目录内文件时自动加载本文件。

## 路径别名（TS）

- **`~lib/bridge/...`** → `apps/extension/src/extension/utils/*`，子路径随目录存在即可解析；**无需**改 `tsconfig.json`。
- **`~/types/bridge`** → `apps/extension/src/extension/types/bridge/index.ts`（已配置 `~/types/*`）。
- **`~/types`** → 聚合出口仍包含 `./bridge`，业务可只引 `~/types`。

## 目录分组

见仓库内 **`apps/extension/src/extension/utils/bridge/README.md`**（与本规则一致）。

- **根**：`constants.ts`、`handleBridgeMessage.ts`（核心入口）。
- **`siteConnect/`**：连接审批与挂起存储。
- **`personalSign/`**：personal_sign / eth_sign。
- **`typedData/`**：EIP-712。
- **`transaction/`**：发送交易 / 仅签名交易。

新增能力时：**优先落在对应子目录**，避免根目录继续堆文件。

## 类型

桥接专用类型集中在 **`src/extension/types/bridge/`**（`pendingStates`、`handlerResult`、`index`），**禁止**在 `pending*.ts` 内重复定义同名 `Pending*` 结构。

## 维护优先级

1. **`handleBridgeMessage.ts`** — 入口与安全策略。
2. **`constants.ts`** — 跨进程字符串契约。
3. **`resolvePending*.ts` + vault 解密路径** — 签名与通知页面。
