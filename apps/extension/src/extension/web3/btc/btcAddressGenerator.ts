import * as ecc from '@bitcoinerlab/secp256k1';
import { HDKey } from '@scure/bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { toHex } from 'viem';

import { ADDRESS_GENERATOR_TAB_BATCH_MAX } from '~/constants';
import type { BtcAddressScriptKind, BtcNetworkKind } from '~/types/addressGeneration';
import { expandHdPathTemplate } from '~web3/base/hd/derive';

import { defaultBtcHdPathTemplate } from './btcHdPathDefaults';

/**
 * **Bitcoin 地址批量生成**（纯函数、无 I/O）：BIP39 种子 + `@scure/bip32` + `bitcoinjs-lib`。
 *
 * 默认路径模板见 `btcHdPathDefaults`。上游：地址生成标签页 helpers；不落盘。
 */

bitcoin.initEccLib(ecc);

function btcNetworkParams(network: BtcNetworkKind) {
  return network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
}

function toXOnly(pubKey: Uint8Array): Uint8Array {
  return pubKey.length === 32 ? pubKey : pubKey.slice(1);
}

function btcPathPrefixRegex(kind: BtcAddressScriptKind, network: BtcNetworkKind): RegExp {
  const c = network === 'mainnet' ? '0' : '1';
  switch (kind) {
    case 'p2pkh':
      return new RegExp(`^m/44'/${c}'/`);
    case 'p2sh-p2wpkh':
      return new RegExp(`^m/49'/${c}'/`);
    case 'p2wpkh':
      return new RegExp(`^m/84'/${c}'/`);
    case 'p2tr':
      return new RegExp(`^m/86'/${c}'/`);
    default: {
      const _e: never = kind;
      return _e;
    }
  }
}

function btcAddressFromPubkey(pubKey: Uint8Array, kind: BtcAddressScriptKind, network: BtcNetworkKind): string {
  const buf = Buffer.from(pubKey);
  const net = btcNetworkParams(network);
  switch (kind) {
    case 'p2pkh': {
      const { address } = bitcoin.payments.p2pkh({ pubkey: buf, network: net });
      if (!address) {
        throw new Error('btc_p2pkh_failed');
      }
      return address;
    }
    case 'p2wpkh': {
      const { address } = bitcoin.payments.p2wpkh({ pubkey: buf, network: net });
      if (!address) {
        throw new Error('btc_p2wpkh_failed');
      }
      return address;
    }
    case 'p2sh-p2wpkh': {
      const redeem = bitcoin.payments.p2wpkh({ pubkey: buf, network: net });
      const { address } = bitcoin.payments.p2sh({ redeem, network: net });
      if (!address) {
        throw new Error('btc_p2sh_p2wpkh_failed');
      }
      return address;
    }
    case 'p2tr': {
      const xonly = Buffer.from(toXOnly(pubKey));
      const { address } = bitcoin.payments.p2tr({ internalPubkey: xonly, network: net });
      if (!address) {
        throw new Error('btc_p2tr_failed');
      }
      return address;
    }
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export function coerceBtcHdPathForKind(
  rawPath: string,
  kind: BtcAddressScriptKind,
  network: BtcNetworkKind
): string | null {
  const s = rawPath.trim();
  if (!s) {
    return null;
  }
  if (!btcPathPrefixRegex(kind, network).test(s)) {
    return null;
  }
  return s;
}

export type BtcGeneratedAddressRow = Readonly<{
  path: string;
  address: string;
}>;

export type GenerateBtcAddressBatchResult = { ok: true; rows: BtcGeneratedAddressRow[] } | { ok: false; error: string };

export type GenerateBtcAddressBatchInput = Readonly<{
  mnemonic: string;
  addressKind: BtcAddressScriptKind;
  btcNetwork: BtcNetworkKind;
  pathTemplate?: string;
  startIndex: number;
  count: number;
  maxCount?: number;
}>;

export function generateBtcAddressBatchFromMnemonic(
  input: GenerateBtcAddressBatchInput
): GenerateBtcAddressBatchResult {
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

  const defaultTpl = defaultBtcHdPathTemplate(input.btcNetwork, input.addressKind);
  const template = (input.pathTemplate ?? '').trim() || defaultTpl;
  const paths = expandHdPathTemplate(template, start, count);
  if (paths.length !== count) {
    return { ok: false, error: '派生路径无效：批量需包含 {index} 或以数字结尾' };
  }

  let seed: Uint8Array;
  try {
    seed = bip39.mnemonicToSeedSync(phrase);
  } catch {
    return { ok: false, error: '助记词无效' };
  }

  const root = HDKey.fromMasterSeed(seed);
  const rows: BtcGeneratedAddressRow[] = [];

  for (const rawPath of paths) {
    const path = coerceBtcHdPathForKind(rawPath, input.addressKind, input.btcNetwork);
    if (!path) {
      return {
        ok: false,
        error: `路径与脚本类型/网络不匹配（${input.addressKind} / ${input.btcNetwork}）：${rawPath}`
      };
    }
    let child: HDKey;
    try {
      child = root.derive(path);
    } catch {
      return { ok: false, error: `派生路径无效：${path}` };
    }
    if (!child.publicKey) {
      return { ok: false, error: `派生路径无效：${path}` };
    }
    let address: string;
    try {
      address = btcAddressFromPubkey(child.publicKey, input.addressKind, input.btcNetwork);
    } catch {
      return { ok: false, error: `BTC 地址编码失败：${path}` };
    }
    rows.push({ path, address });
  }

  return { ok: true, rows };
}

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58EncodeBuffer(buffer: Uint8Array): string {
  const digits: number[] = [0];
  for (let i = 0; i < buffer.length; i++) {
    let carry = buffer[i]!;
    for (let j = 0; j < digits.length; ++j) {
      carry += digits[j]! << 8;
      digits[j] = carry % 58;
      carry = Math.floor(carry / 58);
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }
  let prefix = '';
  for (let k = 0; k < buffer.length - 1 && buffer[k] === 0; k++) {
    prefix += BASE58[0];
  }
  return (
    prefix +
    [...digits]
      .reverse()
      .map((d) => BASE58[d]!)
      .join('')
  );
}

/** 压缩公钥用 WIF（尾字节 `0x01`），与 HD 派生常见用法一致。 */
export function btcPrivateKeyToWif(privateKey32: Uint8Array, network: BtcNetworkKind): string {
  if (privateKey32.length !== 32) {
    throw new Error('btc_private_key_len');
  }
  const version = network === 'mainnet' ? 0x80 : 0xef;
  const payload = new Uint8Array(1 + 32 + 1);
  payload[0] = version;
  payload.set(privateKey32, 1);
  payload[33] = 0x01;
  const checksum = bitcoin.crypto.sha256(bitcoin.crypto.sha256(payload)).subarray(0, 4);
  const encoded = new Uint8Array(payload.length + checksum.length);
  encoded.set(payload);
  encoded.set(checksum, payload.length);
  return base58EncodeBuffer(encoded);
}

/** 由助记词 + 路径得到 32 字节 secp256k1 私钥；hex / WIF 共用，避免重复派生。 */
export function btcPrivateKeyBytesFromMnemonicPath(mnemonic: string, path: string): Uint8Array | null {
  const phrase = mnemonic.trim();
  if (!bip39.validateMnemonic(phrase)) {
    return null;
  }
  let seed: Uint8Array;
  try {
    seed = bip39.mnemonicToSeedSync(phrase);
  } catch {
    return null;
  }
  const root = HDKey.fromMasterSeed(seed);
  let child: HDKey;
  try {
    child = root.derive(path.trim());
  } catch {
    return null;
  }
  const sk = child.privateKey;
  if (!sk || sk.length !== 32) {
    return null;
  }
  return sk;
}

/** 由 HD 路径节点导出 secp256k1 私钥 hex（0x 前缀），与 EVM 列对齐。 */
export function btcPrivateKeyHexFromMnemonicPath(mnemonic: string, path: string): `0x${string}` | null {
  const sk = btcPrivateKeyBytesFromMnemonicPath(mnemonic, path);
  return sk ? toHex(sk) : null;
}
