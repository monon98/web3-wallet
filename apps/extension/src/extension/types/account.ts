import type { HDAccount } from 'viem/accounts';

/**
 * **`tabs/generateAccounts` 工具页**：viem HD 账户 + 明文 `path` / `privateKey` / `mnemonic`；
 * 正式钱包导入勿用此类型，应走 `vault/record` 加密存储。
 */
export interface IAccount extends Omit<HDAccount, 'getHdKey'> {
  mnemonic: string;
  path: string;
  privateKey: string;
}
