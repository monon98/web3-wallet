import * as bip39 from 'bip39';
import { toHex } from 'viem';

import { ADDRESS_GENERATOR_TAB_BATCH_MAX } from '~/constants';
import { expandHdPathTemplate } from '~web3/base/hd/derive';
import { mnemonicToAccountForHdPath } from '~web3/evm/viemAccounts';
import { tronWebAddressApi } from '~web3/tvm/tronWeb';

/**
 * **TVM(Tron) 地址批量生成**（纯函数、无 I/O）：助记词 + BIP44 路径 `m/44'/195'/…`。
 *
 * 上游：地址生成标签页 helpers；不落盘。
 */

export type TvmHdPath = `m/44'/195'/${string}`;

export function coerceTvmHdPath(input: string): TvmHdPath | null {
  const s = input.trim();
  if (!s) {
    return null;
  }
  if (!/^m\/44'\/195'\/.+/.test(s)) {
    return null;
  }
  return s as TvmHdPath;
}

export const DEFAULT_TVM_HD_PATH_TEMPLATE = "m/44'/195'/0'/0/{index}" as const;

export type TvmGeneratedAddressRow = Readonly<{
  path: TvmHdPath;
  addressBase58: string;
  addressHex: string;
}>;

export type GenerateTvmAddressBatchResult = { ok: true; rows: TvmGeneratedAddressRow[] } | { ok: false; error: string };

export type GenerateTvmAddressBatchInput = Readonly<{
  mnemonic: string;
  pathTemplate?: string;
  startIndex: number;
  count: number;
  maxCount?: number;
}>;

export function generateTvmAddressBatchFromMnemonic(
  input: GenerateTvmAddressBatchInput
): GenerateTvmAddressBatchResult {
  const phrase = input.mnemonic.trim();
  if (!phrase) {
    return { ok: false, error: '请输入助记词' };
  }
  if (!bip39.validateMnemonic(phrase)) {
    return { ok: false, error: '助记词无效' };
  }

  const start = input.startIndex;
  if (!Number.isInteger(start) || start < 0 || start > 2_147_483_647) {
    return { ok: false, error: '起始 index 无效（需为非负整数）' };
  }

  const count = input.count;
  const maxCount = input.maxCount ?? ADDRESS_GENERATOR_TAB_BATCH_MAX;
  if (!Number.isInteger(count) || count < 1 || count > maxCount) {
    return { ok: false, error: `数量无效（1～${maxCount}）` };
  }

  const template = (input.pathTemplate ?? '').trim() || DEFAULT_TVM_HD_PATH_TEMPLATE;
  const paths = expandHdPathTemplate(template, start, count);
  if (paths.length !== count) {
    return { ok: false, error: '派生路径无效：批量需包含 {index} 或以数字结尾' };
  }

  const addrApi = tronWebAddressApi();
  const rows: TvmGeneratedAddressRow[] = [];

  for (const rawPath of paths) {
    const path = coerceTvmHdPath(rawPath);
    if (!path) {
      return { ok: false, error: `派生路径无效（需以 m/44'/195'/ 开头）：${rawPath}` };
    }
    let account;
    try {
      account = mnemonicToAccountForHdPath(phrase, path);
    } catch {
      return { ok: false, error: `派生路径无效：${path}` };
    }
    const pkHex = toHex(account.getHdKey().privateKey).replace(/^0x/i, '');
    const base58 = addrApi.fromPrivateKey(pkHex);
    if (base58 === false) {
      return { ok: false, error: 'TVM 地址派生失败' };
    }
    let hex: string;
    try {
      hex = addrApi.toHex(base58);
    } catch {
      return { ok: false, error: 'TVM 地址派生失败' };
    }
    if (!/^41[0-9a-fA-F]{40}$/.test(hex)) {
      return { ok: false, error: 'TVM 地址派生失败' };
    }
    rows.push({ path, addressBase58: base58, addressHex: hex.toUpperCase() });
  }

  return { ok: true, rows };
}
