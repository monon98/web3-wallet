# 产品需求 · Web（`apps/web`）

**整体与能力域**：[PRODUCT-OVERVIEW.md](./PRODUCT-OVERVIEW.md) §0、§A（**§A4**、§A3 协同部分、§A8 Web 侧）  
**工程实现线索**：[engineering/web.md](../engineering/web.md)  
**技术边界**：[TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md)

---

## 1. 可验收细则（产品向）

- **环境**：通过 `NEXT_PUBLIC_*` 配置默认链、**服务端 API 基址**等；不在浏览器持久化密钥（整体 §A4）。
- **扩展联动**：检测扩展、引导安装；连接后展示 **当前地址与链**；上链操作 **触发扩展审批** 并展示结果（整体 §A3、§0.1）。
- **会话与登录**：**SIWE 或等价 challenge/verify** 换会话（与整体 §B3、服务端 Auth 对齐）；个人页仅展示 **非密钥** 业务数据。
- **只读与批量**：批量地址查询 **表单校验、分页/导出（若产品要）**、错误与空态；依赖 [prd-server.md](./prd-server.md) 能力。
- **演示与联调**：保留可点击的**能力演示路径**（如 `/wallet` 扩展联调），便于与各端联验收；`/balances` 已由 demo 升级为正式批量查询入口，EVM / Tron / BTC 各用独立查询页。

---

## 2. 已实现与缺口（产品视角）

- **已有**：Next + viem + TanStack Query + UnoCSS + `@plugin/ui`；`/`（首页与演示导航）、**钱包联调页** [`/wallet`](../../apps/web/src/app/wallet/page.tsx)（EIP-6963 发现注入 provider；可联调 <code>eth_requestAccounts</code>、<code>eth_accounts</code>、<code>eth_chainId</code>、<code>eth_blockNumber</code>、<code>eth_getBalance</code>（主币符号与区块参数来自 `@plugin/shared` 的 <code>WALLET_BUILTIN_EVM_CHAINS</code> 与页面选择）、<code>wallet_switchEthereumChain</code> / <code>wallet_addEthereumChain</code>、<code>personal_sign</code>，与扩展 [`signPersonal`](../../apps/extension/src/tabs/signPersonal.tsx) 弹窗配合）、**登录与交易广播页** [`/account`](../../apps/web/src/app/account/page.tsx)（challenge → `personal_sign` → HttpOnly Cookie 会话；服务端读取 nonce / gas 后由扩展 `eth_signTransaction` 签名，再调用 `POST /api/v1/tx/broadcast`；CSRF token 仅存页面内存）、**多链余额查询入口** [`/balances`](../../apps/web/src/app/balances/page.tsx)（EVM / Tron / BTC 链选择卡片）及三个独立查询页 [`/balances/evm`](../../apps/web/src/app/balances/evm/page.tsx)、[`/balances/tron`](../../apps/web/src/app/balances/tron/page.tsx)、[`/balances/btc`](../../apps/web/src/app/balances/btc/page.tsx)（每页只提交当前链一个 group，避免三组表单与结果挤在一页；统一调用 `POST /api/v1/balances/query`；地址去重与基础校验、每链 20 条限制、请求取消、分页 / CSV 导出、空态 / 部分失败提示；原始 JSON 收进调试区；Cookie 会话自动获得更高限额）。
- **仍缺**：完整业务门户；更完整的账户 / 个人视图；Web CSP 与 Web 端 E2E（见 P4-1）。
