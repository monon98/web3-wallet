import { createHash } from 'node:crypto';

/**
 * 比特币**主网**地址校验（P2PKH / P2SH / SegWit v0 / Taproot v1）。
 *
 * - **Base58check**：`1...`（P2PKH，版本字节 `0x00`）与 `3...`（P2SH，`0x05`）；
 *   payload 21 字节 + 4 字节校验和（双 SHA-256 前 4 字节）。
 * - **Bech32 / Bech32m**：`bc1...`，hrp 固定 `bc`；v0（P2WPKH 20 字节 / P2WSH 32 字节）用 bech32，
 *   v1（P2TR 32 字节）用 bech32m；仅允许全小写或全大写，混用非法。
 *
 * 仅做格式与校验和验证（不校验地址是否已上链、脚本是否可花费）。
 * 上游入口：`routes/btcGateway.ts`、`btc/esplora.ts`。
 */

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const BASE58_VALUE = new Map<string, number>(
  [...BASE58_ALPHABET].map((ch, index) => [ch, index])
);

const BECH32_ALPHABET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

const BECH32_VALUE = new Map<string, number>(
  [...BECH32_ALPHABET].map((ch, index) => [ch, index])
);

/** Bech32m 校验常数（BIP-350）；bech32（v0）的校验结果为 `1` */
const BECH32M_CONST = 0x2bc830a3;

const BECH32_GENERATOR = [
  0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3
] as const;

function decodeBase58(input: string): Buffer | null {
  let leadingZeros = 0;
  while (leadingZeros < input.length && input[leadingZeros] === '1') {
    leadingZeros += 1;
  }

  const digits: number[] = [];
  for (const ch of input) {
    const value = BASE58_VALUE.get(ch);
    if (value === undefined) {
      return null;
    }
    let carry = value;
    for (let i = 0; i < digits.length; i += 1) {
      const x = digits[i]! * 58 + carry;
      digits[i] = x & 0xff;
      carry = x >> 8;
    }
    while (carry > 0) {
      digits.push(carry & 0xff);
      carry >>= 8;
    }
  }

  digits.reverse();
  return Buffer.from([...new Array<number>(leadingZeros).fill(0), ...digits]);
}

function isBase58CheckAddress(value: string): boolean {
  if (value.length < 26 || value.length > 35) {
    return false;
  }

  const decoded = decodeBase58(value);
  if (decoded === null || decoded.length !== 25) {
    return false;
  }
  // 仅接受主网 P2PKH（0x00）与 P2SH（0x05）；测试网（0x6f / 0xc4）等暂不支持
  if (decoded[0] !== 0x00 && decoded[0] !== 0x05) {
    return false;
  }

  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const second = createHash('sha256')
    .update(createHash('sha256').update(payload).digest())
    .digest();

  return second.subarray(0, 4).equals(checksum);
}

function bech32Polymod(values: readonly number[]): number {
  let chk = 1;
  for (const value of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i += 1) {
      if ((top >>> i) & 1) {
        chk ^= BECH32_GENERATOR[i]!;
      }
    }
  }
  return chk >>> 0;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (const ch of hrp) {
    out.push(ch.charCodeAt(0) >> 5);
  }
  out.push(0);
  for (const ch of hrp) {
    out.push(ch.charCodeAt(0) & 31);
  }
  return out;
}

/** 5-bit 分组 → 8-bit 字节；`pad=false` 时要求无残余位且零填充 */
function convertBits(
  data: readonly number[],
  from: number,
  to: number,
  pad: boolean
): number[] | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  const maxv = (1 << to) - 1;

  for (const value of data) {
    if (value < 0 || value >> from !== 0) {
      return null;
    }
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) {
      bits -= to;
      out.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      out.push((acc << (to - bits)) & maxv);
    }
  } else if (bits >= from || ((acc << (to - bits)) & maxv) !== 0) {
    return null;
  }

  return out;
}

function isSegwitAddress(value: string): boolean {
  if (value.length > 90) {
    return false;
  }
  const lower = value.toLowerCase();
  if (value !== lower && value !== value.toUpperCase()) {
    return false;
  }

  const separator = lower.lastIndexOf('1');
  if (separator < 1 || separator + 7 > lower.length) {
    return false;
  }
  const hrp = lower.slice(0, separator);
  if (hrp !== 'bc') {
    return false;
  }

  const data: number[] = [];
  for (const ch of lower.slice(separator + 1)) {
    const v = BECH32_VALUE.get(ch);
    if (v === undefined) {
      return false;
    }
    data.push(v);
  }

  const payload = data.slice(0, -6);
  if (payload.length < 2) {
    return false;
  }
  const version = payload[0]!;
  if (version > 16) {
    return false;
  }

  const program = convertBits(payload.slice(1), 5, 8, false);
  if (program === null || program.length < 2 || program.length > 40) {
    return false;
  }
  if (version === 0 && program.length !== 20 && program.length !== 32) {
    return false;
  }
  // 当前仅支持 v0（P2WPKH / P2WSH）与 v1（P2TR）；更高版本尚无标准
  if (version >= 1 && program.length !== 32) {
    return false;
  }

  const expected = version === 0 ? 1 : BECH32M_CONST;
  return bech32Polymod([...hrpExpand(hrp), ...data]) === expected;
}

/** 是否为合法比特币**主网**地址（P2PKH / P2SH / bech32 / bech32m）。 */
export function isBtcMainnetAddress(value: string): boolean {
  if (value.length === 0 || value.length > 90) {
    return false;
  }
  if (value.toLowerCase().startsWith('bc1')) {
    return isSegwitAddress(value);
  }
  if (value.startsWith('1') || value.startsWith('3')) {
    return isBase58CheckAddress(value);
  }
  return false;
}
