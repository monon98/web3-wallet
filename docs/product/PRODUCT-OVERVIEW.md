# 产品需求 · 整体（联动与能力域）

本文描述**整项目**视角：四端如何联动、用户能力域清单、工程阶段与前置决策。**子项目可验收细则**见各 `prd-*.md`，不在此重复展开。

与 [TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md) 互补。变更产品范围时更新本文及对应子文档；若牵动架构或信任边界，同步技术方案 §0 修订记录。

**子文档索引**：[PRODUCT-FEATURES.md](./PRODUCT-FEATURES.md)

---

## 0. 四端联动视图

### 0.1 典型主路径（产品叙事）

下列路径用于排期、PRD 与联调验收；**同一功能**往往跨多端。

| 路径                         | 参与端                     | 产品要点                                                                                                                                                                                                    |
| ---------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **通用 DApp 使用扩展**       | 插件 ↔ 任意网页            | 页面通过 **EIP-1193** 请求账户/签名/发交易；插件 **content + inpage** 注入、`background` 审批与签名；**密钥不离开插件**（能力域见 §A0–A3；细则 [prd-extension.md](./prd-extension.md)）。                   |
| **自有 Web + 扩展 + 服务端** | Web ↔ 插件 ↔ 服务端        | Web 检测扩展、**连接钱包**；登录可用 **地址证明（如 SIWE）** 换会话；业务动作经服务端 API 读链/落库，**需签名的一步**回插件确认（§A3、§A4；[prd-web.md](./prd-web.md)、[prd-server.md](./prd-server.md)）。 |
| **只读聚合（批量地址等）**   | Web → 服务端 → 链/索引 API | 用户在 Web 提交多地址；服务端 **限流、缓存、合并** 后返回表格/卡片数据；插件**不参与**密钥，除非同时要签授权（§A4、§A5；[prd-web.md](./prd-web.md)、[prd-server.md](./prd-server.md)）。                    |
| **链上业务合约**             | Web/服务端 ↔ 合约          | 读 ABI、构造调用、展示解码；写操作仍走用户签名 + 广播；合约范围**不含 BTC**（§A6；[prd-contracts.md](./prd-contracts.md)）。                                                                                |

### 0.2 信任边界（产品需与法务/安全口径一致）

- **助记词 / 私钥**：仅在**浏览器插件**内解密与签名；**不得**要求用户在 Web 或业务服务端输入或持久化明文密钥（与 [技术方案 §3.1](../engineering/TECHNICAL-SOLUTION.md) 一致）。
- **服务端**：可存地址、会话、已签名交易哈希与业务实体；**代广播**仅限**用户已签名**交易。
- **共享契约 `packages/shared`**：Bridge 与 HTTP 的**类型与校验**应对齐各端实现，避免联动断裂（[prd-shared.md](./prd-shared.md)）。

### 0.3 能力域 → 子项目文档

| 能力域（§A）            | 子项目产品细则                         |
| ----------------------- | -------------------------------------- |
| A0–A3、A7、A8（插件侧） | [prd-extension.md](./prd-extension.md) |
| A4                      | [prd-web.md](./prd-web.md)             |
| A5                      | [prd-server.md](./prd-server.md)       |
| 跨端契约                | [prd-shared.md](./prd-shared.md)       |
| A6、A8（合约）          | [prd-contracts.md](./prd-contracts.md) |

---

## A. 产品功能方向清单（用户可感知）

按**能力域**列举，便于排期与 PRD；**不绑定**具体接口名或框架。落地验收以各 **prd-\*.md** 为准。

### A0. 插件产品定位（跨 A1–A3）

- **离线扩展钱包**：助记词与私钥仅在扩展内解密与使用；**签名在本地完成**，**不把密钥托管给服务端**；密钥材料不离开插件（与 [TECHNICAL-SOLUTION.md §3.1](../engineering/TECHNICAL-SOLUTION.md) 一致）。
- **多钱包模式**：多个相互独立的钱包档案，档案间切换；每档案内 **HD 多账户**。产品需定义档案上限、命名与删除策略。
- **通用 DApp 调用方式**：**EIP-1193** provider 及常用 JSON-RPC 方法，与 MetaMask 等主流路径对齐；与自有 Web 的 `postMessage`/SDK **可并存**（见 A3）。

### A1. 钱包本体（浏览器插件）

- **创建 / 恢复钱包**；**密码与解锁**、**自动锁定**；**多账户**与备注；**地址展示与复制**；可选派生路径；**导出**（强提示与二次确认）；**网络/链**列表与当前网络（与 [§9](../engineering/TECHNICAL-SOLUTION.md) 决策一致）。

### A2. 安全与签名体验

- **连接网站**；**已连接站点管理**；**签名与交易确认**（可读摘要）；**消息 / 结构化数据签名**同理。

### A3. 与 DApp / 自有 Web 的协同

- **自有站点**：检测扩展、引导安装、一键连接、展示地址与网络；**站点内上链操作** → 插件确认 → 结果回显。
- **通用 DApp（EIP-1193）**：默认支持常见 `window.ethereum` 路径；与 **§A0** 一致。

### A4. Web 站点侧（业务门户）

- **钱包登录**（地址证明，网页不输入助记词）；**个人视图**；**业务动作入口**（由链上与运营定义）；**批量地址信息查询**（提交多地址、表格/卡片、可选导出分页）。

### A5. 服务端侧（用户价值）

- **非密钥链交互**：代查状态、代广播**已签名**交易、业务与链上对齐；**多链接入**（EVM / Tron / BTC）；**批量查询**合并、限流、缓存、兜底；**通知与历史**（可选）。

### A6. 链上产品（智能合约）

- **可编程链**：产品明确主路径（Token、NFT、质押等）；规则即功能。**BTC** 不走合约交付，走 UTXO 与 Web/服能力（见 A8）。

### A7. 发布与合规体验

- **商店页**；**首次运行引导**（备份与安全须知）。

### A8. 多链范围（EVM / Tron / BTC）

- **EVM**：主线。**Tron**：Web/服优先；插件与合约分期/另项。**BTC**：Web/服基本只读等；插件持有与签名后续评估。**合约不含 BTC**。

---

## B. 工程技术交付对照（阶段）

与 [TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md) §4、§8、§10 对齐；**不等于产品功能名**。

| 阶段          | 内容                                                            |
| ------------- | --------------------------------------------------------------- |
| B1 工程与共享 | pnpm monorepo、`packages/shared`、根 README、`.env.example`、CI |
| B2 插件       | Vault、background、EIP-1193、postMessage、Tron/BTC 插件分期     |
| B3 Web        | 连接扩展、SIWE、服务端联调、多链 UI、批量查询页                 |
| B4 服务端     | Auth、ChainGateway、tx 广播、批量 API、可选 DB                  |
| B5 合约       | Foundry、ABI/地址进 shared；不含 BTC                            |
| B6 质量与上架 | E2E、安全自检、上架物料                                         |

---

## C. 产品前置决策

- **桥接形态**：EIP-1193 与 postMessage **双轨并存**（与 [§9](../engineering/TECHNICAL-SOLUTION.md) 对齐）。
- **目标链与 RPC / Tron / BTC 数据源**；是否代广播 BTC（§9）。
- **批量查询**：单次条数、QPS、缓存、是否登录可见（§9）。
- **链上业务主线**：至少一条清晰用户故事（否则 A4–A6 难定优先级）。

---

## D. 已实现基线 · 总览（截至 2026-10-20）

| 子项目 | 摘要                                                                                                                                                                                                                                                                                                         | 细则与缺口                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| 扩展   | background、双内容脚本 EIP-1193/6963、bridge、vault（EVM+TVM）、侧栏（概览与「DApp 全局设置」）；连接、`personal_sign`/`eth_sign`、EIP-712、交易四类审批 Tab + EVM/TVM 账户管理 + 多链地址生成器；内置链切换、只读 RPC、`eth_sendRawTransaction`、交易与 `evmTxSubmitMode`（见 engineering/extension.md 表） | [prd-extension.md](./prd-extension.md) |
| Web    | Next；`/wallet` 联调扩展（EIP-6963 + EIP-1193）、`/account` 登录与交易广播（challenge → `personal_sign` → Bearer 会话 → `eth_signTransaction` → 服务端广播）、`/balances` **多链余额查询**（EVM / Tron / BTC）                                                                                               | [prd-web.md](./prd-web.md)             |
| 服务端 | Auth（challenge / verify / me / logout，Bearer 会话）、EVM JSON-RPC 转发 + tx 广播、Etherscan V2、`balance-reader` 链上批量、`batch-sender` 构造、Tron 账户余额（TronGrid）、BTC 地址余额（Esplora）、status / meta                                                                                          | [prd-server.md](./prd-server.md)       |
| shared | Bridge、内置链清单、explorer / balance-reader / batch-sender / tx / auth 契约（含请求 / 响应 schema）                                                                                                                                                                                                        | [prd-shared.md](./prd-shared.md)       |
| 合约   | Foundry；Token / TokenPermit；BalanceBatchReader / BatchSender / BatchCollector（含测试）                                                                                                                                                                                                                    | [prd-contracts.md](./prd-contracts.md) |
