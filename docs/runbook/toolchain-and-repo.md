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
