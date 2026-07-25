# 产品需求 · 智能合约（`packages/contracts`）

**整体与能力域**：[PRODUCT-OVERVIEW.md](./PRODUCT-OVERVIEW.md) §A6、§A8（合约与多链）  
**工程实现线索**：[engineering/contracts.md](../engineering/contracts.md)  
**技术边界**：[TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md)

---

## 1. 可验收细则（产品向）

- **范围**：**EVM** Foundry 工程；**不含 BTC**；Tron 可编程链合约 **另立项**（整体 §A6、A8）。
- **产品交付物**：业务规则即合约行为；**ABI 与部署地址** 供 Web/服务端消费（可经 [prd-shared.md](./prd-shared.md) 或配置注入）。

---

## 2. 已实现与缺口（产品视角）

- **已有**：Foundry 骨架与示例合约。
- **仍缺**：业务合约与多链地址表（相对本章 §1、整体 §A6）。
