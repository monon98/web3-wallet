/**
 * EVM **演示/工具**方法：`generateAccounts` 用于 `tabs/generateAccounts` 等多地址展示；
 * 与侧栏导入使用的 **单路径** `~web3/base/hd/derive` 的 `DEFAULT_HD_PATH` 不同，勿当作主钱包派生源。
 */
import { toHex } from 'viem';
import { mnemonicToAccount, type HDOptions } from 'viem/accounts';

import type { IAccount } from '~/types';

/**
 * 由助记词按 HD 参数批量派生账户（含路径与私钥 hex），供新标签演示页使用。
 */
export const generateAccounts = (
  mnemonic: string,
  count: number = 1,
  options: HDOptions = { accountIndex: 0, addressIndex: 0, changeIndex: 0 }
): IAccount[] => {
  const { accountIndex, addressIndex, changeIndex } = options;
  const accounts = Array.from({ length: count }, (_, i) =>
    mnemonicToAccount(mnemonic, {
      accountIndex: accountIndex,
      addressIndex: addressIndex,
      changeIndex: changeIndex + i
    })
  );
  return accounts.map((account, index) => ({
    mnemonic,
    path: `m/44'/60'/${accountIndex}'/${changeIndex}/${addressIndex + index}`,
    privateKey: toHex(account.getHdKey().privateKey),
    ...account
  }));
};
