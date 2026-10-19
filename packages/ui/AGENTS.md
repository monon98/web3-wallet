# `packages/ui`（`@plugin/ui`）

> 作用域：`packages/ui/**`。OpenCode 在读取本包内文件时自动加载本文件（等效原 Cursor 的 `globs` 范围规则）。

- **事实来源**：子项目说明与组件清单见 [docs/engineering/ui.md](../../docs/engineering/ui.md)；架构边界见 [docs/engineering/TECHNICAL-SOLUTION.md](../../docs/engineering/TECHNICAL-SOLUTION.md)。
- **导出**：新组件在 `src/*.tsx` 实现后，须在 [`packages/ui/src/index.ts`](./src/index.ts) 增加 **`export { … } from './…'`**；**类型**放在 [`packages/ui/src/types/`](./src/types/)（与组件 **同 stem** 的 `.ts`），并在 [`types/index.ts`](./src/types/index.ts) 增加 **`export type * from './新文件'`**。包根已用 **`export type * from './types'`** 统一透出类型，一般**无需**在根 `index.ts` 逐条写类型导出。
- **文档（必做、不询问）**：凡 **新增、重命名、删除** 对外导出或 **改变** 组件的对外语义（props、可访问性约定、是否需要 `'use client'`），须 **在同一轮代码改动中** 更新 [docs/engineering/ui.md](../../docs/engineering/ui.md) 的 **组件清单** 及必要的 **开发与注释约定**；**不要**在回复里问用户「要不要补文档」——默认要补，且已在本规则中约定。
- **风格**：与现有组件一致（Uno 原子类、`Ui*` / `Field*` 命名、JSDoc 见 [.opencode/rules/code-comments.md](../../.opencode/rules/code-comments.md)）。
