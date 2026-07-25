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

- **已有**：Bridge 与部分 HTTP **Zod**（如 EVM explorer 批量请求）。
- **仍缺**：随 Bridge 与业务 API 扩展持续补全类型与校验（相对本章 §1）。
