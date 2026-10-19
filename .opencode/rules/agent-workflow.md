# Agent 工作流（本仓库推荐）

## 先计划，后大改

- **涉及跨目录/跨端/大量引用改动**（例如抽公共组件、移动目录、重构 hooks）：先给出 **可执行计划**（分阶段、可回滚、小步 typecheck）。
- **保持最小必要改动**：不做“顺手重构”；每一步只解决一个明确目标，避免 diff 失控。

## 抽取落点约定（结合本仓库结构）

- **基础 UI（可跨端复用、无业务语义）**：下沉到 `packages/ui`（`@plugin/ui`）
  - 新增组件必须同步：`packages/ui/src/index.ts`、`packages/ui/src/types/index.ts`、`docs/engineering/ui.md`
- **业务通用组件（钱包域、EVM/TVM 复用，但仍属于扩展业务）**：放在 `apps/extension/src/extension/ui/common/**`
- **扩展内通用纯工具（无钱包业务语义：CSV 转义、浏览器下载等）**：放在 `apps/extension/src/extension/utils/common/**`，经 `~lib/common/<文件名>` 引用；**跨端**（扩展 + Web + 服务端）再评估下沉到 `packages/*` 新包并走 workspace 依赖。
- **链上派生 / Web3 工具**：放在 `apps/extension/src/extension/web3/**`（`~web3/...`）；**本地加密存储与解密签名**：放在 `apps/extension/src/extension/utils/vault/**`（`~lib/vault/...`）。其余业务逻辑在 `hooks/**` 等，除非用户明确要求做更深层的工厂化/架构升级。

## Windows / PowerShell 习惯（避免无谓卡住）

- **不要在 PowerShell 下用 `&&` 串联命令**；改为两条命令分别执行，或用 `;`（若允许）。
- **Prettier/CRLF 类 lint**：优先用 `pnpm --filter <pkg> exec eslint . --fix` 统一修复，再复跑 lint。

## 校验闭环（每个阶段都要能站住）

- **改完关键模块就校验**：优先在目标子项目内跑 `lint` + `typecheck`（例如扩展：`--filter web3-wallet`；UI 包：`--filter @plugin/ui`）。
- **新增文件/抽公共组件后**：确保所有导入路径与导出入口已更新，避免“编译通过但运行缺组件”的问题。
