import { createHash } from 'node:crypto';

/**
 * Tron 可视地址（base58check，`T...`）校验。
 *
 * 结构：**21 字节 payload**（首字节 `0x41` 前缀）+ **4 字节校验和**
 * （payload 双 SHA-256 的前 4 字节）→ base58 → 固定 34 个字符。
 *
 * 仅做格式与校验和验证（不校验账户是否已上链）。
 */

const BASE58_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

const BASE58_VALUE = new Map<string, number>(
  [...BASE58_ALPHABET].map((ch, index) => [ch, index])
);

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

/** 是否为合法 Tron base58 地址（`T...`、34 字符、校验和正确）。 */
export function isTronBase58Address(value: string): boolean {
  if (value.length !== 34 || !value.startsWith('T')) {
    return false;
  }

  const decoded = decodeBase58(value);
  if (decoded === null || decoded.length !== 25 || decoded[0] !== 0x41) {
    return false;
  }

  const payload = decoded.subarray(0, 21);
  const checksum = decoded.subarray(21);
  const second = createHash('sha256')
    .update(createHash('sha256').update(payload).digest())
    .digest();

  return second.subarray(0, 4).equals(checksum);
}
