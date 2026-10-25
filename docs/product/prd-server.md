# 产品需求 · 服务端（`apps/server`）

**整体与能力域**：[PRODUCT-OVERVIEW.md](./PRODUCT-OVERVIEW.md) §0、§A（**§A5**、§A8 编排侧）  
**工程实现线索**：[engineering/server.md](../engineering/server.md)  
**技术边界**：[TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md)  
**排障**：[runbook/server-evm-etherscan.md](../runbook/server-evm-etherscan.md)

---

## 1. 可验收细则（产品向）

- **EVM 网关（当前基线）**：托管 **JSON-RPC 转发**（方法白名单、批量上限；不是网络代理）；**原生余额**优先走 `SERVER_RPC_URL`（链 ID 校验），RPC 不可用时回退 **Etherscan V2**，响应标注 `source`；多地址 **ERC-20 持仓**仍依赖 Etherscan（PRO 端点须 **串行/限流**，产品需接受延迟或排队），服务端增加 token 缓存（新鲜 60s / stale 30min）与冷却提示；Etherscan 不可达时原生余额不受影响，行内返回 `etherscan_unreachable`；`ETHERSCAN_API_URL` 可指向受控代理。
- **统一多链余额查询（已实现）**：`POST /api/v1/balances/query` 一次编排 EVM / Tron / BTC（每组 ≤ 20 地址，三组并行，按链 / 按地址部分失败）；匿名可用，登录后限额更高；`GET /api/v1/balances/status` 暴露限额、缓存与上游配置。默认匿名 30 / 登录 120 次/分钟，缓存 15s、stale 5min。
- **可观测性**：请求日志 **脱敏**（无密钥、无裸 RPC Key）；健康与配置探测接口便于 Web/运维验收；配置 `SERVER_METRICS_TOKEN` 后可通过 Bearer 保护的 `GET /metrics` 观测 HTTP 错误率、本地限流与 RPC / Etherscan / TronGrid / Esplora 可用性 / 上游限流。
- **扩展方向（产品）**：Auth 生产化（多实例 / Redis / DB）、业务 API、告警规则与配额运营；与 [prd-web.md](./prd-web.md) 的页面字段表对齐后再开发。

---

## 2. 已实现与缺口（产品视角）

- **已有**：**Auth（P4-5）**——`POST /api/v1/auth/challenge`、`POST /api/v1/auth/verify`、`GET /api/v1/auth/me`、`POST /api/v1/auth/logout`（一次性挑战 5 分钟；浏览器 HttpOnly Cookie + CSRF，API 客户端 Bearer；会话文件持久化）；**交易广播（MVP，EVM）**——`POST /api/v1/tx/broadcast`（Cookie + CSRF 或 Bearer、发送方 / chainId / RPC 链校验）；EVM **JSON-RPC 转发**（`POST /api/v1/evm/rpc`，方法白名单、批量上限）、**原生余额**（优先 `SERVER_RPC_URL`，`eth_chainId` 校验；失败回退 Etherscan；响应含 `source`）、**Etherscan V2** 多地址 ERC-20 持仓、链上批量 **`POST /api/v1/evm/balance-reader/query`**（`BalanceBatchReader`）、**`POST /api/v1/evm/batch-sender/build`**（构造 calldata，非托管）、探测 **`GET /api/v1/evm/status`** 与 **`GET /api/v1/meta`**；**Tron** 账户余额（**TronGrid**：status、单 / 批量 TRX + TRC-20 原始数量）、**BTC** 地址余额（**Esplora**：status、单 / 批量已确认余额 / 内存池净变化 / 交易数）、**统一余额查询**（`POST /api/v1/balances/query`、`GET /api/v1/balances/status`：可选 Cookie / Bearer、匿名 / 登录限流、15s 缓存 + stale 回退、按链 / 按地址部分失败；集成测试已接入 CI）、**运维指标**（`GET /metrics`，Prometheus text + Bearer 鉴权；HTTP 错误率 / 本地限流 / 上游可用性与限流）；开发态 OpenAPI / Swagger（技术方案 §5.2）。
- **仍缺**：多实例共享会话 / 限流 / 缓存（Redis / DB）、Web CSP、告警规则与仪表盘、QPS 配额运营、Tron / BTC 交易广播（相对本章 §1、整体 §A5）。
