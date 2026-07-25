# 子项目：共享包（`packages/shared`，`@plugin/shared`）

- **职责**：Bridge 信封、HTTP/EVM explorer 等 **Zod 与 TypeScript 类型**；各端引用避免重复定义。
- **Bridge 信封**：[`src/bridge/envelope.ts`](../../packages/shared/src/bridge/envelope.ts)；扩展在网页侧的实现与**开发态调试日志**（`extLog*`）索引起 [TECHNICAL-SOLUTION.md §4.1](./TECHNICAL-SOLUTION.md)「开发态可观测性」、细节见 [extension.md](./extension.md)。
- **EVM 演示内置链**：[`src/evm/builtin-demo-chains.ts`](../../packages/shared/src/evm/builtin-demo-chains.ts) 列出扩展 `wallet_*` / 只读 RPC 与 Web `wallet-demo` 应共用的 **链 ID、名称、主币符号**（不含 RPC URL；扩展侧由 viem 链定义绑定）。
- **契约语义**：以 [TECHNICAL-SOLUTION.md §5](./TECHNICAL-SOLUTION.md) 为准；类型以仓库内 `packages/shared/src` 为准。
- **产品对照**：[prd-shared.md](../product/prd-shared.md)；整体见 [PRODUCT-OVERVIEW.md](../product/PRODUCT-OVERVIEW.md) §0.2、§0.3。
