# 产品需求 · 服务端（`apps/server`）

**整体与能力域**：[PRODUCT-OVERVIEW.md](./PRODUCT-OVERVIEW.md) §0、§A（**§A5**、§A8 编排侧）  
**工程实现线索**：[engineering/server.md](../engineering/server.md)  
**技术边界**：[TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md)  
**排障**：[runbook/server-evm-etherscan.md](../runbook/server-evm-etherscan.md)

---

## 1. 可验收细则（产品向）

- **EVM 网关（当前基线）**：托管 **JSON-RPC 代理**（方法白名单、批量上限）；**Etherscan V2** 单地址/批量原生余额、多地址 ERC-20 持仓（PRO 端点须 **串行/限流**，产品需接受延迟或排队，见 runbook）。
- **可观测性**：请求日志 **脱敏**（无密钥、无裸 RPC Key）；健康与配置探测接口便于 Web/运维验收。
- **扩展方向（产品）**：**Tron/BTC** ChainGateway、统一 **批量地址** API、业务 Auth 与限流策略（整体 §A5、A8）；与 [prd-web.md](./prd-web.md) 的页面字段表对齐后再开发。

---

## 2. 已实现与缺口（产品视角）

- **已有**：EVM **RPC 代理**与 **Etherscan** 相关路由（技术方案 §5.2）。
- **仍缺**：Tron/BTC、统一 Auth、完整批量多链 API（相对本章 §1、整体 §A5）。
