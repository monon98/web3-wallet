# 子项目：合约（`packages/contracts`）

- **栈**：Foundry、Solidity 0.8.x（详见 [TECHNICAL-SOLUTION.md §4.4](./TECHNICAL-SOLUTION.md)）。
- **范围**：可编程链以 EVM 为主；**不含 BTC**；Tron 合约若需要单独 ADR。
- **ERC-20 / Permit（可部署在 EVM 与 Tron TVM）**：[`eth/Token.sol`](../../packages/contracts/src/eth/Token.sol)、[`eth/TokenPermit.sol`](../../packages/contracts/src/eth/TokenPermit.sol)；共享错误见 [`common/Err.sol`](../../packages/contracts/src/common/Err.sol)。
- **批量只读余额 / 授权**：[`evm/BalanceBatchReader.sol`](../../packages/contracts/src/evm/BalanceBatchReader.sol)（合约名 `BalanceBatchReader`；原子化 `getNativeBalances`、`getErc20Balances`、`getAllowances`；组合 `getBalances`；部署地址配 `EVM_BALANCE_READER_ADDRESSES_JSON`，见 [evm-batch-balances.md](./evm-batch-balances.md) §5）。
- **批量转账**：[`evm/BatchSender.sol`](../../packages/contracts/src/evm/BatchSender.sol)（`BatchSender`；ETH / ERC-20 `transferFrom`；写操作需发交易并消耗 gas；服务端提供 `POST /api/v1/evm/batch-sender/build` 构造 calldata，部署地址配 `EVM_BATCH_SENDER_ADDRESSES_JSON`）。
- **批量归集（ERC-20）**：[`evm/BatchCollector.sol`](../../packages/contracts/src/evm/BatchCollector.sol)（`BatchCollector`；多地址 `approve` 后 `transferFrom` 至同一归集地址；**原生 ETH** 不能在同一笔调用中从多个 EOA 无签名归集，见合约注释）。
- **产品对照**：[prd-contracts.md](../product/prd-contracts.md)；整体见 [PRODUCT-OVERVIEW.md](../product/PRODUCT-OVERVIEW.md) §A6、§A8。
