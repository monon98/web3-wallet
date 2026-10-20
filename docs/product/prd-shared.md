# 产品需求 · 共享包（`packages/shared`）

**整体与联动**：[PRODUCT-OVERVIEW.md](./PRODUCT-OVERVIEW.md) §0.2、§0.3  
**工程实现线索**：[engineering/shared.md](../engineering/shared.md)  
**技术契约**：[TECHNICAL-SOLUTION.md](../engineering/TECHNICAL-SOLUTION.md) §5

---

## 1. 可验收细则（产品向）

- **Bridge**：与插件 bridge **信封、方法枚举、错误码** 一致；版本变更时 **四端同步**（避免「网页能调、插件未实现」）。
- **HTTP / API**：对外 REST 或 JSON 体的 **Zod 与 TS 类型**（如批量地址请求体）为 **单一事实来源**；服务端校验与 Web 表单应对齐同一份 schema。
- **原则**：新增跨端字段时 **先 shared 再实现**，避免联动断裂。

---

## 2. 已实现与缺口（产品视角）

- **已有**：Bridge 信封与解析；内置 EVM 链清单（`WALLET_BUILTIN_EVM_CHAINS` 与校验函数，扩展 / Web 联调页共用）；HTTP 契约——EVM explorer（单 / 批量原生余额、多地址 ERC-20 持仓）、`balance-reader` 查询、`batch-sender` 构造、Tron explorer（批量账户请求）、BTC explorer（批量地址请求）、`tx` 广播请求 / 响应、`auth`（SIWE 风格 challenge / verify / me / logout 请求与响应，服务端已实现 MVP）；错误码（应用级 / EIP-1193）。
- **仍缺**：统一批量查询 API 的 schema、随 Bridge 与业务 API 扩展持续补全类型与校验（相对本章 §1）。
