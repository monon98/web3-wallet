# 子项目：浏览器扩展（`apps/extension`）

- **包名（pnpm filter）**：`web3-wallet`（与磁盘路径 `apps/extension` 不同，属历史命名）。
- **本地类型**：`src/extension/types/*.ts`，聚合出口 **`src/extension/types/index.ts`**（`export type * from './…'`）；引用 **`~/types`**（见 `tsconfig.json` 的 `paths`）。**无依赖数值常量**（如批量上限）见 **`extension/constants/`**，引用 **`~/constants`**。
- **栈**：Plasmo MV3、React 19、UnoCSS、viem、bip39（详见 [TECHNICAL-SOLUTION.md §4.1](./TECHNICAL-SOLUTION.md)）。
- **`zod` 构建约束**：根 `pnpm.overrides` 的全局 `zod@3.25.76` 供 ESLint / `zod-validation-error` 使用；扩展经 scoped override **`"@plugin/shared>zod": "3.24.2"`** 打包 **3.24.2**。不要直接移除该 override 或把 `@plugin/shared` 升到 3.25+，否则 Parcel 会把 zod 的 `./v3/external.js` external 化，导致 popup / sidepanel 白屏；详见 [runbook · extension-mv3.md](../runbook/extension-mv3.md)。
- **打开方式**：工具栏图标默认打开 **popup**（`popup.tsx` / `action.default_popup`）；侧栏（`sidepanel.tsx`）通过网页右键菜单「打开侧边栏」进入。Service Worker 启动时显式调用 `sidePanel.setPanelBehavior({ openPanelOnActionClick: false })` 重置旧版本可能持久化的 `true` 状态；不要再改为 `true`，否则会覆盖 popup 的点击行为。
- **面板与 hooks 源文件命名（钱包）**：`src/extension/ui/wallet/**`、`src/extension/hooks/**` 下 `*.ts(x)` 使用 **camelCase**（小驼峰），如 `walletPanelRoot.tsx`、`useWalletPanel.ts`；聚合出口 `index.ts` 除外。由 `eslint.config.mjs` 中 `unicorn/filename-case`（`camelCase`）约束；Plasmo 入口（如 `sidepanel.tsx`、`popup.tsx`、`background.ts`）保持框架约定文件名。
- **OpenCode 范围规则**：`apps/extension/AGENTS.md`（读取 `apps/extension/**` 内文件时自动加载）。
- **当前实现线索**：`src/background.ts`（侧载 `extension/background/serviceWorker.ts`）、`src/contents/`（见下文「内容脚本与 DApp 桥接」）、`src/extension/utils/`（bridge / vault / wallet-ui 等）、`src/extension/ui/`（面板等扩展专有 UI）、`src/extension/hooks/`；**类型**仅从 **`~/types`** 聚合；与 Web 共用的表单/按钮等见 [**@plugin/ui**](./ui.md)。现状摘要见技术方案 **§4.1「当前代码基线」** 与 **§10**。Plasmo / Parcel 构建踩坑见 [runbook · extension-mv3.md](../runbook/extension-mv3.md)。
- **开发态调试日志**：[`src/extension/utils/extensionLog.ts`](../../apps/extension/src/extension/utils/extensionLog.ts)；**按控制台上下文分组的前缀索引表**见 [TECHNICAL-SOLUTION.md](./TECHNICAL-SOLUTION.md) **§4.1** 小节「开发态可观测性（扩展日志索引）」。`NODE_ENV !== 'production'` 时在 **Service Worker** 控制台输出 `bridge_*` / `bridge_handler_reject` / `site_connect_blocked` / `personal_sign_blocked` / `typed_data_sign_blocked` / `runtime_*`（如 `runtime_approve_site_connect`）/ `unlock_session` / `sw_lifecycle` / `tab_sessions_revoked` / `side_panel_open` / `side_panel_open_failed` / `approval_popup_create_failed` / `connect_approval_address` / `readonly_rpc_error` / `custom_chain_coerce` / `site_session` / `wallet_chain_set` / `vault_bundle_coerce` / `resolve_*` / `reject_*` / `*_deferred` / `approval_popup_*` 等；隔离脚本 [`allUrls.ts`](../../apps/extension/src/contents/allUrls.ts) 输出 `cs_bridge_*`；MAIN 世界 [`inpageEvm.ts`](../../apps/extension/src/contents/inpageEvm.ts) 输出 `inpage_bridge_*`（均在**页面开发者工具**中选对应扩展帧 / 上下文查看；侧栏与弹窗 UI 另有 `panel_*`、`panel_action`、`wallet_ui_pruned`（读状态时修剪会话）；**独立审批窗口**（`site-connect` / `sign-personal` / `sign-typed-data` / `sign-send-transaction`）另有 `tab_*`）。**不得**记录口令、助记词、私钥与待签原文（与 [web3-security](../../.opencode/rules/web3-security.md) 一致）。生产构建默认静默。

## 源码目录（`src/`）

| 路径                                                                                           | 内容                                                                                                                              |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `background.ts`、`popup.tsx`、`sidepanel.tsx`、`contents/`、`tabs/`、`devtools.tsx`、`assets/` | Plasmo 约定的入口与页面资源，**保持在 `src/` 根下**（全局样式等：`import '~/assets/style.css'`）                                  |
| [`extension/hooks/`](../../apps/extension/src/extension/hooks/)                                | 钱包 React hooks（`~/hooks/*`）                                                                                                   |
| [`extension/ui/`](../../apps/extension/src/extension/ui/)                                      | 扩展专有 React UI（`~/components/*`）                                                                                             |
| [`extension/types/`](../../apps/extension/src/extension/types/)                                | 本地类型（`~/types`）；**Vault 形状**（含 EVM + TVM）集中在 [`vault.ts`](../../apps/extension/src/extension/types/vault.ts)       |
| [`extension/constants/`](../../apps/extension/src/extension/constants/)                        | 无 `import` 的共享数值常量（`~/constants`，如 [`walletLimits.ts`](../../apps/extension/src/extension/constants/walletLimits.ts)） |
| [`extension/utils/`](../../apps/extension/src/extension/utils/)                                | bridge、**vault**（加密账户包与签名）、`walletUi`、extension 壳层、`extensionLog`（`~lib/*`）                                     |
| [`extension/web3/`](../../apps/extension/src/extension/web3/)                                  | 链上工具：`hd`、`evm`/`tvm`/`btc` 批量地址、bip39 演示（`~web3`）                                                                 |
| [`extension/background/`](../../apps/extension/src/extension/background/)                      | Service Worker 实现体（由根目录 `background.ts` 侧载）                                                                            |

### `vault` 与 `web3` 目录边界（扩展内）

| 目录                                               | 放什么                                                                                                                         | 典型模块                                                                      |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| **`src/extension/utils/vault/`**（`~lib/vault/*`） | **本地钱包信任域**：加密存储、解密签名、账户包读写、**background 内存解锁态**；**不**放「纯链上派生 / 批量生成地址」实现。     | `record`、`tvmRecord`、`crypto`、`signing`、`unlockSession`、`unlockSettings` |
| **`src/extension/web3/`**（`~web3`、`~web3/...`）  | **链上与密码学工具**：EVM HD 路径与地址派生、TVM/BTC 批量地址、`viem`/`bitcoinjs-lib` 等；**不**写 `chrome.storage` 账户密文。 | `base/hd/derive`、`evm/addressGenerator`、`tvm/tvmAddressGenerator`、`btc/*`  |

**新增代码时**：侧栏导入校验、标签页多链生成、批量路径展开等 → 扩展现有 **`web3`** 子路径或在其旁新增文件；**不要**再向 `vault` 增加地址生成器类模块。需要落盘或解密时，在 **`vault`** 调用 **`web3`** 的纯函数完成派生后再加密写入。

---

## 内容脚本与 DApp 桥接（对照仓库实现）

Plasmo 约定见官方文档：[Content Scripts · Injecting into the main world](https://docs.plasmo.com/framework/content-scripts#injecting-into-the-main-world)（`world: "MAIN"`）、以及同页的 [Importing resources · `url:`](https://docs.plasmo.com/framework/content-scripts#importing-resources)（示例为打包后的 **`.js`** 资源 URL）。

### 两个内容脚本、两个 JavaScript 世界

| 文件                                                                          | 执行世界             | `PlasmoCSConfig`（与代码一致）                                                                                                                                                                                                              | 职责                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`src/contents/allUrls.ts`](../../apps/extension/src/contents/allUrls.ts)     | **隔离世界**（默认） | `matches` 与 [`contentScriptWhitelist.ts`](../../apps/extension/src/extension/utils/extension/contentScriptWhitelist.ts) 中 **`CONTENT_SCRIPT_MATCH_PATTERNS`** 一致（**非** `<all_urls>`），`run_at: 'document_start'`，`all_frames: true` | 监听页面 **`window.postMessage`**（来源为同源 `window`）；校验 `source` 后与 **background** 通过 `chrome.runtime.sendMessage` 转发桥接请求；把结果 **`postMessage` 回页面**。 |
| [`src/contents/inpageEvm.ts`](../../apps/extension/src/contents/inpageEvm.ts) | **主世界（MAIN）**   | 同上，并 **`world: 'MAIN'`**                                                                                                                                                                                                                | 在页面真实上下文中暴露 **EIP-1193** provider（如 `window.ethereum`）、**EIP-6963** 宣告；通过 **`postMessage`** 向隔离世界脚本发起 `bridge-request`。                         |

两者均在 `document_start`、且 `all_frames: true`，与多 iframe 页面上的 DApp 行为一致。

**注入白名单**：`CONTENT_SCRIPT_MATCH_PATTERNS` 默认覆盖 **localhost / 127.0.0.1** 及常见本地开发端口；**`package.json` → `manifest.web_accessible_resources[0].matches`** 须与之一致（Chrome manifest 无法从 TS 引用）。对接公网 DApp 时，在 `contentScriptWhitelist.ts` 中追加对应 `https://…/*` 或 `https://*.…/*` 模式，并同步 **`web_accessible_resources`**（必要时同步 **`host_permissions`** 中面向该站点的条目）。

### 消息常量与信任边界（与 `~lib/bridge/constants` 一致）

实现见 [`src/extension/utils/bridge/constants.ts`](../../apps/extension/src/extension/utils/bridge/constants.ts)：

- **`WEB3_WALLET_POSTMESSAGE_INPAGE_SOURCE` / `WEB3_WALLET_POSTMESSAGE_CONTENT_SOURCE`**：`postMessage` 信封上的 `source` 字段，inpage 与隔离脚本彼此识别，**须与页面/扩展内实现保持字符串一致**。
- **`WEB3_WALLET_BRIDGE_RUNTIME_CHANNEL`**：`chrome.runtime.sendMessage` 的通道名；background 侧对该 channel 的请求体做解析与路由（见 [`handleBridgeMessage.ts`](../../apps/extension/src/extension/utils/bridge/handleBridgeMessage.ts)）。
- **`BRIDGE_POSTMESSAGE_KIND_PENDING`**：需用户在扩展 UI 中确认时，background 先返回挂起；隔离脚本将该 kind 转发给 inpage，并注册 `chrome.runtime.onMessage` 等待最终结果。
- **`RUNTIME_MSG_DEFERRED_BRIDGE_RESULT`**：审批完成后 background 发往 tab 的消息类型，隔离脚本用于结束挂起并 **`postMessage`** 最终 `bridge-response`。

**依赖边界**：隔离脚本使用 `@plugin/shared` 的 **`parseBridgeRequest`** 等解析桥接信封；inpage 侧**避免**引入会把 Node/大包打进页面上下文的依赖；当前除 **`~lib/bridge/constants`** 外仅引入 **`~lib/extensionLog`**（薄 `console` 封装，与文件头注释一致）。

### 为何不用 `url:` 再注入 `<script src>`

Plasmo 文档中 **`url:`** 用于拿到扩展内某**资源**的 URL（文档示例为 **`something.js`**）。在本仓库的 Parcel/Plasmo 组合下，对 **`.ts` 源**使用 `url:./inpageEvm.ts` 曾出现解析失败；**当前实现**改为 **`inpageEvm.ts` 作为独立内容脚本并声明 `world: 'MAIN'`**，与官方推荐一致，也避免重复维护「注入 + web_accessible_resources」路径。排障记录见 [runbook · extension-mv3.md](../runbook/extension-mv3.md)。

### EIP-1193 当前能力（与实现一致）

实现集中在 [`handleBridgeMessage.ts`](../../apps/extension/src/extension/utils/bridge/handleBridgeMessage.ts)（`eip1193_request` 内联或委托）。

| 能力                                                                  | 说明                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eth_chainId` / `net_version` / `eth_accounts`                        | 读当前持久化网络与站点会话账户                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `eth_blockNumber`                                                     | 读当前链的最新区块号（内置链走 viem 公共 RPC，自定义链走用户配置的 RPC）；**无需**站点已连接                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `eth_requestAccounts`                                                 | 挂起 → [`siteConnect`](../../apps/extension/src/tabs/siteConnect.tsx) 选**已导入的**本地账户并授权；**无账户时无法完成连接**；已授权后若会话被清空则返回未授权错误（[`pendingSiteConnect`](../../apps/extension/src/extension/utils/bridge/siteConnect/pendingSiteConnect.ts)）                                                                                                                                                                                                                                              |
| `wallet_switchEthereumChain` / `wallet_addEthereumChain`              | 可切换到 `@plugin/shared` 的 [`WALLET_BUILTIN_EVM_CHAINS`](../../packages/shared/src/evm/builtinEvmChains.ts)，或侧栏「网络与自定义 RPC」中**用户已确认**的自定义链；`wallet_addEthereumChain` **不会**自动写入未知链（DApp 传入的 `rpcUrls` 不作为信任来源），未知链返回 **4902**；链解析见 [`readonlyEvmRpc.ts`](../../apps/extension/src/extension/utils/walletUi/readonlyEvmRpc.ts)                                                                                                                                      |
| `eth_getBalance`                                                      | 须站点已连接；经 [`fetchEthGetBalanceHex`](../../apps/extension/src/extension/utils/walletUi/readonlyEvmRpc.ts) 使用当前链 RPC                                                                                                                                                                                                                                                                                                                                                                                               |
| `personal_sign`                                                       | 须站点已连接、签名地址与会话账户一致、且该地址存在**本地加密账户**；挂起 → [`signPersonal`](../../apps/extension/src/tabs/signPersonal.tsx)（[`personalSignBridge`](../../apps/extension/src/extension/utils/bridge/personalSign/personalSignBridge.ts)、[`pendingPersonalSign`](../../apps/extension/src/extension/utils/bridge/personalSign/pendingPersonalSign.ts)）；锁定态输入**导入时加密口令**，解锁态（默认空闲 15 分钟）免口令但仍须点确认                                                                          |
| `eth_sign`                                                            | 参数 `[address, data]`（`data` 为 hex）；内部转为与 `personal_sign` 相同的挂起与签名路径（[`personalSignBridge`](../../apps/extension/src/extension/utils/bridge/personalSign/personalSignBridge.ts)）；**高危接口**，展示与 `personal_sign` 一致                                                                                                                                                                                                                                                                            |
| `eth_signTypedData` / `eth_signTypedData_v3` / `eth_signTypedData_v4` | 参数 `[address, typedData]`（`typedData` 为 JSON 字符串或对象，须含 `domain` / `types` / `primaryType` / `message`）；约束同 `personal_sign`；挂起 → [`signTypedData`](../../apps/extension/src/tabs/signTypedData.tsx)（[`typedDataSignBridge`](../../apps/extension/src/extension/utils/bridge/typedData/typedDataSignBridge.ts)、[`pendingTypedDataSign`](../../apps/extension/src/extension/utils/bridge/typedData/pendingTypedDataSign.ts)）；viem [`signTypedData`](https://viem.sh/docs/actions/wallet/signTypedData) |
| `eth_sendTransaction`                                                 | 参数 `[tx]`；挂起 → [`signSendTransaction`](../../apps/extension/src/tabs/signSendTransaction.tsx)（[`sendTransactionBridge`](../../apps/extension/src/extension/utils/bridge/transaction/sendTransactionBridge.ts)）；返回 **交易哈希** 或 **已签名 RLP** 由侧栏全局 **`evmTxSubmitMode`**（[`walletUiState`](../../apps/extension/src/extension/utils/walletUi/walletUiState.ts)）决定                                                                                                                                     |
| `eth_signTransaction`                                                 | 参数 `[tx]`；挂起同上弹窗；**固定**仅返回已签名 RLP（不受 `evmTxSubmitMode` 影响）                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `eth_sendRawTransaction`                                              | 参数 `[serializedTx]`；须站点已连接；由 [`broadcastSignedRawTransaction`](../../apps/extension/src/extension/utils/walletUi/readonlyEvmRpc.ts) 经当前链配置的 RPC 广播，**无需**口令（交易已离线签好）                                                                                                                                                                                                                                                                                                                       |
| 互斥                                                                  | **连接挂起**、**`personal_sign` / `eth_sign` 挂起**、**EIP-712 挂起**、**`eth_sendTransaction` / `eth_signTransaction` 挂起**四者不能同时进行；`RUNTIME_MSG_*` 见 [`constants.ts`](../../apps/extension/src/extension/utils/bridge/constants.ts)                                                                                                                                                                                                                                                                             |

仍未实现或受限：**Tron DApp**（`tronweb` + TronLink 风格注入）仅技术方案已定，**代码未接**。

### 网络与自定义 RPC 链（P2-3）

- **入口**：侧栏「DApp 全局设置 → 网络与自定义 RPC」([`customEvmChainsSection.tsx`](../../apps/extension/src/extension/ui/wallet/sections/customEvmChainsSection.tsx))；可切换内置链，或新增 / 编辑 / 删除最多 **20** 个本地自定义 EVM 网络。
- **存储**：[`customEvmChains.ts`](../../apps/extension/src/extension/utils/walletUi/customEvmChains.ts) 使用 `chrome.storage.local['web3_wallet_custom_evm_chains_v1']`；RPC URL 可能含节点访问 key，因此**不写日志**，侧栏列表只展示 host。
- **保存校验**：Chain ID 须为安全正整数，且不能与内置链或已有自定义链重复；RPC URL 仅允许 **HTTPS**，或 `localhost` / `127.0.0.1` 的 **HTTP**，拒绝内嵌用户名 / 密码与 `#fragment`；新增网络或修改 RPC URL 时调用 `eth_chainId`，返回值与填写值不一致时不写入（仅改名 / 符号可复用原校验结果）。
- **生效范围**：自定义链进入 `eth_getBalance` / `eth_blockNumber` / `eth_sendRawTransaction` 与 `eth_sendTransaction` / `eth_signTransaction` 的当前链路径；审批弹窗仍展示交易 / typed data 摘要，并须用户确认。
- **DApp 边界**：`wallet_switchEthereumChain` 只能切到已配置的内置 / 自定义链；`wallet_addEthereumChain` 不自动落库，未知链返回 **4902**。这样恶意页面不能把用户静默切到未确认的 RPC。
- **信任边界**：`eth_chainId` 校验只能发现配置不一致，不能证明节点诚实；自定义 RPC 仍可看到公开地址、查询与已签名交易广播，属用户显式信任决策。

### 已连接站点管理（P2-6）

- **入口**：侧栏「DApp 全局设置 → 已连接网站」（[`connectedSitesSection.tsx`](../../apps/extension/src/extension/ui/wallet/sections/connectedSitesSection.tsx)），沿用 [`walletUiState`](../../apps/extension/src/extension/utils/walletUi/walletUiState.ts) 的 `siteAuthSessions`，支持单站 / 全部断开。
- **搜索**：不区分大小写，匹配 origin 与暴露地址；空格分隔的多个词须全部命中（如 `uniswap 0xabc`）。
- **分组**：不分组、按暴露地址、按授权范围（持久 / 定时 / 仅当前标签）；按地址分组时站点数多的组优先。
- **导出**：CSV 仅导出**当前筛选结果**，字段为站点 origin、公开 EVM 地址、授权范围、标签页 ID 与 ISO 过期时间；带 UTF-8 BOM，并对公式起始字符做转义。导出不包含私钥、助记词、口令、RPC URL 或其他钱包配置。
- **代码落点**：[`connectedSitesView.ts`](../../apps/extension/src/extension/utils/walletUi/connectedSitesView.ts) 负责筛选 / 分组 / 范围文案 / CSV 生成，UI 只负责状态与展示。

### 首次安装 / 升级引导（P4-3）

- **入口**：[`tabs/welcome.tsx`](../../apps/extension/src/tabs/welcome.tsx)（构建为 `tabs/welcome.html`）；侧栏概览「安全与使用指南」可随时打开。
- **触发**：[`onboarding.ts`](../../apps/extension/src/extension/utils/extension/onboarding.ts) 在 `chrome.runtime.onInstalled` 的 `install` / `update` 事件打开引导页。安装时前台打开，升级时后台打开；同一版本只自动打开一次，避免开发态重载反复弹页。
- **去重状态**：`chrome.storage.local['web3_wallet_onboarding_launch_v1']` 只保存最近一次自动打开的 `lastVersion`；不包含账户、密钥或 RPC 配置。
- **页面内容**：离线备份、逐笔签名核对、本地口令解密、自定义 RPC 信任边界、隐私说明（本地数据 / RPC 通信 / 无遥测）与 manifest 权限用途；页面不读取账户，不要求输入助记词 / 私钥 / 口令。
- **页面参数**：`mode=install|update`、`version`、可选 `from`（升级前版本）；无参数时按手动查看指南展示。
- **上架物料**：商品文案、截图脚本与发布清单见 [extension-store-listing.md](../product/extension-store-listing.md)；隐私政策草稿见 [extension-privacy-policy.md](../product/extension-privacy-policy.md)。实际提交仍需公开 HTTPS 隐私政策 URL、支持链接与无敏感数据的截图。
- **已知边界**：`host_permissions` 当前包含 `https://*/*` 以支持用户配置任意 HTTPS RPC；商店审核可能要求解释，后续可评估 optional host permissions。

### 账户解锁与自动锁定（P2-2）

- **缓存位置**：[`unlockSession.ts`](../../apps/extension/src/extension/utils/vault/unlockSession.ts) 仅在 **background 内存**保存解密后的 viem 账户，按签名地址隔离；不写 `chrome.storage` / `chrome.storage.session`，不暴露给 content script、网页或侧栏。
- **TTL**：默认空闲 **15 分钟**，侧栏「DApp 全局设置 → 账户解锁」可调整为 **1–120 分钟**（[`unlockSettings.ts`](../../apps/extension/src/extension/utils/vault/unlockSettings.ts)）。成功签名 / 广播后重新计时；读取状态不会延长 TTL。
- **手动锁定**：侧栏「立即锁定全部」发送 `RUNTIME_MSG_LOCK_UNLOCKED_ACCOUNTS`，清空全部内存缓存。
- **重新验证**：TTL 过期、手动锁定、账户已从 vault 删除、Service Worker 休眠 / 浏览器重启后，`personal_sign` / `eth_sign`、EIP-712、交易签名都会要求重新输入口令。
- **审批 UI**：[`useSignerUnlockStatus`](../../apps/extension/src/extension/hooks/useSignerUnlockStatus.ts) 每 10 秒读取当前地址状态；解锁时隐藏口令输入，锁定或提交返回 `unlock_required` 时恢复输入。
- **边界**：这是**进程内会话解锁**，不是跨浏览器会话的持久解锁；MV3 Service Worker 生命周期会缩短其实际存活时间。

### Tron DApp（规划，与 [TECHNICAL-SOLUTION.md §4.1](./TECHNICAL-SOLUTION.md) 一致）

- **SDK**：**`tronweb`**（npm `tronweb`），用于交易构造、合约调用编解码、与 Tron HTTP API 交互。
- **页面形态**：目标与市面 Tron DApp 一致——**TronLink / TIP-1193 风格**的 `request` 与 **`window.tronLink` / `tronWeb` 注入约定**（**独立**于上文 EIP-1193 inpage）；实现时建议 **另设 MAIN 世界内容脚本**（或等价注入），避免与 `inpageEvm.ts` 混绑。
- **现状**：仓库内**尚无** Tron inpage / bridge 实现；依赖与版本纳入 monorepo 时与根 `pnpm.overrides` 对齐。

### 相关代码入口

- **Background 枢纽**：[ `background.ts` ](../../apps/extension/src/background.ts)
- **安装 / 升级引导**：[`welcome.tsx`](../../apps/extension/src/tabs/welcome.tsx) + [`onboarding.ts`](../../apps/extension/src/extension/utils/extension/onboarding.ts)；商店 / 隐私物料见 [extension-store-listing.md](../product/extension-store-listing.md)、[extension-privacy-policy.md](../product/extension-privacy-policy.md)
- **桥接处理**：[ `handleBridgeMessage.ts` ](../../apps/extension/src/extension/utils/bridge/handleBridgeMessage.ts)；子模块与维护优先级见 [bridge/README.md](../../apps/extension/src/extension/utils/bridge/README.md)
- **待连接弹窗**：[`openSiteConnectPopup.ts`](../../apps/extension/src/extension/utils/bridge/siteConnect/openSiteConnectPopup.ts)、[`pendingSiteConnect.ts`](../../apps/extension/src/extension/utils/bridge/siteConnect/pendingSiteConnect.ts)、[`resolvePendingSiteConnect.ts`](../../apps/extension/src/extension/utils/bridge/siteConnect/resolvePendingSiteConnect.ts)
- **侧栏站点会话**：[`connectedSitesSection.tsx`](../../apps/extension/src/extension/ui/wallet/sections/connectedSitesSection.tsx) + [`connectedSitesView.ts`](../../apps/extension/src/extension/utils/walletUi/connectedSitesView.ts) + [`walletUiState`](../../apps/extension/src/extension/utils/walletUi/walletUiState.ts)（`siteAuthSessions`、`WALLET_UI_STATE_STORAGE_KEY`；搜索 / 分组 / CSV 导出；无内置演示地址，须导入本地账户后方可连接 DApp）
- **待签名弹窗**：[`openPersonalSignPopup.ts`](../../apps/extension/src/extension/utils/bridge/personalSign/openPersonalSignPopup.ts)、[`pendingPersonalSign.ts`](../../apps/extension/src/extension/utils/bridge/personalSign/pendingPersonalSign.ts)、[`resolvePendingPersonalSign.ts`](../../apps/extension/src/extension/utils/bridge/personalSign/resolvePendingPersonalSign.ts)
- **EIP-712 弹窗**：[`openTypedDataSignPopup.ts`](../../apps/extension/src/extension/utils/bridge/typedData/openTypedDataSignPopup.ts)、[`pendingTypedDataSign.ts`](../../apps/extension/src/extension/utils/bridge/typedData/pendingTypedDataSign.ts)、[`resolvePendingTypedDataSign.ts`](../../apps/extension/src/extension/utils/bridge/typedData/resolvePendingTypedDataSign.ts)
- **交易弹窗**（`eth_sendTransaction` / `eth_signTransaction`）：[`openSendTransactionPopup.ts`](../../apps/extension/src/extension/utils/bridge/transaction/openSendTransactionPopup.ts)（`openSendTransactionApprovalPopup`）、[`pendingSendTransaction.ts`](../../apps/extension/src/extension/utils/bridge/transaction/pendingSendTransaction.ts)、[`resolvePendingSendTransaction.ts`](../../apps/extension/src/extension/utils/bridge/transaction/resolvePendingSendTransaction.ts)、[`signSendTransaction` 页](../../apps/extension/src/tabs/signSendTransaction.tsx)
- **产品对照**：[prd-extension.md](../product/prd-extension.md)；整体能力域见 [PRODUCT-OVERVIEW.md](../product/PRODUCT-OVERVIEW.md)。
