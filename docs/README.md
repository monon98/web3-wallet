# 文档索引（总项目）

本目录按 **产品 / 工程 / 运行手册** 分层；**子项目**在技术方案与各子目录的「速查」表中交叉引用。仓库级 Agent 说明见根目录 [AGENTS.md](../AGENTS.md)。

**路径迁移（2026-04-05）**：原根下 `docs/TECHNICAL-SOLUTION.md` → [engineering/TECHNICAL-SOLUTION.md](./engineering/TECHNICAL-SOLUTION.md)；`docs/PRODUCT-FEATURES.md` → [product/PRODUCT-FEATURES.md](./product/PRODUCT-FEATURES.md)；`docs/CURSOR-SETUP.md` → [engineering/cursor/CURSOR-SETUP.md](./engineering/cursor/CURSOR-SETUP.md)。

**迁移（2026-10-19）**：AI 编码配置由 Cursor 迁至 OpenCode——`.cursor/rules/*.mdc` → [`.opencode/rules/*.md`](../.opencode/rules/)（由 [opencode.json](../opencode.json) 的 `instructions` 加载）+ 子项目嵌套 `AGENTS.md`；`.cursorignore` → `opencode.json` 的 `watcher.ignore`；`docs/engineering/cursor/CURSOR-SETUP.md` → [engineering/opencode/OPENCODE-SETUP.md](./engineering/opencode/OPENCODE-SETUP.md)。

---

## 1. 产品（需求与功能）

| 路径                                                         | 说明                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------ |
| [product/README.md](./product/README.md)                     | 产品文档入口与子项目对照表                             |
| [product/PRODUCT-FEATURES.md](./product/PRODUCT-FEATURES.md) | 产品文档**索引**                                       |
| [product/PRODUCT-OVERVIEW.md](./product/PRODUCT-OVERVIEW.md) | **整体**：联动、能力域、工程阶段、前置决策、已实现总览 |
| [product/prd-extension.md](./product/prd-extension.md) 等    | **子项目**产品细则（`prd-*.md` 共 5 份）               |

---

## 2. 工程（技术方案、选型、开发文档）

- [engineering/README.md](./engineering/README.md) — 工程文档入口与 **子项目速查表**。
- [engineering/TECHNICAL-SOLUTION.md](./engineering/TECHNICAL-SOLUTION.md) — **四端正式技术方案**（架构、边界、接口、安全）；**§10 现状快照**随代码更新。
- [engineering/opencode/OPENCODE-SETUP.md](./engineering/opencode/OPENCODE-SETUP.md) — OpenCode 项目级配置（`.opencode/rules`、嵌套 `AGENTS.md`）与规则索引；VS Code 推荐设置。
- [engineering/extension.md](./engineering/extension.md) — 子项目：`apps/extension`；**开发态 `extLog*` 前缀与控制台上下文**见 [TECHNICAL-SOLUTION.md](./engineering/TECHNICAL-SOLUTION.md) **§4.1「开发态可观测性」**。
- [engineering/web.md](./engineering/web.md) — 子项目：`apps/web`。
- [engineering/server.md](./engineering/server.md) — 子项目：`apps/server`。
- [engineering/evm-batch-balances.md](./engineering/evm-batch-balances.md) — EVM 多地址原生币/代币批量查询（Multicall、Etherscan、本仓对照）。
- [engineering/shared.md](./engineering/shared.md) — 子项目：`packages/shared`。
- [engineering/contracts.md](./engineering/contracts.md) — 子项目：`packages/contracts`。

---

## 3. 运行手册（问题与解决方式）

| 路径                                                                 | 说明                           |
| -------------------------------------------------------------------- | ------------------------------ |
| [runbook/README.md](./runbook/README.md)                             | Runbook 入口与文档列表         |
| [runbook/issues-and-solutions.md](./runbook/issues-and-solutions.md) | **索引**（链接各主题 runbook） |
| [runbook/toolchain-and-repo.md](./runbook/toolchain-and-repo.md)     | 工具链与仓库                   |
| [runbook/server-evm-etherscan.md](./runbook/server-evm-etherscan.md) | 服务端 EVM / Etherscan         |
| [runbook/extension-mv3.md](./runbook/extension-mv3.md)               | 浏览器扩展 MV3 / Plasmo        |
| [runbook/ci-contracts.md](./runbook/ci-contracts.md)                 | CI / Foundry 合约              |

---

## 4. 归档（历史草案）

| 路径                                     | 说明                                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| [archive/README.md](./archive/README.md) | 早期单端插件规划；**不替代**当前 [engineering/TECHNICAL-SOLUTION.md](./engineering/TECHNICAL-SOLUTION.md) |

---

## 5. Monorepo 与命令（摘要）

| 模式         | 说明                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| `apps/*`     | **应用**：扩展（`apps/extension`，包名 `web3-wallet`）、Web（`@plugin/web`）、服务端（`@plugin/server`） |
| `packages/*` | **包**：`@plugin/shared`、`@plugin/ui`（共享 React UI）、`packages/contracts` 等                         |

- **推荐在仓库根**：`pnpm install`、`pnpm dev:extension` / `pnpm dev:web` / `pnpm dev:server`、`pnpm build`、`pnpm typecheck`、`pnpm lint`（见根 [README.md](../README.md)）。
- **CI**：根目录 [.github/workflows/ci.yml](../.github/workflows/ci.yml)；扩展上架：[extension-store-submit.yml](../.github/workflows/extension-store-submit.yml)。

### OpenCode 规则

全仓规则在 `.opencode/rules/*.md`（由根目录 [opencode.json](../opencode.json) 的 `instructions` 加载）；扩展业务约定见 `apps/extension/AGENTS.md`，共享 UI 见 `packages/ui/AGENTS.md`，桥接细则见 `apps/extension/src/extension/utils/bridge/AGENTS.md`。**何时更新哪类文档**（含**多轮排障须写入 runbook**）见 `.opencode/rules/docs-maintenance.md`。完整配置说明见 [engineering/opencode/OPENCODE-SETUP.md](./engineering/opencode/OPENCODE-SETUP.md)。
