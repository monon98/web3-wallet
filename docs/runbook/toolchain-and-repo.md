# Runbook：工具链与仓库

本文档由团队在排障后**按需追加**；描述中勿包含真实 API Key、私钥或助记词。

**索引**：[issues-and-solutions.md](./issues-and-solutions.md)

---

## Plan 模式无法创建 `.mdc` / 部分点文件

- **现象**：在 Cursor Plan 模式下无法自动写入规则或 `.cursorignore`。
- **处理**：关闭 Plan 模式后让 Agent 按 [Cursor 配置说明](../engineering/cursor/CURSOR-SETUP.md) 用编辑器写入；或手动新建文件粘贴模板。

## 扩展包名与路径不一致

- **现象**：根目录脚本使用 `pnpm --filter web3-wallet`，而物理路径为 `apps/extension`。
- **处理**：以 `apps/extension/package.json` 的 `name` 为准；文档见 [工程文档 · 扩展](../engineering/extension.md)。
