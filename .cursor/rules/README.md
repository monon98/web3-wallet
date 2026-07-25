# `.cursor/rules` 索引

这些文件是给 Cursor Agent 的“长期约束/约定”。一般情况下：

- **全仓通用且必须遵守**：`alwaysApply: true`
- **仅对特定子项目生效**：设置 `globs`，通常 `alwaysApply: false`

## 全仓（alwaysApply）

- `project-core.mdc`：仓库事实来源、信任边界与入口指引
- `web3-security.mdc`：Web3 密钥/签名/桥接安全底线
- `agent-workflow.mdc`：Agent 工作流习惯（计划→落地→校验）与抽取落点
- `docs-maintenance.mdc`：何时更新 product / engineering / runbook 文档
- `code-comments.mdc`：注释、模块头、JSDoc 的写法与边界
- `file-size-splitting.mdc`：超过 400 行文件尽量拆分（可读性与可维护性）
- `file-naming-lowercamel.mdc`：源码文件命名（lowerCamelCase）与例外
- `typescript-conventions.mdc`：类型出口、`enum`、tsconfig paths 边界

## 子项目（globs）

- `web3-wallet-extension.mdc`：扩展（`apps/extension`）架构/目录/路径别名约定
- `extension-filename-camelcase.mdc`：扩展源码文件命名细则与 manifest 同步点
- `packages-ui.mdc`：`@plugin/ui` 导出与文档同步（强制）
