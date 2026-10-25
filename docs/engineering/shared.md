# 子项目：共享包（`packages/shared`，`@plugin/shared`）

- **职责**：Bridge 信封、HTTP/EVM explorer 等 **Zod 与 TypeScript 类型**；各端引用避免重复定义。
- **Bridge 信封**：[`src/bridge/envelope.ts`](../../packages/shared/src/bridge/envelope.ts)；扩展在网页侧的实现与**开发态调试日志**（`extLog*`）索引起 [TECHNICAL-SOLUTION.md §4.1](./TECHNICAL-SOLUTION.md)「开发态可观测性」、细节见 [extension.md](./extension.md)。
- **内置 EVM 链清单**：[`src/evm/builtinEvmChains.ts`](../../packages/shared/src/evm/builtinEvmChains.ts) 列出扩展 `wallet_*` / 只读 RPC 与 Web `/wallet` 联调页共用的 **链 ID、名称、主币符号**（不含 RPC URL；扩展侧由 viem 链定义绑定；校验函数 `isWalletBuiltinEvmChainIdHex` 等）。扩展还可在本机添加**自定义 RPC 链**，只存于 `chrome.storage.local`，不进入本共享清单，也不改变 Web 默认链列表。
- **HTTP 契约**：`src/http/`——`evmExplorer`（Etherscan 查询）、`evmBalanceReader`（批量读与限额）、`evmBatchSender`（构造请求）、`tronExplorer`（Tron 批量账户请求）、`btcExplorer`（BTC 批量地址请求）、`balances`（统一多链余额查询 / 状态，含请求 / 响应 schema、`BALANCE_MAX_ADDRESSES_PER_CHAIN` 与部分失败结构）、`tx`（广播已签名交易，含请求 / 响应 schema）、`auth`（SIWE 风格 challenge / verify / me / logout，含请求 / 响应 schema；服务端已实现 MVP）；错误码见 `src/errors/`（应用级 / EIP-1193）。
- **契约语义**：以 [TECHNICAL-SOLUTION.md §5](./TECHNICAL-SOLUTION.md) 为准；类型以仓库内 `packages/shared/src` 为准。
- **产品对照**：[prd-shared.md](../product/prd-shared.md)；整体见 [PRODUCT-OVERVIEW.md](../product/PRODUCT-OVERVIEW.md) §0.2、§0.3。
