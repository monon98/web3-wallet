# Runbook：浏览器扩展（MV3）

本文档由团队在排障后**按需追加**；描述中勿包含真实 API Key、私钥或助记词。

**索引**：[issues-and-solutions.md](./issues-and-solutions.md)

---

## Service Worker 生命周期与长连接

- **现象**：MV3 background 为 service worker，可能被休眠；长连接设计需考虑重连。
- **处理**：关键状态落 `chrome.storage`；消息设计为可重试、可幂等；实现以 `apps/extension/src/background.ts` 为准，重大约束可在此文件追加条目。

## Plasmo / Parcel：`Failed to resolve '../../src/*.tsx' from '.plasmo/static/…'`（monorepo + `engines.node`）

- **现象（2026-04）**：`pnpm dev:extension` 或 `plasmo build` 报错，例如：
  - `Failed to resolve '../../src/devtools.tsx' from './apps/extension/.plasmo/static/devtools.tsx'`
  - 同类：`popup.tsx`、`sidepanel.tsx` 等由 Plasmo 生成的 `.plasmo/static` 入口无法解析到 `src/` 下真实文件；日志里可能伴随 `Error parsing JSON`。
- **根因**：Parcel 会把带 **`engines.node`** 的 `package.json` 当成 **Node** 侧打包上下文；在 **pnpm monorepo** 里若**根目录**单独声明 `engines.node`，子包 Plasmo 构建仍可能错误解析 `.plasmo/static` 下的相对路径（与 [parcel-bundler/parcel#7636](https://github.com/parcel-bundler/parcel/issues/7636#issuecomment-1059401129)、[Plasmo #750](https://github.com/PlasmoHQ/plasmo/issues/750)、[#1040](https://github.com/PlasmoHQ/plasmo/issues/1040) 等讨论一致）。仅加 `targets.default.engines.browsers` 有时仍不够，需避免「根包单独 `engines.node`」与扩展构建冲突。
- **处理（已落地）**：
  1. **`apps/extension/package.json`**：同时保留 **`engines.node`**（如 `>=20`）与 **`targets.default.engines.browsers`**（如 `last 2 Chrome versions, not dead`），满足 Parcel「同一包内 Node engines + 浏览器 target」组合。
  2. **仓库根** `package.json`：保留 **`targets.default.engines.browsers`**（Parcel 向上读根时仍有浏览器 target），**不要**在根上单独写 **`engines.node`**（Node 版本约定改由扩展子包、`packageManager` 与 [AGENTS.md](../../AGENTS.md) / CI 说明承担）。
  3. 备选：按社区反馈在出问题的包上**临时去掉** `engines.node` 或去掉根目录 `main` 等非扩展字段（见 #750 / #1040）。
- **相关**：若仍异常，清空 `apps/extension/.plasmo` 后重试；注意 **Windows 上 `EBUSY ... parcel/data.mdb`** 时需先**结束所有 `plasmo dev` 进程**再删缓存或 build。
- **补充（2026-04）**：若已按上表配置 `engines` / `targets` 仍报同类 **`.plasmo/static` → `../../src/*.tsx`** 解析失败，请检查 **`tsconfig.json` 的 `paths` 是否使用了 `@types` 别名**（见下节）。

## `tsconfig` 的 `paths` 勿使用 `@types` / `@types/*` 别名

- **现象（2026-04）**：`plasmo build` / `plasmo dev` 报错 `Failed to resolve '../../src/devtools.tsx'`（或 `popup.tsx`、`sidepanel.tsx` 等）**来源为** `./apps/extension/.plasmo/static/…`，而 `src/` 下对应文件存在；`tsc --noEmit` 仍可通过。
- **根因**：在 `apps/extension/tsconfig.json` 的 `compilerOptions.paths` 中配置 **`"@types"`**、**`"@types/*"`** 指向本地 `src/types` 时，会与 npm 生态中 **`@types/*` 作用域包**（及 Parcel/TypeScript 解析逻辑）冲突，导致 Parcel 对 Plasmo 生成的静态入口所依赖的相对路径解析失败。
- **处理（已落地）**：删除上述 `paths` 条目；扩展内类型统一用 **`~/types`**（即 `~*` → `./src/*`）。勿再以 `@types` 作为路径别名。

## Plasmo：inpage / MAIN 世界脚本（勿依赖 `url:./inpageEvm.ts`）

- **现象（历史）**：从 `src/contents/allUrls.ts` 使用 `import … from 'url:./inpageEvm.ts'`（或跨目录 `url:`）时，构建报错如 `Failed to resolve 'url:./inpageEvm.ts'`；日志里有时伴随 `Error parsing JSON`。
- **根因**：[Plasmo 文档](https://docs.plasmo.com/framework/content-scripts#importing-resources) 中 **`url:`** 面向的是打包后的资源（示例为 **`.js`**）；对 **`.ts` 源**走 `url:` 在本仓库的 Parcel/Plasmo 链路上不可靠；与 monorepo 下 Parcel 路径/engines 问题叠加时更易失败。
- **处理（已落地）**：**不再**在隔离脚本里用 `url:` 注入 inpage。将页面内 provider 放在 **[`apps/extension/src/contents/inpageEvm.ts`](../../apps/extension/src/contents/inpageEvm.ts)**，导出 **`export const config = { …, world: 'MAIN' }`**，由 Plasmo 按 [MAIN world 内容脚本](https://docs.plasmo.com/framework/content-scripts#injecting-into-the-main-world) 注入；隔离世界桥接仍在 **[`allUrls.ts`](../../apps/extension/src/contents/allUrls.ts)**。工程说明见 [engineering · extension.md](../engineering/extension.md)「内容脚本与 DApp 桥接」。

## 开发模式：`inpageEvm` 控制台 `postMessage` / WebSocket 与 `unhandledRejection`

- **现象（2026-04）**：宿主页面或 Next dev 终端出现 **`TypeError: Cannot read properties of undefined (reading 'postMessage')`**，堆栈在 **`chrome-extension://…/inpageEvm*.js`**，且伴随 **`WebSocket.<anonymous>`**。
- **根因**：`plasmo dev` 下 Parcel 会把 **HMR（热更新）** 相关运行时打进浏览器端包；**MAIN 世界**内容脚本拿不到扩展的 `chrome.*` 等上下文，HMR 里若假设存在「父窗口 / 通道」上的 `postMessage`，可能在部分页面（含本地 Web dev）里得到 **`undefined.postMessage`**，表现为未捕获的 Promise 拒绝。
- **处理**：
  1. **业务上**：钱包桥接侧已对 **`window.postMessage`** 做存在性检查与 **try/catch**（见 [`inpageEvm.ts`](../../apps/extension/src/contents/inpageEvm.ts)、[`allUrls.ts`](../../apps/extension/src/contents/allUrls.ts)）；不透明 **`location.origin`** 时对同源回退使用 **`targetOrigin: '*'`**（与隔离脚本收消息仍兼容）。
  2. **排障**：若需**干净控制台**，用 **`pnpm build`**（或 `plasmo build`）打正式包再 **加载已解压扩展** 验证；开发态下该报错**多数不影响** EIP-1193 与桥接功能，可忽略。
  3. **参考**：[Plasmo · MAIN world 与 messaging 限制](https://github.com/PlasmoHQ/plasmo/issues/1061)、[HMR / WSL 等问题](https://github.com/PlasmoHQ/plasmo/issues/1166)。

## 扩展页 / 新标签页：`tiny-secp256k1` 与 `fs.readFileSync`、`generatorLimits` 未定义

- **现象（2026-04）**：在 **`tabs/*.html`** 等浏览器上下文中：
  - **`wasm_loader.cjs`：`(0 , fs_1.readFileSync) is not a function`**（或同类 WASM 加载失败）；
  - **`Cannot read properties of undefined (reading 'ADDRESS_GENERATOR_TAB_BATCH_MAX')`**（历史：标签页 helpers 经旧路径 `generatorLimits` 与 `tabs` 拆块环导致；常量现统一在 **`~/constants`**（`extension/constants/walletLimits.ts`），无 `import`）。
- **根因**：
  1. **`tiny-secp256k1`** 的 Node 侧 WASM 加载会走 **`fs.readFileSync`**，在扩展页 bundle 中无可用 `fs`，见 [bitcoinjs/bitcoinjs-lib#2106](https://github.com/bitcoinjs/bitcoinjs-lib/issues/2106)。
  2. Plasmo/Parcel 将 **`tabs/*`** 与 **`utils/*` / `web3/*`** 打成复杂依赖图时，对共享常量模块的解析可能出现**环或初始化顺序**，导致该模块命名空间在首帧为 **`undefined`**。
- **处理（已落地）**：
  1. **`bitcoinjs-lib` 的 `initEccLib`**：改用浏览器友好的 **`@bitcoinerlab/secp256k1`**（见 `apps/extension/src/extension/web3/btc/btcAddressGenerator.ts`），**不要**在扩展 UI 侧依赖 **`tiny-secp256k1`**。
  2. **批量上限常量**：只维护 **`apps/extension/src/extension/constants/walletLimits.ts`**（`~/constants`）；**勿**在 `tabs/` 与 `web3/` 间复制多份数值。
  3. **标签页派生逻辑**：**`generateAccountsTabHelpers.ts`** 放在 **`extension/utils/`**（`~lib/generateAccountsTabHelpers`），由 **`tabs/generateAccounts.tsx`** 引用——与 **`~/constants`**、`~web3` 同 Parcel 依赖图，避免仅 **`tabs/`** 子 chunk 时 **`buildGeneratedTableRows is not a function`**（命名导出未挂上）。
  4. **多批累积导出**：页面支持「生成 → 加入导出列表」多次后统一导出；CSV 为固定宽表头（可混合 EVM/TVM/BTC）；JSON 可选 **`envelope`**（`schema: address-generator/v1`、`exportedAt`、`rowCount`、`rows`）或 **`flat`** 纯数组，并可在 UI 勾选字段子集。

## 新标签页（`tabs/*`）：直接 `import 'viem'` 与 `Cannot find module '<hash>'`

- **现象（2026-04）**：`tabs` 侧独立 chunk 运行时 **`Cannot find module '6dfwG'`**（或类似哈希 id），堆栈落在 **`viem`**；或 **`buildGeneratedTableRows is not a function`**（helpers 与 `vault`/`viem` 拆块后模块未完整初始化）。
- **根因**：Plasmo/Parcel 对 **`tabs/` 入口拆出的子 chunk** 单独解析 **`viem` 包图**（`exports` / 条件子路径）时，偶发 **子依赖 id 解析失败**；**重逻辑 helpers 若仅放在 `tabs/` 目录**，与 `~lib/vault` 组合时更易出现导出丢失。
- **处理（已落地）**：
  1. **`toHex` 等**：在 **`tabs/**`** 内写 **`import { … } from '~web3'`**，不要 **`from 'viem'`**（见 `src/extension/web3/evm/viem.ts`）。
  2. **批量派生 / 导出**：实现放在 **`~lib/generateAccountsTabHelpers`**（`extension/utils/`），标签页只做 UI 组合。

## Plasmo / Parcel：弹窗或侧边栏白屏，控制台 `(0,o.z).enum is not a function`

- **现象（2026-10）**：扩展工具栏弹窗或网页右键「打开侧边栏」后**白屏**；页面正文为空，DevTools 在 `popup.*.js` / `sidepanel.*.js` 报：
  - `TypeError: (0, o.z).enum is not a function`
  - 堆栈落在 `@plugin/shared` 的 `bridgeMethodSchema`（或同一 `zod` 模块的其他 schema）。
- **根因**：`zod@3.25.76` 使用多层 ESM 入口（`index.js` → `./v3/external.js`）。Plasmo 0.90.5 内置的 Parcel 2.9.3 在扩展页 bundle 中把该**相对依赖**解析成 `false`（external），运行时 `z` 变成空对象，首个 `z.enum()` 即抛错。弹窗与侧边栏都引用 `@plugin/shared`，因此同时白屏；`tabs/*` 页面也会受影响。
- **处理（已落地）**：
  1. 根 `package.json` 继续用全局 `pnpm.overrides.zod = 3.25.76`，供 `eslint-plugin-react-hooks` / `zod-validation-error`（peer 要求 `^3.25.0`）使用；另加 **scoped override** `"@plugin/shared>zod": "3.24.2"`，让扩展实际打包的 `@plugin/shared` 使用 **`3.24.2`**（单文件 `lib/index.mjs`，Parcel 可正常打包）。
  2. `packages/shared/package.json` 的 `zod` 依赖声明保持 **`3.24.2`**，与 scoped override 一致。
  3. 执行 `pnpm install`；若 **`plasmo dev`** 正在运行，**结束并重启**（必要时删除 `apps/extension/.plasmo`），再重新构建 / 重载扩展。
  4. 在弹窗、侧边栏和任一 `tabs/*` 页面的 DevTools 确认控制台无上述异常。
- **升级注意**：不要把 `@plugin/shared>zod` 直接升到 `3.25+`。升级前先检查构建产物中是否出现 `"./v3/external.js":!1`（external 标记），或在浏览器实测 popup / sidepanel；必要时改用 Parcel 兼容的 CJS 入口，或等待 Plasmo/Parcel 修复。
- **验证（2026-10）**：用本地 Chromium 分别加载 `build/chrome-mv3-prod` 与 `build/chrome-mv3-dev`，直接打开 `chrome-extension://<id>/popup.html`、`sidepanel.html`、`tabs/welcome.html`、`tabs/evmAccounts.html` 与 `tabs/generateAccounts.html`，页面正文均正常渲染，控制台无异常（dev 仅保留 Plasmo HMR 连接日志）。

## Plasmo / Parcel：已删除的 `tabs/*.ts` 仍报 `ENOENT … stat` / `open`

- **现象（2026-04）**：`plasmo dev` / `plasmo build` 报错，例如：
  - `ENOENT: no such file or directory, stat '…\src\tabs\tabAddressGeneratorConstants.ts'`
  - 同类：`generateAccountsHelpers.ts` 等**已从仓库移除**的路径；`rg`/IDE 在源码里已搜不到引用。
- **根因**：**`apps/extension/.plasmo`**（及 Parcel 的 **`parcel/data.mdb`** 等）里仍保留**旧依赖图**；重命名或把逻辑迁出 `tabs/` 后，缓存未失效会继续 `stat` 旧文件。
- **处理**：
  1. **结束**本机所有 **`plasmo dev` / `pnpm dev:extension`**（及占用该目录的 Node 进程），否则 Windows 上删除 `.plasmo` 可能报 **`EBUSY … data.mdb`**。
  2. 删除 **`apps/extension/.plasmo`**；必要时再删 **`apps/extension/node_modules/.cache`** 后重跑 **`pnpm --filter web3-wallet build`**（或根目录 **`pnpm build:extension`**）。
  3. **不要**为消错单独恢复已删除的 `tabs` 侧 helpers 文件（会回到拆块 / `viem` 子 chunk 问题）；以清缓存为准。
