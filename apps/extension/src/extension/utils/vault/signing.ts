import type { Hex } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';

import { coerceEvmHdPath, DEFAULT_HD_PATH } from '~web3/base/hd/derive';
import { bytesToHex, getAddress, hexToBytes, isHex } from '~web3/evm/viem';
import { mnemonicToAccount, privateKeyToAccount } from '~web3/evm/viemAccounts';

import { decryptUtf8WithPassword } from './crypto';
import { getWalletAccountStoredByAddress } from './record';

/**
 * **解密 + viem 可签名账户**：从 `record` 取密文，用户口令解密后构造 `mnemonicToAccount` / `privateKeyToAccount`。
 * 与 `personal_sign` / EIP-712 弹窗流程衔接；**不得**在 content script 调用。
 *
 * 解密或 JSON 解析失败时**静默**返回 `null`（视为口令错误 or 损坏），**勿**为此路径添加含口令或明文的日志。
 */

export type UnlockableLocalAccount = PrivateKeyAccount | ReturnType<typeof mnemonicToAccount>;

/**
 * 使用账户加密口令解密并得到可签名本地账户；口令错误或地址不匹配时返回 null。
 */
export async function unlockLocalAccountForAddress(
  address: `0x${string}`,
  password: string
): Promise<UnlockableLocalAccount | null> {
  const stored = await getWalletAccountStoredByAddress(address);
  if (!stored) {
    return null;
  }
  let plaintext: string;
  try {
    plaintext = await decryptUtf8WithPassword(stored, password);
  } catch {
    return null;
  }
  let parsed: { k?: string; v?: string; p?: string };
  try {
    parsed = JSON.parse(plaintext) as { k?: string; v?: string; p?: string };
  } catch {
    return null;
  }
  if (parsed.k === 'm' && typeof parsed.v === 'string') {
    const path = typeof parsed.p === 'string' ? coerceEvmHdPath(parsed.p) : null;
    const acc = mnemonicToAccount(parsed.v.trim(), { path: path ?? DEFAULT_HD_PATH });
    if (getAddress(acc.address) !== getAddress(address)) {
      return null;
    }
    return acc;
  }
  if (parsed.k === 'p' && typeof parsed.v === 'string') {
    const acc = privateKeyToAccount(parsed.v.trim() as `0x${string}`);
    if (getAddress(acc.address) !== getAddress(address)) {
      return null;
    }
    return acc;
  }
  return null;
}

/**
 * `personal_sign` 首参编码为待签名的原始字节（hex）：若为合法 hex 则按字节解析，否则按 UTF-8 编码。
 */
export function personalSignPayloadToHex(firstParam: string): `0x${string}` {
  const s = firstParam;
  if (isHex(s, { strict: false })) {
    const h = (s.startsWith('0x') || s.startsWith('0X') ? s : `0x${s}`) as Hex;
    return h as `0x${string}`;
  }
  return bytesToHex(new TextEncoder().encode(s)) as `0x${string}`;
}

/**
 * 用于弹窗展示的简短说明（避免二进制刷屏）。**勿**将返回的全文写入 `extLog` / 持久化日志。
 */
export function formatPersonalSignPreview(messageHex: `0x${string}`):
  | {
      kind: 'utf8';
      text: string;
    }
  | { kind: 'hex'; short: string } {
  let bytes: Uint8Array;
  try {
    bytes = hexToBytes(messageHex);
  } catch {
    return { kind: 'hex', short: `${messageHex.slice(0, 22)}…` };
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (text.length > 2000) {
      return { kind: 'utf8', text: `${text.slice(0, 2000)}…` };
    }
    return { kind: 'utf8', text };
  } catch {
    const len = bytes.length;
    return {
      kind: 'hex',
      short: len <= 20 ? messageHex : `${messageHex.slice(0, 22)}…(${len} bytes)`
    };
  }
}
