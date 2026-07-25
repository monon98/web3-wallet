# 智能合约（Foundry）

与技术方案一致：**Solidity 0.8.x**（版本见 `foundry.toml`），**不含 BTC 合约**。

## 目录

| 目录 | 内容 |
|------|------|
| `src/common/` | 跨合约共享（如 `Err.sol` 的 custom errors） |
| `src/eth/` | ERC-20 类代币（`Token`、`TokenPermit`；可部署到 EVM 与 Tron TVM） |
| `src/evm/` | 链上工具合约（批量读、批量发、归集等） |

## 前置

安装 [Foundry](https://book.getfoundry.sh/getting-started/installation)。

首次克隆后若缺少 `lib/forge-std`：

```bash
cd packages/contracts
forge install --no-commit foundry-rs/forge-std
```

## 常用命令

```bash
cd packages/contracts
forge build
forge test
```

## 合约清单

- **`Token`**（[`src/eth/Token.sol`](./src/eth/Token.sol)）、**`TokenPermit`**（[`src/eth/TokenPermit.sol`](./src/eth/TokenPermit.sol)）：标准 ERC-20，后者带 EIP-2612；错误见 [`src/common/Err.sol`](./src/common/Err.sol)。

- **`BalanceBatchReader`**（[`src/evm/BalanceBatchReader.sol`](./src/evm/BalanceBatchReader.sol)）：只读批量（`getNativeBalances`、`getErc20Balances`、`getAllowances`、组合 `getBalances`）；部署后写入 `EVM_BALANCE_READER_ADDRESSES_JSON`，见 [evm-batch-balances.md](../../docs/engineering/evm-batch-balances.md) §5。

- **`BatchSender`**（[`src/evm/BatchSender.sol`](./src/evm/BatchSender.sol)）：批量发 ETH / ERC-20；写操作需发交易。建议扩展/客户端签名，服务端只构造 calldata。地址配 `EVM_BATCH_SENDER_ADDRESSES_JSON`。

- **`BatchCollector`**（[`src/evm/BatchCollector.sol`](./src/evm/BatchCollector.sol)）：多地址 `transferFrom` 归集；原生 ETH 多 EOA 同笔无签名拉取不可行，见合约 NatSpec。

测试与源码目录对应：`test/eth/`、`test/evm/`。

ABI 与部署地址由构建/部署流程注入各端（参见技术方案与 `packages/shared`）。
