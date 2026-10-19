# 子项目：共享 UI（`packages/ui`，`@plugin/ui`）

- **职责**：扩展与 Web **共用的轻量 React 组件**（UnoCSS 原子类，无 CSS-in-JS 运行时）。
- **消费方**：`apps/extension`（Plasmo）、`apps/web`（Next）；两端均需启用 **UnoCSS**，样式类名才会生效。扩展侧 `uno.config.ts` 的 **`content.filesystem` 须包含** `../../packages/ui/src/**/*.{ts,tsx}`，与 Web 的 PostCSS `content` 同理。
- **React 版本**：`peerDependencies` 为 **React ^19**；扩展、Web、`@plugin/ui` 开发与类型以 **19.2.x** 对齐（见各包 `package.json`）。
- **Next.js**：`apps/web/next.config.ts` 已配置 `transpilePackages: ['@plugin/ui']`，以编译工作区 TS 源码。`apps/web/postcss.config.mjs` 中 `@unocss/postcss` 的 **`content` 须包含** `../../packages/ui/src/**/*.{ts,tsx}`（与 `./src/**` 并列）；否则 Web 端引用 `@plugin/ui` 时，组件内原子类不会进入 Uno 生成，**样式会缺失**。
- **暗色与 Web**：`apps/web/uno.config.ts` 使用 **`presetWind3({ dark: 'media' })`**，使 `dark:` 与 `globals.css` 的 **`prefers-color-scheme: dark`** 一致；扩展侧仍为默认（`dark:` 依赖 `.dark` 祖先，侧栏浅色底时通常不触发）。`PanelSection`、表单控件、`UiButton` 的 `outline`、`FieldHint` 等含 **`dark:`** 适配，便于 Web 在系统暗色下可读。
- **入口**：实现放在 `packages/ui/src/*.tsx`；共享 **类型** 放在 [`packages/ui/src/types/`](../../packages/ui/src/types/)（与组件 **同 stem** 的 `.ts`，如 `button.tsx` ↔ `types/button.ts`），[`types/index.ts`](../../packages/ui/src/types/index.ts) 以 **`export type * from './…'`** 聚合。包根 [`index.ts`](../../packages/ui/src/index.ts)：**`export type * from './types'`** + 各组件 **`export { … } from './…'`**（新增组件须登记实现与类型两处）。

## 组件清单（与 `index.ts` 同步维护）

| 组件                 | 源文件                   | 说明                                                                                      |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| `UiAlert`            | `alert.tsx`              | 块级提示（错误 / 成功 / 信息 / 中性）；`error` 为 `role="alert"`，与行内 `FieldHint` 区分 |
| `UiBadge`            | `badge.tsx`              | 小号状态标签，多语义色                                                                    |
| `UiButton`           | `button.tsx`             | 按钮，多 `variant` / `size`；**白字仅配深底**，浅底用深色字（`outline` 等）               |
| `CollapsibleSection` | `collapsibleSection.tsx` | 可折叠区块；**含** `'use client'`，可在 App Router 中直接使用                             |
| `UiDivider`          | `divider.tsx`            | 语义化水平分隔线（`hr`）                                                                  |
| `FieldHint`          | `fieldHint.tsx`          | 表单项下方说明或校验文案；`error` 时使用 `role="alert"`                                   |
| `FieldLabel`         | `fieldLabel.tsx`         | 表单项标签                                                                                |
| `FeedbackBanner`     | `feedbackBanner.tsx`     | 通用反馈条：基于 `UiAlert` 的块级提示；`text` 为空时不渲染                                |
| `InlineEditableText` | `inlineEditableText.tsx` | 内联编辑文本：展示/编辑切换、Enter 提交、Escape 取消                                      |
| `PanelSection`       | `panelSection.tsx`       | 带标题/描述的面板容器；`title` 可为 `ReactNode`（如标题旁加 `UiTipBubble`）               |
| `SegmentedControl`   | `segmentedControl.tsx`   | 分段切换：用 `UiButton` 的 `outline/outlineActive` 实现                                   |
| `UiTipBubble`        | `tipBubble.tsx`          | 悬停/聚焦显示的提示气泡（`role="tooltip"`）；默认圆形「?」触发器，与块级 `UiAlert` 区分   |
| `SelectField`        | `selectField.tsx`        | 样式统一的 `<select>`                                                                     |
| `UiSpinner`          | `spinner.tsx`            | 内联加载指示器（依赖 Uno 的 `animate-spin`）                                              |
| `TableShell`         | `tableShell.tsx`         | 表格外壳：统一滚动/边框/背景等基础样式                                                    |
| `TextArea`           | `textArea.tsx`           | 多行输入                                                                                  |
| `TextInput`          | `textInput.tsx`          | 单行输入                                                                                  |

上表每一行的 **Props / variant 类型** 均在 `src/types/` 中与组件 **同名 stem** 的 `.ts` 内声明（如 `types/panelSection.ts` 对应 `panelSection.tsx`）。

## 开发与注释约定

- **命名**：交互类、品牌感强的原子组件使用 **`Ui` 前缀**（如 `UiButton`、`UiBadge`）；表单配套使用 **`Field` 前缀**（如 `FieldLabel`、`FieldHint`）。与现有文件保持一致，避免同目录多种风格混用。
- **类型目录**：Props / variant 等放在 **`src/types/*.ts`**，由 **`src/types/index.ts`** 聚合；包根 **`index.ts`** 使用 **`export type * from './types'`** 再导出全部类型（与全仓 `src/types` 约定一致）。
- **主题 tokens（必须遵守）**：`@plugin/ui` 组件的颜色/边框/背景**优先读取** `--ui-*` CSS Variables（Design Tokens），避免硬编码 `bg-emerald-*` / `text-neutral-*` 等具体色阶（除非非常局部且写清原因）。两端（Web/Extension）各自的全局样式负责提供 tokens。\n+ - **写法**：在 Uno 类名中用 arbitrary values，例如 `bg-[var(--ui-surface-1)]`、`text-[var(--ui-fg)]`、`border-[var(--ui-border)]`。\n+ - **暗黑**：由 `.dark` 覆盖 tokens 值；组件内一般不再写 `dark:*` 分支（除非与 tokens 无关的布局/动效）。\n+- **样式**：仅用 **UnoCSS 工具类**字符串拼接（与现有组件相同），不在包内引入 CSS-in-JS 或全局 CSS。`PanelSection` 正文字号默认 **`text-sm`**、标题 **`text-base`**，内边距 **`p-4`**，与扩展/Web 可读性一致。
- **客户端组件**：仅在有 hook / 浏览器状态时加 **`'use client'`**（当前仅 `CollapsibleSection`）。
- **注释**：导出类型与组件上，对**非显而易见**的语义、可访问性、与 Uno 预设的耦合等使用 **JSDoc 或简短中文注释**（与 [code-comments.md](../../.opencode/rules/code-comments.md) 一致）；禁止在注释中写入密钥、助记词等敏感内容。
- **文档同步**：**新增、重命名或删除**对外导出时，**须在同一任务内**更新本文 **「组件清单」** 表，使与 `index.ts` 一致；**无需向用户确认**是否写文档（见 [.opencode/rules/docs-maintenance.md](../../.opencode/rules/docs-maintenance.md) 与 [packages/ui/AGENTS.md](../../packages/ui/AGENTS.md)）。

## 主题样式规范（Design Tokens）

### 暗黑模式约定

- Web 与 Extension 均使用 **dark class**：当根节点（推荐 `html`）存在 `.dark` 时进入暗色主题。\n+ - UnoCSS：两端 `presetWind3({ dark: 'class' })`。\n+ - Tokens：浅色在 `:root`，暗色在 `.dark` 里覆盖同名 `--ui-*`。\n+

### Token 表（语义优先）

> 这些变量在 Web 的 `apps/web/src/app/globals.css` 与 Extension 的 `apps/extension/src/assets/style.css` 中定义；数值需保持一致。\n+

- **基础**\n+ - `--ui-bg`：页面背景（`body`）\n+ - `--ui-fg`：默认正文色\n+ - `--ui-surface-1`：主要卡片/容器底（如 `PanelSection` default）\n+ - `--ui-surface-2`：次级底（muted 容器、hover 底、提示背景等）\n+ - `--ui-border`：默认边框色\n+ - `--ui-muted-fg`：次要文字（说明、hint、弱化信息）\n+\n+- **交互与状态**\n+ - `--ui-primary` / `--ui-primary-hover` / `--ui-primary-active` / `--ui-on-primary`\n+ - `--ui-danger` / `--ui-danger-hover` / `--ui-danger-active` / `--ui-on-danger`\n+ - `--ui-info` / `--ui-warning` / `--ui-success`\n+\n+- **形状与阴影**\n+ - `--ui-radius-sm` / `--ui-radius-md` / `--ui-radius-lg`\n+ - `--ui-shadow-sm` / `--ui-shadow-md`\n+
