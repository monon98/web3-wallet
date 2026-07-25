/**
 * # 扩展：钱包与地址生成数量上限（单一事实来源）
 *
 * 本文件**无任何 `import`**，供 `tabs/*`、`~web3/*`、`~lib/*` 安全共享，避免 Plasmo/Parcel 在标签页子 chunk 与 `web3`/`vault` 间形成初始化环。
 *
 * | 常量 | 用途 |
 * |------|------|
 * | `EVM_BATCH_IMPORT_MAX` | 侧栏 EVM「助记词批量导入」单次可生成条数上限（与 `useWalletImportForm`、`web3/evm/addressGenerator` 一致） |
 * | `ADDRESS_GENERATOR_TAB_BATCH_MAX` | 新标签页「多链地址生成器」单次「生成」条数上限（与 `generateAccountsTabHelpers` 一致） |
 * | `ADDRESS_GENERATOR_TAB_LIST_MAX` | 同一标签页「待导出列表」累计条数上限（多批「加入列表」之和） |
 *
 * 修改数值时只改本文件，并检索仓库内是否仍有硬编码副本。
 */

/** 侧栏 EVM 助记词批量导入单次上限 */
export const EVM_BATCH_IMPORT_MAX = 50 as const;

/** 地址生成标签页单次批量派生条数上限 */
export const ADDRESS_GENERATOR_TAB_BATCH_MAX = 200 as const;

/** 地址生成标签页待导出列表累计条数上限 */
export const ADDRESS_GENERATOR_TAB_LIST_MAX = 1000 as const;
