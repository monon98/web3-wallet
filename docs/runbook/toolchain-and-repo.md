# Runbook：工具链与仓库

本文档由团队在排障后**按需追加**；描述中勿包含真实 API Key、私钥或助记词。

**索引**：[issues-and-solutions.md](./issues-and-solutions.md)

---

## AI 编码配置迁移（Cursor → OpenCode）

- **现象**：仓库早期规则与忽略配置面向 Cursor（`.cursor/rules/*.mdc`、`.cursorignore`），OpenCode 不会自动加载。
- **处理**：已迁移为 OpenCode 配置——全仓规则在 [`.opencode/rules/`](../../.opencode/rules/)（由根目录 [opencode.json](../../opencode.json) 的 `instructions` 加载）；子项目规则改为嵌套 `AGENTS.md`（`apps/extension/`、`packages/ui/`、`.../utils/bridge/`）；检索排除改为 `opencode.json` 的 `watcher.ignore`。说明见 [OpenCode 配置](../engineering/opencode/OPENCODE-SETUP.md)。

## 扩展包名与路径不一致

- **现象**：根目录脚本使用 `pnpm --filter web3-wallet`，而物理路径为 `apps/extension`。
- **处理**：以 `apps/extension/package.json` 的 `name` 为准；文档见 [工程文档 · 扩展](../engineering/extension.md)。

## Windows：仓库改名 / 移动后 node_modules 工具链失效（Junction 指向旧路径）

- **现象**：重命名或移动仓库目录后，`pnpm typecheck` / `lint` / `prettier` 等全部报 `Cannot find module ...\node_modules\<包>\...`（如 `apps/server/node_modules/typescript`），即使 `D:\Code\<旧目录>` 已不存在或已改名。
- **根因**：pnpm 在 Windows 以**绝对路径**创建 Junction（`node_modules` 顶层包链接与各 workspace 包内链接），目录改名后链接不随移动更新；`Get-Item <链接> | Format-List LinkType,Target` 可见 Target 仍是旧绝对路径。
- **处理**：在仓库根执行 `$env:CI='true'; pnpm install --frozen-lockfile` 重新链接（store 缺包时会重新下载）。**勿省略 `CI=true`**：pnpm 检测到模块目录不一致时会弹出 “modules directories will be removed and reinstalled from scratch. Proceed?” 交互确认，后台 / 自动化执行会被卡住或中止。

## Web 引用 `@plugin/ui` 时共享组件样式缺失（UnoCSS 未扫描 packages/ui）

- **现象**：`/balances`（原 `/gateway`）等引用 `@plugin/ui` 的 Web 页面中，`PanelSection` 没有内边距、`SelectField` / `TextArea` 没有边框、`UiButton` 只剩文字；DevTools 中元素 class 正常，但 computed `padding` 为 `0`。
- **根因**：扫描路径写在 `apps/web/postcss.config.mjs` 的 `@unocss/postcss` 插件选项 `content` 中；当前 `@unocss/postcss@66.6.7` 只读取 `apps/web/uno.config.ts` 的 `content.filesystem`，**插件选项被忽略**。`apps/web/src` 自身的类仍能生成，而 `../../packages/ui/src` 的类从未进入 CSS，表现为只有共享组件缺样式。
- **处理**：
  1. 在 `apps/web/uno.config.ts` 增加 `content.filesystem`（`./src/**/*.{html,js,ts,jsx,tsx}` 与 `../../packages/ui/src/**/*.{ts,tsx}`），并移除 postcss 插件里的 `content`。
  2. 重启 `pnpm dev:web`（或触发 Turbopack 重新生成 CSS）并刷新页面。
  - 扩展侧一直使用 `apps/extension/uno.config.ts` 的 `content.filesystem`，不受影响。
- **验证**：DevTools 中 `.p-4` / `.block` 等规则存在；`PanelSection` computed padding 为 `16px`，输入框有边框、`UiButton` 有配色。
