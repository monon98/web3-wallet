# OpenCode 项目级配置说明

本仓库 AI 编码配置以 **OpenCode** 为第一目标，**全部为项目级**：文件随仓库提交，克隆后即生效，不依赖任何用户级（全局）配置；配置内容与 [AGENTS.md](../../../AGENTS.md)、[TECHNICAL-SOLUTION.md](../TECHNICAL-SOLUTION.md) 一致。

## 1. 配置布局

| 路径                                                | 作用                                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| [opencode.json](../../../opencode.json)（仓库根）   | 项目配置：`instructions` 加载全仓规则；`watcher.ignore` 排除构建产物                                     |
| [`.opencode/rules/*.md`](../../../.opencode/rules/) | **全仓 always-on 规则**（原 Cursor `alwaysApply` 规则迁入）。目录内所有 `.md` 都会被加载，勿放非规则文件 |
| [AGENTS.md](../../../AGENTS.md)（仓库根）           | 项目地图、常用命令、依赖策略与 Agent 约束                                                                |
| 子目录 `AGENTS.md`（嵌套）                          | **子项目范围规则**（原 Cursor `globs` 规则迁入）：读取对应目录内文件时自动加载，见下节                   |
| [`.vscode/`](../../../.vscode/)                     | 编辑器推荐扩展与保存格式化（与 AI 工具无关，VS Code 通用）                                               |

> OpenCode 会在**读取某目录内文件时**自动加载其 `AGENTS.md`（就近优先、去重）；`.opencode/rules/*.md` 则在会话开始即注入。

## 2. 规则索引

### 全仓规则（[`.opencode/rules/`](../../../.opencode/rules/)）

- `project-core.md`：仓库事实来源、信任边界与入口指引
- `web3-security.md`：Web3 密钥 / 签名 / 桥接安全底线
- `agent-workflow.md`：Agent 工作流习惯（计划 → 落地 → 校验）与抽取落点
- `docs-maintenance.md`：何时更新 product / engineering / runbook 文档
- `code-comments.md`：注释、模块头、JSDoc 的写法与边界
- `file-size-splitting.md`：超过 400 行文件尽量拆分（可读性与可维护性）
- `file-naming-lowercamel.md`：源码文件命名（lowerCamelCase）与例外
- `typescript-conventions.md`：类型出口、`enum`、tsconfig paths 边界

### 子项目规则（嵌套 `AGENTS.md`）

- `apps/extension/AGENTS.md`：扩展架构、路径别名、camelCase 命名细则与 manifest 同步
- `apps/extension/src/extension/utils/bridge/AGENTS.md`：DApp 桥目录结构、类型路径与维护优先级
- `packages/ui/AGENTS.md`：`@plugin/ui` 导出与文档同步（强制）
- `apps/web/AGENTS.md`：Next.js 工具链自动生成，勿手改

## 3. 安全与排除（原 `.cursorignore` 的对应）

- `opencode.json` 的 `watcher.ignore` 排除 `node_modules`、构建产物（`build`、`dist`、`.plasmo`、`.next`、`out`、`coverage`）与 `logs/`，减少无谓的文件监听。
- `.env` 类读取：OpenCode 默认策略对 `*.env` / `*.env.*` 读取**先询问**（`*.env.example` 直接放行）；密钥与助记词仍不得写入规则、文档或提交。

## 4. 维护约定

- **新增全仓规则**：在 `.opencode/rules/` 下新建 `.md`（无 frontmatter，文件内写清 H1 与要点），`instructions` 通配会自动加载；同步更新本文「规则索引」与 [docs/README.md](../../README.md)。
- **新增子项目规则**：在对应目录放置 `AGENTS.md`（不要塞进 `.opencode/rules/`）。
- **何时更新哪类文档**：见 [.opencode/rules/docs-maintenance.md](../../../.opencode/rules/docs-maintenance.md)（含「多轮排障须写入 runbook」）。

## 5. 从 Cursor 迁移的映射（2026-10-19）

| 原（Cursor）                                                                                 | 现（OpenCode）                                                      |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `.cursor/rules/project-core.mdc`                                                             | `.opencode/rules/project-core.md`                                   |
| `.cursor/rules/web3-security.mdc`                                                            | `.opencode/rules/web3-security.md`                                  |
| `.cursor/rules/agent-workflow.mdc`                                                           | `.opencode/rules/agent-workflow.md`                                 |
| `.cursor/rules/docs-maintenance.mdc`                                                         | `.opencode/rules/docs-maintenance.md`                               |
| `.cursor/rules/code-comments.mdc`                                                            | `.opencode/rules/code-comments.md`                                  |
| `.cursor/rules/file-size-splitting.mdc`                                                      | `.opencode/rules/file-size-splitting.md`                            |
| `.cursor/rules/file-naming-lowercamel.mdc`                                                   | `.opencode/rules/file-naming-lowercamel.md`                         |
| `.cursor/rules/typescript-conventions.mdc`                                                   | `.opencode/rules/typescript-conventions.md`                         |
| `.cursor/rules/web3-wallet-extension.mdc` + `.cursor/rules/extension-filename-camelcase.mdc` | `apps/extension/AGENTS.md`                                          |
| `.cursor/rules/extension-bridge-modules.mdc`                                                 | `apps/extension/src/extension/utils/bridge/AGENTS.md`               |
| `.cursor/rules/packages-ui.mdc`                                                              | `packages/ui/AGENTS.md`                                             |
| `.cursorignore`                                                                              | `opencode.json` 的 `watcher.ignore` + OpenCode 默认 `.env` 读取询问 |
| `docs/engineering/cursor/CURSOR-SETUP.md`                                                    | 本文                                                                |

> Cursor 等工具同样读取各级 `AGENTS.md`；但 `.opencode/rules/*.md` 仅 OpenCode 会通过 `instructions` 加载。

## 6. VS Code（可选）

- 推荐扩展：[`.vscode/extensions.json`](../../../.vscode/extensions.json)（Prettier、ESLint）。
- 项目级设置：[`.vscode/settings.json`](../../../.vscode/settings.json)（保存格式化、检索 / 监听排除、ESLint 工作目录）；无需在用户级 `settings.json` 重配。

> 本仓库不修改任何用户级（全局）配置；OpenCode 仅终端界面偏好（主题、按键等）属于用户级 `~/.config/opencode/cli.json`，没有项目级版本，与本仓库规则互不影响。
