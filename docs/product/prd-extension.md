# 产品需求 · 浏览器扩展（`apps/extension`）

**整体与能力域**：[PRODUCT-OVERVIEW.md](./PRODUCT-OVERVIEW.md) §0、§A（A0–A3、A7、A8 插件相关）  
**工程实现线索**：[engineering/extension.md](../engineering/extension.md)  
**技术边界**：[TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md)

---

## 1. 可验收细则（产品向）

- **注入与兼容**：对宿主页提供 **EIP-1193**（`window.ethereum` 等约定）；与 **EIP-6963** 钱包发现一致时可并存；**来源校验**（origin / 扩展 id）与防冒充（技术方案 §3、§9）。
- **密钥与 Vault**：导入/创建后 **加密落盘**；**解锁/锁定**策略可配置；多档案时 **切换当前档案** 与 UI 状态一致；**导出**须二次确认与风险提示（对应整体 §A1、A2）。
- **连接与审批**：站点 **eth_requestAccounts** 等须可配置策略（如按标签/定时/持久）；**签名与交易**须在插件 UI 展示可读摘要后再确认；已连接站点 **列表、搜索、分组、公开元数据导出与撤销**（整体 §A2）。
- **与 Web 联动**：自有站可通过 **runtime / bridge** 与 background 通信；不得通过桥接返回 **明文助记词/私钥**（仓库安全规则）。
- **多链**：首发以 **EVM** 为主；**Tron/BTC** 钱包与签名为后续阶段（整体 §A8）。
- **网络管理**：用户可在侧栏切换内置 / 自定义 EVM 网络，新增 / 编辑 / 删除自定义 RPC 链；新增 / 修改 RPC 时校验 `eth_chainId`，DApp 不得静默添加未知链。
- **工具栏入口模式**：默认点击工具栏图标打开弹窗；用户可在「DApp 全局设置 → 工具栏打开方式」切换为侧边栏模式，设置持久化并在 Service Worker 启动 / 重载后继续生效；网页右键菜单「打开侧边栏」始终可用。
- **首次运行与升级**：首次安装或版本变化时打开「安全与使用指南」，覆盖备份、签名审批、隐私与权限；侧栏保留常驻入口。上架文案、隐私说明、截图脚本与检查清单见 [extension-store-listing.md](./extension-store-listing.md) 与 [extension-privacy-policy.md](./extension-privacy-policy.md)；权限声明与整体 §A7 一致。

---

## 2. 已实现与缺口（产品视角）

- **已有**：**MV3 background**；**双内容脚本**（[`allUrls`](../../apps/extension/src/contents/allUrls.ts)、[`inpageEvm`](../../apps/extension/src/contents/inpageEvm.ts)，EIP-1193 / 6963）；**bridge**、**vault 加密/派生/记录**（EVM + TVM）；**侧栏钱包面板**（概览入口 + 「DApp 全局设置」子页：默认账户、**工具栏打开方式（弹窗 / 侧边栏）**、**网络与自定义 RPC**、交易提交方式、已连接网站（搜索 / 分组 / CSV 导出、单站 / 全部断开，[`connectedSitesSection`](../../apps/extension/src/extension/ui/wallet/sections/connectedSitesSection.tsx) + [`walletUiState`](../../apps/extension/src/extension/utils/walletUi/walletUiState.ts)）、站点授权策略）；**审批 Tab**：[`siteConnect`](../../apps/extension/src/tabs/siteConnect.tsx)、[`signPersonal`](../../apps/extension/src/tabs/signPersonal.tsx)、[`signTypedData`](../../apps/extension/src/tabs/signTypedData.tsx)、[`signSendTransaction`](../../apps/extension/src/tabs/signSendTransaction.tsx)；**账户管理 Tab**：[`evmAccounts`](../../apps/extension/src/tabs/evmAccounts.tsx)（助记词 / 私钥导入）、[`tvmAccounts`](../../apps/extension/src/tabs/tvmAccounts.tsx)（生成 / 私钥导入；不接入签名）；**多链地址生成器 Tab** [`generateAccounts`](../../apps/extension/src/tabs/generateAccounts.tsx)（EVM / TVM / BTC 助记词校验与 HD 批量派生，导出 CSV / 可配置 JSON，不写入 vault）；**无演示地址**，须先导入加密账户；**EIP-1193**（内置链 + 侧栏已配置自定义 RPC 链；内置清单与 `@plugin/shared` 的 `WALLET_BUILTIN_EVM_CHAINS` 对齐）：`wallet_switchEthereumChain` / `wallet_addEthereumChain`（未知链返回 4902，DApp 不能自动添加自定义链）、只读 `eth_blockNumber`、已连接站点的 `eth_getBalance`、`eth_sendRawTransaction`（已签名 RLP 广播，使用当前链 RPC）、`personal_sign` / `eth_sign`、EIP-712 `eth_signTypedData*`、`eth_sendTransaction` / `eth_signTransaction`（受全局 `evmTxSubmitMode` 影响；`eth_signTransaction` 固定返回已签名 RLP）；**会话级解锁**（默认空闲 15 分钟，可在侧栏 1–120 分钟配置；同地址后续签名免重复口令，但每个审批弹窗仍须确认；支持手动「立即锁定全部」）。**首次安装 / 升级引导**（[`welcome`](../../apps/extension/src/tabs/welcome.tsx) + [`onboarding`](../../apps/extension/src/extension/utils/extension/onboarding.ts)）：同一版本只自动打开一次，侧栏「安全与使用指南」可随时回看；上架文案、隐私说明与截图脚本见 [extension-store-listing.md](./extension-store-listing.md) / [extension-privacy-policy.md](./extension-privacy-policy.md)。**挂起互斥**：连接、消息签名（`personal_sign` / `eth_sign` / EIP-712）、交易四类审批不可同时进行。细则表见 [extension.md § EIP-1193](../engineering/extension.md)。
- **仍缺**：**多钱包档案**、**Tron DApp**（`tronweb` + TronLink 风格注入；当前仅 TVM 账户管理）、**BTC 钱包与签名**（当前仅地址派生）、生产级 DApp 全量验收（相对本章 §1、整体 §A1–A2）。自定义 RPC 链已实现，但仅限用户显式添加。会话级解锁已实现，但解锁态只在扩展 background 内存存活，**Service Worker 休眠 / 浏览器重启后需重新输入口令**，不是跨会话持久解锁。已连接站点搜索 / 分组 / CSV 导出已实现，导出仅含公开站点元数据。首次引导与商店物料已准备，但**实际商店提交仍待公开隐私政策 URL、支持链接与截图**。
