# EVM：多地址原生币与代币批量查询（技术备忘）

本文档归纳**多地址 + 原生币 / ERC-20** 的常见技术路径，与仓库内 **Etherscan 封装**行为对照；**非**架构变更声明，细节仍以 [TECHNICAL-SOLUTION.md](./TECHNICAL-SOLUTION.md) 为准。

---

## 1. 目标与两类需求

- **已知代币合约列表**（例如 USDC、USDT、WETH）：需要多个地址在这些代币上的 `balanceOf`，以及/或多地址**原生币**余额。
- **未知代币全集**（「某地址链上持有过的所有 ERC-20」）：依赖**链下索引**（扫 `Transfer`、The Graph、浏览器类 API 等），**无法**仅靠标准链上只读在一条调用里「枚举出来」。

---

## 2. 链上只读：Multicall3 或自建聚合合约

- **做法**：对已部署的 **Multicall3**（主网/L2 常见固定地址）发起 **`eth_call`**，将多笔静态调用打包为一次或少数几次调用；或部署**只读聚合合约**，在 `view` 内循环 `IERC20(token).balanceOf(holder)` 并返回数组。
- **前提**：**代币列表事先明确**；调用规模受 **单次 `eth_call` 的执行 gas 上限**与**返回数据大小**约束，过大需**拆批**。
- **原生币**：Multicall3 提供 **`getEthBalance(address)`**，可与 `balanceOf` 同批组合。
- **与 gas 的关系**（易混点）：
  - 对用户：**不发交易**，**不消耗链上 gas**（无 ETH 账单）。
  - 对节点：模拟执行仍有内部 **gas limit**；超限可能 revert 或 RPC 失败。
  - RPC 提供商可能有**请求次数/配额**限制，属商业限流，不是链上 gas。

---

## 3. JSON-RPC 批量请求

- 可将多个 `eth_getBalance` / `eth_call` 打在**一个 HTTP 请求体**（JSON-RPC batch）里，减少往返；节点仍按多条逻辑调用计费或限流，**不等于**链上单次 Multicall 的算力模型。

---

## 4. 本仓库服务端：Etherscan V2 封装（`apps/server`）

| 能力                       | API 形态（概要）                                                                                       | 说明                                                                                  |
| -------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 多地址**原生币**           | `module=account&action=balance`，`address` 为**逗号分隔**多地址                                        | 与官方一致，单次地址数上限见代码常量 `ETHERSCAN_MAX_BALANCE_ADDRESSES`（当前 **20**） |
| 单地址 **ERC-20 持仓列表** | `action=addresstokenbalance`，**单个** `address`，分页 `page`/`offset`                                 | PRO 端点，供应商侧约 **2 次/秒** 限流                                                 |
| 多地址持仓（应用层）       | 对多个地址**串行**调用 `addresstokenbalance`，间隔 **`ETHERSCAN_PRO_MIN_INTERVAL_MS`**（默认约 550ms） | **并非** Etherscan 提供「逗号多地址一次返回」的代币持仓接口                           |

实现入口：`apps/server/src/evm/etherscanV2.ts`；HTTP 路由见技术方案 **§5.2**。

---

## 5. 本仓库：链上聚合合约 + 服务端 API

| 组件         | 说明                                                                                                                                                                                                                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 合约         | [`evm/BalanceBatchReader.sol`](../../packages/contracts/src/evm/BalanceBatchReader.sol)（`BalanceBatchReader`）：**原子化** `getNativeBalances` / `getErc20Balances` / `getAllowances(token,spender,holders)`；组合方法 `getBalances` 与 HTTP 现网一致。`getAllowances` 为同一代币下多 owner 对同一 spender 的 `allowance`。 |
| 环境变量     | `EVM_BALANCE_READER_ADDRESSES_JSON`：`{"<chainId>":"0xReader..."}`；与 `SERVER_RPC_URL` 指向的链一致。                                                                                                                                                                                             |
| HTTP         | `POST /api/v1/evm/balance-reader/query`，请求体见 `@plugin/shared` `evmBalanceReaderQueryRequestSchema`（`chainId`、`addresses`、`tokenAddresses` 可选，默认 `[]` 仅查原生）。                                                                                                                     |
| 限额（阶梯） | 代币合约 **≤10**；**仅原生**：地址 **≤300**；**带代币**：地址 **≤ min(200, ⌊1000 / 代币数⌋)**（且隐含 **地址×代币 ≤ 1000**）。常量见 `evm-balance-reader.ts`。                                                                                                                                     |

实现入口：`apps/server/src/evm/balanceReaderQuery.ts`。

---

## 6. 选型简表

| 场景                                 | 较合适方式                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------- |
| 多地址 + 多**已知**代币余额 + 原生币 | **Multicall3** 或自建 **view 聚合合约** + 必要时拆批                        |
| 多地址原生币、接受索引商数据         | **Etherscan `balance`** 多地址（受官方/代码上限约束）                       |
| 每地址「有哪些代币」                 | **索引 / `addresstokenbalance` 类 API**，多地址则多次请求或并发（注意限流） |

---

## 相关文档

- [server.md](./server.md)（服务端入口）
- [Runbook：server-evm-etherscan.md](../runbook/server-evm-etherscan.md)（Etherscan 限流与 RPC 代理排障）
