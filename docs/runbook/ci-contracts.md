# Runbook：CI / 合约

本文档由团队在排障后**按需追加**；描述中勿包含真实 API Key、私钥或助记词。

**索引**：[issues-and-solutions.md](./issues-and-solutions.md)

---

## `forge-std` 缺失导致 `forge test` 失败

- **现象**：克隆后 `packages/contracts/lib` 为空。
- **处理**：在 `packages/contracts` 下执行 `forge install --no-commit foundry-rs/forge-std`（见根 [README.md](../../README.md)）。
