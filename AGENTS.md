# 仓库说明（供 Agent / OpenCode）

## OpenCode 配置

项目级配置：根目录 **[opencode.json](opencode.json)**（`instructions` 加载 `.opencode/rules/*.md`、`watcher.ignore` 排除构建产物）与全仓 always-on 规则目录 **[.opencode/rules/](.opencode/rules/)**；子项目细则放各自目录的嵌套 `AGENTS.md`（`apps/extension/`、`packages/ui/`、`apps/extension/src/extension/utils/bridge/`）。说明与规则索引见 **[docs/engineering/opencode/OPENCODE-SETUP.md](docs/engineering/opencode/OPENCODE-SETUP.md)**。**何时更新哪类文档**见 `.opencode/rules/docs-maintenance.md`。

## 项目是什么

四端区块链相关系统，架构与边界以 **[docs/engineering/TECHNICAL-SOLUTION.md](docs/engineering/TECHNICAL-SOLUTION.md)** 为唯一技术事实来源（变更架构时请同步更新该文档文首修订记录）。**产品需求**：整体见 **[docs/product/PRODUCT-OVERVIEW.md](docs/product/PRODUCT-OVERVIEW.md)**；索引与子项目分册见 **[docs/product/PRODUCT-FEATURES.md](docs/product/PRODUCT-FEATURES.md)**。**问题与排障**见 **[docs/runbook/issues-and-solutions.md](docs/runbook/issues-and-solutions.md)**（索引；按主题拆分为 `docs/runbook/*.md`）。全文索引见 **[docs/README.md](docs/README.md)**。

| 部分       | 目录（当前 / 规划）                   | 说明                                                                                                                                                                                                                 |
| ---------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 浏览器插件 | `apps/extension/`                     | **离线本地钱包**；**Plasmo MV3**、React 19、**UnoCSS**、**viem**、**bip39**；**EIP-1193** 通用 DApp、**多钱包档案**；私钥与签名仅在此端；扩展内与钱包无关的纯工具见 `src/extension/utils/common/`（`~lib/common/*`） |
| Web        | `apps/web`（`@plugin/web`）           | **Next.js App Router**、viem、**TanStack Query**；EVM/Tron/BTC 数据以**服务端 API**为主；不持有私钥                                                                                                                  |
| 服务端     | `apps/server`（`@plugin/server`）     | **Fastify**、**多链 ChainGateway**、**批量地址查询**（骨架阶段）；Drizzle/Prisma 按需；不托管用户私钥                                                                                                                |
| 合约       | `packages/contracts/`                 | **Foundry**、Solidity 0.8.x；**不含 BTC**；ABI/地址供各端消费                                                                                                                                                        |
| 共享类型   | `packages/shared`（`@plugin/shared`） | Bridge/API 的 TS 类型与 Zod                                                                                                                                                                                          |
| 共享 UI    | `packages/ui`（`@plugin/ui`）         | 扩展与 Web 共用的轻量 React 组件（UnoCSS 原子类）；见 [docs/engineering/ui.md](docs/engineering/ui.md)                                                                                                               |

**已定四端栈**（细节与开放项见 [docs/engineering/TECHNICAL-SOLUTION.md](docs/engineering/TECHNICAL-SOLUTION.md) 第 1.3 / 4 / 9 节）：插件为 **Plasmo + React + UnoCSS + viem + bip39**（Tron/BTC 插件能力分期）；Web 为 Next + viem + TanStack Query；服务端为 Fastify；合约为 Foundry；仓库 **pnpm** monorepo。**产品扩展**（批量地址查询、Tron、BTC Web/服优先）见 [docs/product/PRODUCT-OVERVIEW.md](docs/product/PRODUCT-OVERVIEW.md) §A。

## 开发时常用命令

- 扩展：在仓库根目录执行 `pnpm dev:extension` / `pnpm build:extension` / `pnpm --filter web3-wallet lint`，或进入 `apps/extension` 后执行同目录 [package.json](apps/extension/package.json) 中的 `pnpm dev` / `pnpm build` / `pnpm lint`。
- Web：`pnpm dev:web`（或 `pnpm --filter @plugin/web dev`）。
- 服务端：`pnpm dev:server`（或 `pnpm --filter @plugin/server dev`）。

## 类型出口约定（全仓）

- 各应用 / 包若有本地类型目录：**`src/types/*.ts` 分文件**（扩展为 **`src/extension/types/*.ts`**）+ **`index.ts`** 唯一聚合，使用 **`export type * from './模块'`**（纯类型再导出）；扩展用 **`~/types`**，Web 用 **`@/types`**。勿用 **`@types`** 作 tsconfig 路径别名。扩展 **DApp 桥** 挂起态等见 **`types/bridge/`**（`~/types/bridge`）；**`utils/bridge/`** 已按子功能分目录，见 [apps/extension/src/extension/utils/bridge/README.md](apps/extension/src/extension/utils/bridge/README.md)。

## 依赖与版本策略

- **同一能力同一库**：链相关 TypeScript 库以 **viem** 为主（扩展 / Web / 服务端一致）；校验与契约以 **Zod**（`@plugin/shared`）为准。
- **版本对齐**：根目录 `package.json` 的 **`pnpm.overrides`** 锁定全仓 **`viem`、`typescript`、`prettier`、`zod`、`@types/node`**（具体版本以该文件为准）；各包 `package.json` 中同名依赖使用**相同显式版本**，升级时改 overrides 与各包一并改。
- **ESLint / typescript-eslint**：在 **shared、server、extension** 中显式对齐（`eslint@9.39.4`、`typescript-eslint@8.46.2` 等）；**Web** 另受 `eslint-config-next` 约束，不对全仓强制覆盖 `typescript-eslint`，以免与 Next 工具链冲突。
- **React**：**Web** 与 **扩展** 均使用 **React 19**（与 `@plugin/ui` 的 `peerDependencies` 一致）；Next 与 Plasmo 各自按官方支持矩阵升级。

## 给 Agent 的约束摘要

- 修改范围紧贴任务；勿为「顺手重构」扩大 diff。
- 密码学材料：助记词/私钥不得进入 Web、服务端代码路径或日志；桥接响应不得包含 `privateKey` / `mnemonic` 明文。
- 风格与工具链与目标子项目现有配置一致（Prettier、ESLint、Plasmo 路径别名 `~` 等）。
- **注释与可读性**：重要或晦涩逻辑必补；**模块头、导出 JSDoc、用户要求「从 0 能读懂」时的自动补强**见 [.opencode/rules/code-comments.md](.opencode/rules/code-comments.md)（与「最小改动」并存：优先写清本次触及的模块与 API）。

## 关键约定（易错点）

- **文件命名**：`src/` 下业务文件统一 **lowerCamelCase**（`walletUiState.ts`），目录同理；仅 `index.ts`、`background.ts` 等框架约定文件例外。
- **TS 路径别名**：**禁止**在 `tsconfig.json` 的 `paths` 声明 `@types` / `@types/*` 指向源码目录（与 npm `@types/*` 冲突）。
- **扩展入口结构**：Plasmo 入口（`background.ts`、`contents/`、`tabs/`）在 `src/` 根；业务逻辑在 `src/extension/`（`utils/`、`web3/`、`background/`、`hooks/`、`ui/`）。
- **扩展 bridge**：`utils/bridge/` 按功能分子目录（`siteConnect/`、`personalSign/`、`typedData/`、`transaction/`），入口仍在根目录的 `handleBridgeMessage.ts` 与 `constants.ts`。
- **共享 UI 变更**：修改 `@plugin/ui` 导出时，**须同步更新** `docs/engineering/ui.md`（同一任务内完成），无需再确认。
- **多轮排障**：若问题经多轮才解决，**必须**在对应 `docs/runbook/*.md` 增补条目（现象、根因、处理步骤）。
- **环境变量**：首次运行需 `cp .env.example .env` 并填写真实值；`SESSION_SECRET`、`ETHERSCAN_API_KEY`、各合约地址 JSON 均为必填或按需填写。
