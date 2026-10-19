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
- **演示与联调**：保留可点击的 **网关/能力演示路径**（如调用服务端 EVM 网关的 demo 页），便于与 [prd-server.md](./prd-server.md) 联验收。

---

## 2. 已实现与缺口（产品视角）

- **已有**：Next + viem + TanStack Query + UnoCSS + `@plugin/ui`；`/`（首页与演示导航）、**钱包联调页** [`/wallet`](../../apps/web/src/app/wallet/page.tsx)（EIP-6963 发现注入 provider；可联调 <code>eth_requestAccounts</code>、<code>eth_accounts</code>、<code>eth_chainId</code>、<code>eth_blockNumber</code>、<code>eth_getBalance</code>（主币符号与区块参数来自 `@plugin/shared` 的 <code>WALLET_BUILTIN_EVM_CHAINS</code> 与页面选择）、<code>wallet_switchEthereumChain</code> / <code>wallet_addEthereumChain</code>、<code>personal_sign</code>，与扩展 [`signPersonal`](../../apps/extension/src/tabs/signPersonal.tsx) 弹窗配合）、**网关演示页** [`/gateway`](../../apps/web/src/app/gateway/page.tsx)（服务端 EVM 接口：`/api/v1/meta`、`/api/v1/evm/status`、批量原生余额、多地址 ERC-20 持仓）。
- **仍缺**：SIWE/会话（契约已在 `@plugin/shared`，服务端认证路由未实现）、完整业务门户与批量查询正式页（相对整体 §A4）。
