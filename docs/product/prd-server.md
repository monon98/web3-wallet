# 产品需求 · 服务端（`apps/server`）

**整体与能力域**：[PRODUCT-OVERVIEW.md](./PRODUCT-OVERVIEW.md) §0、§A（**§A5**、§A8 编排侧）  
**工程实现线索**：[engineering/server.md](../engineering/server.md)  
**技术边界**：[TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md)  
**排障**：[runbook/server-evm-etherscan.md](../runbook/server-evm-etherscan.md)

---

## 1. 可验收细则（产品向）

- **EVM 网关（当前基线）**：托管 **JSON-RPC 转发**（方法白名单、批量上限；不是网络代理）；**原生余额**优先走 `SERVER_RPC_URL`（链 ID 校验），RPC 不可用时回退 **Etherscan V2**，响应标注 `source`；多地址 **ERC-20 持仓**仍依赖 Etherscan（PRO 端点须 **串行/限流**，产品需接受延迟或排队，见 runbook，网络不可达时返回 `etherscan_unreachable`）。
- **可观测性**：请求日志 **脱敏**（无密钥、无裸 RPC Key）；健康与配置探测接口便于 Web/运维验收。
- **扩展方向（产品）**：统一 **批量地址** API、业务 Auth 与限流策略（整体 §A5、A8）；与 [prd-web.md](./prd-web.md) 的页面字段表对齐后再开发。

---

## 2. 已实现与缺口（产品视角）

- **已有**：EVM **JSON-RPC 转发**（`POST /api/v1/evm/rpc`，方法白名单、批量上限）、**原生余额**（优先 `SERVER_RPC_URL`，`eth_chainId` 校验；失败回退 Etherscan；响应含 `source`）、**Etherscan V2** 多地址 ERC-20 持仓、链上批量 **`POST /api/v1/evm/balance-reader/query`**（`BalanceBatchReader`）、**`POST /api/v1/evm/batch-sender/build`**（构造 calldata，非托管）、探测 **`GET /api/v1/evm/status`** 与 **`GET /api/v1/meta`**；**Tron** 账户余额（**TronGrid**：status、单 / 批量 TRX + TRC-20 原始数量）、**BTC** 地址余额（**Esplora**：status、单 / 批量已确认余额 / 内存池净变化 / 交易数）；开发态 OpenAPI / Swagger（技术方案 §5.2）。
- **仍缺**：统一 Auth（SIWE 契约已在 `@plugin/shared` 预留）、交易广播与统一批量多链 API、限流 / 缓存策略（相对本章 §1、整体 §A5）。
