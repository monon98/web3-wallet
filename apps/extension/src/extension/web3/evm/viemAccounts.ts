import type { HDAccount } from 'viem/accounts';
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts';

/**
 * EVM 三方库封装：统一收口 `viem/accounts` 的账户构造函数与类型。
 */

export { mnemonicToAccount, privateKeyToAccount };

/**
 * 任意 BIP32 路径派生 HD 账户（viem 类型字面量收窄在 EVM 前缀；**运行时**可用于同曲线 TVM `m/44'/195'/…` 等路径）。
 */
export function mnemonicToAccountForHdPath(mnemonic: string, path: string): HDAccount {
  return mnemonicToAccount(mnemonic.trim(), { path: path as never });
}
