# 工程与技术文档（总项目）

面向 **架构、技术选型、接口契约、子项目实现约定**。

| 文档 / 目录                                                | 说明                                                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| [TECHNICAL-SOLUTION.md](./TECHNICAL-SOLUTION.md)           | **四端正式技术方案**（信任边界、§4 各端、§5 接口、§9 开放决策）；变更架构时更新 §0 修订记录         |
| [BACKLOG.md](./BACKLOG.md)                                 | **待实现事项与优先级**（P0–P4）；完成一项后同步状态、修订记录与子项目文档                           |
| [security.md](./security.md)                               | **安全自检清单**（P4-2 / P4-3 等）：密钥边界、CORS、CSRF、会话 / 限流、日志脱敏、依赖审计与发布隐私 |
| [evm-batch-balances.md](./evm-batch-balances.md)           | EVM 多地址原生币/代币批量查询：Multicall、Etherscan 与本仓服务端对照                                |
| [opencode/OPENCODE-SETUP.md](./opencode/OPENCODE-SETUP.md) | OpenCode / VS Code 项目级配置（`.opencode/rules`、嵌套 `AGENTS.md`）与规则索引                      |
| 下文「子项目速查」                                         | 各 `apps/*`、`packages/*` 一页入口，细节仍以技术方案正文为准                                        |

## 子项目速查

| 子项目                    | 路径                 | 速查                                                                                           |
| ------------------------- | -------------------- | ---------------------------------------------------------------------------------------------- |
| 浏览器扩展                | `apps/extension`     | [extension.md](./extension.md)；**日志索引**（§4.1 [开发态可观测性](./TECHNICAL-SOLUTION.md)） |
| Web                       | `apps/web`           | [web.md](./web.md)                                                                             |
| 服务端                    | `apps/server`        | [server.md](./server.md)                                                                       |
| 共享类型与契约            | `packages/shared`    | [shared.md](./shared.md)                                                                       |
| 共享 UI（React + UnoCSS） | `packages/ui`        | [ui.md](./ui.md)                                                                               |
| 智能合约                  | `packages/contracts` | [contracts.md](./contracts.md)                                                                 |
