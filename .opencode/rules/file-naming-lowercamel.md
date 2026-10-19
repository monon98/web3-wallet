# 文件命名（lowerCamelCase）

## 目标

- 让源码文件名可预测、可检索、跨端一致（避免同一概念出现 `snake_case`、`kebab-case`、`PascalCase` 混用）。

## 规则（默认）

- **业务源码文件**（尤其是各包/应用的 `src/**`、`app/**` 下的 `.ts` / `.tsx`）：文件名使用 **lowerCamelCase（小驼峰）**，例如 `walletUiState.ts`、`handleBridgeMessage.ts`、`useAccountProfile.ts`。
- **目录名**：业务目录优先使用 **lowerCamelCase**（例如 `walletUi/`、`bridgeInbox/`）。若该子项目已有既定风格，则以该子项目现状为准。

## 允许的例外（保持生态习惯 / 工具链默认）

- **聚合出口**：`index.ts` / `index.tsx` 固定小写 `index`。
- **行业/框架入口**：某些框架约定或历史原因导致的固定文件名（例如扩展端 `background.ts`、Next/工具链约定文件、配置文件等）保持原样，不强行改名以免破坏构建/路由/插件识别。
- **非源码文件**：如 `README.md`、`AGENTS.md`、`OPENCODE-SETUP.md`、`eslint.config.mjs`、`tsconfig.json` 等遵循社区与仓库现有命名惯例。

## 扩展端更严格规则

- `apps/extension` 里的细则（包括 Plasmo 入口例外、manifest 同步点、以及 `unicorn/filename-case` 配置）以
  [apps/extension/AGENTS.md](../../apps/extension/AGENTS.md)
  为准。
