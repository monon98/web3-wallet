/**
 * 扩展内 **Web3 工具聚合**：`base`（BIP39 + EVM HD 路径/派生）、`evm` / `tvm` / `btc`（链上批量地址）。
 *
 * 数量上限见 **`~/constants`**（`extension/constants/walletLimits.ts`）。
 *
 * **`utils/vault`** 仅保留 **加密存储**（`record` / `tvmRecord`）、**解密签名**（`signing`）等，**不**放链上派生实现；新代码勿再向 vault 增加地址生成逻辑。
 */
export * from './base/index';
export * from './btc';
export * from './evm/index';
export * from './tvm/index';
