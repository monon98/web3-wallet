import type { Hex } from 'viem';

import { getAddress, isHex, size } from '~web3/evm/viem';
import { mnemonicToAccount, privateKeyToAccount } from '~web3/evm/viemAccounts';

/**
 * **EVM HD 派生与路径工具**（纯函数、无 I/O）：助记词 / 私钥 → 校验和地址；路径模板展开；私钥规范化。
 *
 * 与 `vault/signing.unlockLocalAccountForAddress` 使用的默认路径必须一致。
 *
 * 物理路径在 **`extension/web3/base/hd/`**（链上基础能力）；**不在** `utils/vault`（vault 仅持久化与解密签名）。
 */

/** BIP44 首个以太坊接收地址（导入/签名须一致） */
export const DEFAULT_HD_PATH = "m/44'/60'/0'/0/0" as const;
const DEFAULT_PATH = DEFAULT_HD_PATH;

export type EvmHdPath = `m/44'/60'/${string}`;

export function coerceEvmHdPath(input: string): EvmHdPath | null {
  const s = input.trim();
  if (!s) {
    return null;
  }
  if (!/^m\/44'\/60'\/.+/.test(s)) {
    return null;
  }
  return s as EvmHdPath;
}

export function deriveEvmAddressFromMnemonic(mnemonic: string, path: EvmHdPath = DEFAULT_PATH): `0x${string}` {
  const account = mnemonicToAccount(mnemonic.trim(), { path });
  return getAddress(account.address);
}

export function deriveEvmAddressFromPrivateKey(privateKey: `0x${string}`): `0x${string}` {
  return getAddress(privateKeyToAccount(privateKey).address);
}

/**
 * 将 HD 路径按 index 展开为一组路径。
 * - 若包含 `{index}` 占位符，则替换该占位符
 * - 否则尝试递增最后一个数值段（支持末尾带 `'` 的 hardened 段）
 */
export function expandHdPathTemplate(template: string, startIndex: number, count: number): string[] {
  const t = template.trim();
  if (count <= 0) {
    return [];
  }
  const hasPlaceholder = t.includes('{index}');
  if (hasPlaceholder) {
    return Array.from({ length: count }, (_, i) => t.replaceAll('{index}', String(startIndex + i)));
  }
  const m = t.match(/^(.*\/)(\d+)('?)$/);
  if (!m) {
    return count === 1 ? [t] : [];
  }
  const prefix = m[1];
  const base = Number(m[2]);
  const hard = m[3] ?? '';
  if (!Number.isFinite(base)) {
    return count === 1 ? [t] : [];
  }
  return Array.from({ length: count }, (_, i) => `${prefix}${base + startIndex + i}${hard}`);
}

/** 接受带或不带 0x 的 64 位十六进制私钥 */
export function normalizePrivateKeyInput(input: string): `0x${string}` | null {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) {
    return null;
  }
  const body = /^0x/i.test(s) ? s.slice(2) : s;
  const with0x = `0x${body.toLowerCase()}` as `0x${string}`;
  if (!isHex(with0x as Hex)) {
    return null;
  }
  if (size(with0x as Hex) !== 32) {
    return null;
  }
  return with0x;
}
