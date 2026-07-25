# Cursor 完整配置说明（无命令行落地）

在 **Plan 模式** 下，工具可能无法自动创建 `.mdc` / `.json` 等非 Markdown 文件。请任选其一：

1. **关闭 Plan 模式** 后，在对话里说明「按 `docs/engineering/cursor/CURSOR-SETUP.md` 创建所有 Cursor 配置文件」，由 Agent 用编辑器写入（**不用终端**）。
2. **手动**：在资源管理器中新建下列路径的文件，将对应代码块整段复制进去保存。

配置与 [AGENTS.md](../../../AGENTS.md)、[TECHNICAL-SOLUTION.md](../TECHNICAL-SOLUTION.md) 一致。**文档分层索引**见 [docs/README.md](../../README.md)；变更架构/产品/踩坑时参见 [.cursor/rules/docs-maintenance.mdc](../../../.cursor/rules/docs-maintenance.mdc)。

### 落地状态（维护时可更新）

- 已创建：`.cursor/rules/*.mdc`（含 `docs-maintenance`、`packages-ui`、**`agent-workflow`（含扩展 `utils/common` 等抽取落点）**、**`code-comments`（模块头 / JSDoc / 用户要求可读性时的自动补强）**、`extension-filename-camelcase`（扩展源码 camelCase 命名）、**`file-naming-lowercamel`（全仓源码 lowerCamelCase 命名）** 等）、`.vscode/extensions.json`、`.vscode/settings.json`（含检索/监听排除与 ESLint 工作目录）。
- **`.cursorignore`**：请在仓库根创建（与 `package.json` 同级），内容见 **§1**（含 `node_modules` / 构建产物 / **`.env` 排除与 `!.env.example`**）；部分环境工具无法写入该文件名时需手动新建。

---

## 1. 仓库根：`.cursorignore`

路径：`.cursorignore`（与 `package.json` 同级）

```
# 减小索引体积、加快 Cursor 检索（语法类似 .gitignore）
**/node_modules/**
**/build/**
**/.plasmo/cache/**
**/dist/**
**/coverage/**
**/.next/**
**/out/**

# 环境变量与本地密钥：避免进入 Cursor 索引与 AI 上下文
.env
.env.*
!.env.example
**/.env
**/.env.*
!**/.env.example

# 服务端本地日志（可能含请求细节）
**/logs/**
```

---

## 2. Cursor 规则：`.cursor/rules/project-core.mdc`

```
---
description: 四端项目范围、技术文档入口与通用协作方式
alwaysApply: true
---

# 项目核心上下文

- 正式技术方案见 [docs/engineering/TECHNICAL-SOLUTION.md](mdc:docs/engineering/TECHNICAL-SOLUTION.md)。涉及架构、接口边界、安全模型时先对照该文档。
- 当前已实现代码主要在 [apps/extension](mdc:apps/extension)；Web、服务端、合约、shared 包按文档阶段规划落地。
- 信任边界：解密后的私钥与助记词仅在浏览器扩展内；Web 与服务端不得持久化或传输明文密钥材料。
- 共享的 API / Bridge 类型目标放在 `packages/shared`（存在后优先从这里引用，避免各端重复定义）。
- 文件命名：源码文件默认使用 lowerCamelCase（小驼峰）；例外见 `.cursor/rules/file-naming-lowercamel.mdc`。
- 改动保持最小必要范围；命名、导入风格与相邻文件一致。用户未要求时不要新增无关 markdown 文档。
```

---

## 2.1 `.cursor/rules/file-naming-lowercamel.mdc`

```
---
description: 全仓通用：源码文件命名（lowerCamelCase）与少量例外
alwaysApply: true
---

# 文件命名（lowerCamelCase）

## 目标

- 让源码文件名可预测、可检索、跨端一致（避免同一概念出现 `snake_case`、`kebab-case`、`PascalCase` 混用）。

## 规则（默认）

- 业务源码文件（尤其是各包/应用的 `src/**`、`app/**` 下的 `.ts` / `.tsx`）：文件名使用 lowerCamelCase（小驼峰），例如 `walletUiState.ts`、`handleBridgeMessage.ts`、`useAccountProfile.ts`。
- 目录名：业务目录优先使用 lowerCamelCase（例如 `walletUi/`、`bridgeInbox/`）。若该子项目已有既定风格，则以该子项目现状为准。

## 允许的例外（保持生态习惯 / 工具链默认）

- 聚合出口：`index.ts` / `index.tsx` 固定小写 `index`。
- 行业/框架入口：某些框架约定或历史原因导致的固定文件名（例如扩展端 `background.ts`、Next/工具链约定文件、配置文件等）保持原样，不强行改名以免破坏构建/路由/插件识别。
- 非源码文件：如 `README.md`、`AGENTS.md`、`CURSOR-SETUP.md`、`eslint.config.mjs`、`tsconfig.json` 等遵循社区与仓库现有命名惯例。

## 扩展端更严格规则

- `apps/extension` 里的细则以 `.cursor/rules/extension-filename-camelcase.mdc` 为准。
```

---

## 3. `.cursor/rules/web3-wallet-extension.mdc`

```
---
description: Plasmo 浏览器扩展（apps/extension）约定
globs: apps/extension/**/*
alwaysApply: false
---

# 扩展子项目

- 栈：Plasmo（Chrome MV3）、React 19、TypeScript、UnoCSS、viem、bip39；脚本见 [package.json](mdc:apps/extension/package.json)。
- 路径别名：扩展见 `apps/extension/tsconfig.json`（`~lib/*`、`~/components/*`、`~/hooks/*`、`~/types`、`~web3` 等）；Plasmo 入口仍在 `src/` 根，业务代码在 `src/extension/` 下分组。
- 敏感能力（解密、签名、持久化密钥）应经 **background / 统一 messaging** 收敛，避免在 content script 或任意页面上下文直接持有长期明文密钥。
- 格式化与 Lint：使用子项目内 Prettier / ESLint；`pnpm format`、`pnpm lint`。
- UI 文案与注释可与现有文件一致使用中文。
```

---

## 4. `.cursor/rules/web3-security.mdc`

```
---
description: 密钥、签名与链交互的安全底线（全仓库）
alwaysApply: true
---

# Web3 安全底线

- 禁止在 Web 应用、服务端代码或 API 响应中写入「接收并存储用户助记词/私钥」的逻辑（非托管模式）。
- 禁止 `console.log` / 日志 / 错误上报中包含私钥、助记词、未脱敏的 seed；扩展内调试日志须在合入前移除或脱敏。
- 扩展与网页桥接：校验消息来源（origin / extension id）；对用户展示可读的签名摘要（链、合约、金额、地址）后再确认。
- RPC URL、API Key 等放环境变量，勿硬编码进仓库；示例用占位符并在 `.env.example` 中说明。
```

---

## 5. `.cursor/rules/code-comments.mdc`

```
---
description: 生成/修改代码时对重要或晦涩处补充注释（全仓库）
alwaysApply: true
---

# 注释与可读性（Agent 生成代码时）

- **何时写注释**：业务与安全意图不明显、算法或非显而易见分支、对外契约（HTTP/Bridge/ABI）、限流/重试/兼容性折中、临时 workaround（注明原因或 issue）。
- **何时不写**：变量名与类型已能表达含义的单行逻辑；重复代码字面意思的废话注释。
- **写法**：紧挨相关代码块上方用简短中文或英文（**与当前文件、相邻注释语言一致**）；必要时 1～3 行；导出函数若签名不足以表达约束，用 **JSDoc** 说明参数、返回值、抛错或副作用。
- **边界**：注释中**不得**出现真实密钥、助记词、未脱敏隐私数据；与 web3-security 规则一致。
- **与「最小改动」并存**：仅在新写或本次改动的片段上补注释，不要为「全盘加注释」做大范围无关 diff。
```

---

## 6. `.cursor/rules/packages-ui.mdc`

**作用域**：`packages/ui/**/*`（编辑 `@plugin/ui` 时自动附着）。

要点：**新增/变更对外导出**须在同一任务内更新 [ui.md](../ui.md) 的组件清单；**不要**询问用户是否写文档。全文见仓库内该 `.mdc` 文件。

---

## 7. `.vscode/extensions.json`

```json
{
  "recommendations": ["esbenp.prettier-vscode", "dbaeumer.vscode-eslint"]
}
```

---

## 8. `.vscode/settings.json`

若你已有自定义设置，请把下面 **新增键** 合并进现有 JSON（不要删掉你原来的条目）。

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "[jsonc]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.formatOnSave": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/build": true,
    "**/.plasmo": true,
    "**/dist": true,
    "**/.next": true,
    "**/out": true
  },
  "files.watcherExclude": {
    "**/node_modules/**": true,
    "**/build/**": true,
    "**/.plasmo/**": true,
    "**/dist/**": true
  },
  "eslint.workingDirectories": [{ "mode": "auto" }]
}
```

---

## 9. 已有文件

- **[AGENTS.md](../../../AGENTS.md)**：项目地图与 Agent 约束（已存在则无需改路径以外的内容）。
- **技术方案**：[TECHNICAL-SOLUTION.md](../TECHNICAL-SOLUTION.md)。
- **产品文档**：[PRODUCT-OVERVIEW.md](../../product/PRODUCT-OVERVIEW.md)（整体）、[PRODUCT-FEATURES.md](../../product/PRODUCT-FEATURES.md)（索引）。
- **文档索引**：[README.md](../../README.md)（含 `archive/`、`runbook/` 说明）。

---

## 10. 可选（用户级 Cursor 设置）

若需改 **全局** 编辑器行为（字体、Tab、保存等），在用户 `settings.json` 中配置即可；项目级以 `.vscode/settings.json` 为准。
