import * as bip39 from 'bip39';

import { ADDRESS_GENERATOR_TAB_BATCH_MAX, EVM_BATCH_IMPORT_MAX } from '~/constants';
import {
  coerceEvmHdPath,
  deriveEvmAddressFromMnemonic,
  deriveEvmAddressFromPrivateKey,
  expandHdPathTemplate,
  normalizePrivateKeyInput,
  type EvmHdPath
} from '~web3/base/hd/derive';

/**
 * **EVM 地址批量生成**（纯函数、无 I/O）：路径模板与侧栏「助记词批量导入」一致。
 *
 * 上游：`useWalletImportForm`、`tabs/generateAccounts`、`generateAccountsTabHelpers`。
 * 信任边界：不落盘；不得将助记词/私钥写入日志（见仓库 Web3 安全规则）。
 */

/** 与批量导入表单默认模板一致 */
export const DEFAULT_EVM_HD_PATH_TEMPLATE = "m/44'/60'/0'/0/{index}" as const;

/** 侧栏批量导入单次上限（与 `useWalletImportForm` 一致） */
export const EVM_ADDRESS_BATCH_IMPORT_MAX = EVM_BATCH_IMPORT_MAX;

/** 地址生成标签页等只读场景单次上限 */
export const EVM_ADDRESS_BATCH_DEV_MAX = ADDRESS_GENERATOR_TAB_BATCH_MAX;

export type EvmGeneratedAddressRow = Readonly<{
  path: EvmHdPath;
  address: `0x${string}`;
}>;

export type GenerateEvmAddressBatchResult = { ok: true; rows: EvmGeneratedAddressRow[] } | { ok: false; error: string };

export type GenerateEvmAddressBatchInput = Readonly<{
  mnemonic: string;
  pathTemplate?: string;
  startIndex: number;
  count: number;
  /** 单次生成条数上限；默认 {@link EVM_ADDRESS_BATCH_IMPORT_MAX} */
  maxCount?: number;
}>;

/**
 * 按 BIP39 助记词 + HD 路径模板批量生成校验和地址列表。
 */
export function generateEvmAddressBatchFromMnemonic(
  input: GenerateEvmAddressBatchInput
): GenerateEvmAddressBatchResult {
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
  const maxCount = input.maxCount ?? EVM_BATCH_IMPORT_MAX;
  if (!Number.isInteger(count) || count < 1 || count > maxCount) {
    return { ok: false, error: `数量无效（1～${maxCount}）` };
  }

  const template = (input.pathTemplate ?? '').trim() || DEFAULT_EVM_HD_PATH_TEMPLATE;
  const paths = expandHdPathTemplate(template, start, count);
  if (paths.length !== count) {
    return { ok: false, error: '派生路径无效：批量导入需包含 {index} 或以数字结尾' };
  }

  const rows: EvmGeneratedAddressRow[] = [];
  for (const rawPath of paths) {
    const path = coerceEvmHdPath(rawPath);
    if (!path) {
      return { ok: false, error: `派生路径无效（需以 m/44'/60'/ 开头）：${rawPath}` };
    }
    let address: `0x${string}`;
    try {
      address = deriveEvmAddressFromMnemonic(phrase, path);
    } catch {
      return { ok: false, error: `派生路径无效：${path}` };
    }
    rows.push({ path, address });
  }

  return { ok: true, rows };
}

export type GenerateEvmAddressFromPrivateKeyInputResult =
  | { ok: true; address: `0x${string}` }
  | { ok: false; error: string };

/**
 * 由私钥十六进制字符串解析并返回对应 EVM 地址（checksum）。
 */
export function generateEvmAddressFromPrivateKeyInput(
  privateKeyInput: string
): GenerateEvmAddressFromPrivateKeyInputResult {
  const pk = normalizePrivateKeyInput(privateKeyInput);
  if (!pk) {
    return { ok: false, error: '私钥格式无效（需 32 字节十六进制，可带 0x）' };
  }
  return { ok: true, address: deriveEvmAddressFromPrivateKey(pk) };
}
