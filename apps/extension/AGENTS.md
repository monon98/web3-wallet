# 扩展子项目（`apps/extension`）

> 作用域：`apps/extension/**`。OpenCode 在读取该目录内文件时自动加载本文件（等效原 Cursor 的 `globs` 范围规则）。

## 技术栈与目录约定

- 栈：Plasmo（Chrome MV3）、React 19、TypeScript、UnoCSS、viem、bip39；脚本见 `apps/extension/package.json`。
- **`zod` 版本（构建约束）**：根 `package.json` 保留全局 `zod@3.25.76` 供 ESLint 工具链使用，并用 scoped override **`"@plugin/shared>zod": "3.24.2"`** 让扩展实际打包使用 3.24.2；**不要**移除该 override 或把 `@plugin/shared` 升到 3.25+，否则 Plasmo/Parcel 会把 zod 的 `./v3/external.js` 当 external，导致 popup / sidepanel 白屏（见 `docs/runbook/extension-mv3.md`）。
- 路径别名：见 `apps/extension/tsconfig.json`（`~lib/*` → `src/extension/utils/*`、`~/components/*` → `src/extension/ui/*`、`~/hooks/*`、`~/types`、`~/constants`、`~web3` 等）。
  **扩展内无业务语义的纯工具**在 **`src/extension/utils/common/**`**（按文件导入，如 `~lib/common/csvEscape`），抽取落点与 [.opencode/rules/agent-workflow.md](../../.opencode/rules/agent-workflow.md)「抽取落点约定」一致。
**类型仅从 `~/types` 引用**（`src/extension/types/index.ts` 用 **`export type _ from './…'`** 聚合子文件）。
**禁止**在 `tsconfig.json`的`paths` 里声明 **`@types`/`@types/_`** 指向源码类型目录，见 `docs/runbook/extension-mv3.md`。
- **`src/tabs/*`（新标签页）与 viem / 重逻辑**：`tabs/` 内需要 `toHex`、`getAddress` 等时 **`import { … } from '~web3'`**，**勿**写 **`from 'viem'`**。
  链上 HD / 批量地址派生实现放在 **`src/extension/web3/`**（`~web3/base/hd/*`、`~web3/evm/addressGenerator`、`~web3/tvm/tvmAddressGenerator`、`~web3/btc/*`）。
  与 `tabs` 同 Parcel 图的组合逻辑放在 **`src/extension/utils/`**（如 `generateAccountsTabHelpers.ts`），避免 Parcel 仅拆 **`tabs/`** 子 chunk 时出现 **`… is not a function`**。说明见 `docs/runbook/extension-mv3.md`。
- **文件名（camelCase）**：`src` 下 `.ts` / `.tsx` 实现与类型文件统一 **小驼峰**；`index.ts`、`background.ts` 等例外与 **`contentScriptWhitelist` ↔ manifest 同步** 见下文「文件命名细则」与 `eslint.config.mjs`。
- **与 Web 共用的原子 UI**（按钮、表单控件、折叠区块等）放在 **`@plugin/ui`**（`packages/ui`），勿在扩展内重复实现，细则见 `packages/ui/AGENTS.md`；扩展专有布局在 **`src/extension/ui/`**（如 `ui/wallet/`）。
- **类型**：业务与桥接等 TypeScript 类型放在 **`src/extension/types/`**（按域分文件，`index.ts` 统一导出）；**DApp 桥挂起态与 handler** 见 **`types/bridge/`**（`~/types/bridge`）。实现文件优先 `import type { … } from '~/types'`，避免在 `ui/`、`utils/` 内散落 `export type`（`@plugin/shared` / `@plugin/ui` 类型仍从原包引用）。
- **DApp 桥**：按功能分子目录（`utils/bridge/siteConnect|personalSign|typedData|transaction`），入口 **`handleBridgeMessage.ts`** 与 **`constants.ts`** 留在 `bridge/` 根；细则见 `src/extension/utils/bridge/AGENTS.md` 与 `bridge/README.md`。
- 业务逻辑在 **`src/extension/utils/`**（bridge、vault、`walletUi`、extension 壳层等）、**`src/extension/web3/`**、**`src/extension/background/`**；Plasmo 入口（`background.ts`、`contents/`、`tabs/`）仍在 **`src/`** 根下。
- 敏感能力（解密、签名、持久化密钥）应经 **background / 统一 messaging** 收敛，避免在 content script 或任意页面上下文直接持有长期明文密钥。
- 格式化与 Lint：Prettier、ESLint、stylelint（CSS）；`pnpm format`、`pnpm lint`、`pnpm stylelint`。
- UI 文案与注释可与现有文件一致使用中文。

## 文件命名（camelCase）细则

- **`apps/extension/src` 下** TypeScript / TSX **实现与类型文件**（含 `contents/`、`tabs/`、`extension/**`）文件名使用 **camelCase**（小驼峰）：首段小写字母，后续单词首字母大写，如 `allUrls.ts`、`handleBridgeMessage.ts`、`walletUiState.ts`、`contentScriptWhitelist.ts`。
- **聚合出口**：各目录的 **`index.ts`** / **`index.tsx`** 保持小写 `index`，由 ESLint `unicorn/filename-case` 的 `ignore` 放行。
- **Plasmo 根入口**（`background.ts`、`popup.tsx`、`sidepanel.tsx`、`devtools.tsx`）维持与官方示例一致的文件名；**`background.ts`** 为单词全小写，与 `unicorn/filename-case` 的 camelCase 约定并存，已在 `eslint.config.mjs` 中 **`ignores`** 排除误报。
- **资源目录**：全局样式等放在 **`src/assets/`**（`import '~/assets/style.css'`），勿使用 `asserts` 等易混拼写。
- **钱包领域目录**：持久态与只读 RPC 实现在 **`src/extension/utils/walletUi/`**（camelCase 目录名），导入使用 **`~lib/walletUi/...`**；日志模块为 **`extensionLog.ts`**（`~lib/extensionLog`）。

### 与 manifest 同步

- **`contentScriptWhitelist.ts`** 中 **`CONTENT_SCRIPT_MATCH_PATTERNS`** 须与 **`package.json` → `manifest.web_accessible_resources[0].matches`**（及按需的 **`host_permissions`**）保持同源；Chrome manifest 不能从 TS 自动推导。

### 工具链

- 校验：`apps/extension` 下执行 **`pnpm lint`**（依赖 `eslint.config.mjs` 中 **`unicorn/filename-case`**）。
- 更完整的扩展路径别名见 **`apps/extension/tsconfig.json`**。
