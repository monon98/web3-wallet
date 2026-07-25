# 产品需求 · 浏览器扩展（`apps/extension`）

**整体与能力域**：[PRODUCT-OVERVIEW.md](./PRODUCT-OVERVIEW.md) §0、§A（A0–A3、A7、A8 插件相关）  
**工程实现线索**：[engineering/extension.md](../engineering/extension.md)  
**技术边界**：[TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md)

---

## 1. 可验收细则（产品向）

- **注入与兼容**：对宿主页提供 **EIP-1193**（`window.ethereum` 等约定）；与 **EIP-6963** 钱包发现一致时可并存；**来源校验**（origin / 扩展 id）与防冒充（技术方案 §3、§9）。
- **密钥与 Vault**：导入/创建后 **加密落盘**；**解锁/锁定**策略可配置；多档案时 **切换当前档案** 与 UI 状态一致；**导出**须二次确认与风险提示（对应整体 §A1、A2）。
- **连接与审批**：站点 **eth_requestAccounts** 等须可配置策略（如按标签/定时/持久）；**签名与交易**须在插件 UI 展示可读摘要后再确认；已连接站点 **列表与撤销**（整体 §A2）。
- **与 Web 联动**：自有站可通过 **runtime / bridge** 与 background 通信；不得通过桥接返回 **明文助记词/私钥**（仓库安全规则）。
- **多链**：首发以 **EVM** 为主；**Tron/BTC** 钱包与签名为后续阶段（整体 §A8）。
- **上架相关**：权限声明、隐私文案与整体 §A7 一致。

---

## 2. 已实现与缺口（产品视角）

- **已有**：标签页 [generateAccounts](../../apps/extension/src/tabs/generateAccounts.tsx) 生成/校验助记词与 HD 派生；**MV3 background**；**双内容脚本**（[`allUrls`](../../apps/extension/src/contents/allUrls.ts)、[`inpageEvm`](../../apps/extension/src/contents/inpageEvm.ts)，EIP-1193 / 6963）；**bridge**、**vault 加密/派生/记录**、钱包状态与 **侧栏钱包面板**；**站点连接**弹窗 [`siteConnect`](../../apps/extension/src/tabs/siteConnect.tsx)；侧栏 **「已连接的网站」**（[`connectedSitesSection.tsx`](../../apps/extension/src/extension/ui/panels/wallet/sections/connectedSitesSection.tsx)）列出 `siteAuthSessions`（origin、暴露地址、策略说明），支持 **单站断开**（[`revokeSiteSessionOrigin`](../../apps/extension/src/extension/utils/walletUi/walletUiState.ts)）与 **全部断开**（[`revokeAllSiteAuthSessions`](../../apps/extension/src/extension/utils/walletUi/walletUiState.ts)）；**无演示地址**，须先导入加密账户；**EIP-1193**：内置网络（链列表与 `@plugin/shared` 的 `WALLET_BUILTIN_EVM_CHAINS` 对齐）**`wallet_switchEthereumChain` / `wallet_addEthereumChain`**、只读 **`eth_blockNumber`**、已连接站点的 **`eth_getBalance`**、**`personal_sign`**（[`sign-personal`](../../apps/extension/src/tabs/signPersonal.tsx)）、**EIP-712** **`eth_signTypedData` / `eth_signTypedData_v3` / `eth_signTypedData_v4`**（[`sign-typed-data`](../../apps/extension/src/tabs/signTypedData.tsx)）。**挂起互斥**：连接审批与 **personal_sign / EIP-712** 签名审批不可同时进行。细则表见 [extension.md § EIP-1193](../engineering/extension.md)。
- **仍缺**：**会话级解锁**（当前签名为每次在弹窗输入加密口令，非长期解锁态）、站点维度的 **搜索/分组/导出** 等增强、**`eth_sign` / 交易** 的审批与链上闭环、**自定义 RPC 链**、生产级 DApp 全量验收（相对本章 §1、整体 §A1–A2）。
