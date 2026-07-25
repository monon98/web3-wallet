# Runbook：服务端（EVM / Etherscan）

本文档由团队在排障后**按需追加**；描述中勿包含真实 API Key、私钥或助记词。

**索引**：[issues-and-solutions.md](./issues-and-solutions.md)

**相关工程备忘**（多地址原生币与代币、Multicall、本仓 Etherscan 批量行为）：[evm-batch-balances.md](../engineering/evm-batch-balances.md)

---

## Etherscan PRO 端点频率限制（`addresstokenbalance`）

- **现象**：多地址 ERC-20 持仓查询易触发供应商约 **2 次/秒** 限制。
- **处理**：服务端对 PRO 端点**串行**调用，并可通过环境变量 `ETHERSCAN_PRO_MIN_INTERVAL_MS`（默认约 `550`）拉大间隔；详见 [TECHNICAL-SOLUTION.md §5.2、§5.4](../engineering/TECHNICAL-SOLUTION.md)。

## JSON-RPC 代理安全

- **现象**：开放任意 JSON-RPC 方法会带来滥用风险。
- **处理**：`POST /api/v1/evm/rpc` 使用**方法白名单**并限制批量条数；见技术方案 §5.2。
