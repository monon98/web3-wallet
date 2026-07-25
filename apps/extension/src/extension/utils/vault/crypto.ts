/**
 * **账户包加密**（Web Crypto，SubtleCrypto）：PBKDF2 派生 AES-GCM 密钥；**明文助记词/私钥 JSON 仅存在于加密前的内存**，
 * 密文与随机 salt/iv 写入 `record` 的 `AccountsBundle`。**口令从不持久化**。
 *
 * **禁止**在本模块使用 `extLog` / `console` 输出明文口令、助记词、私钥或解密结果。
 */

const PBKDF2_ITERATIONS = 200_000;

function u8ToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

function b64ToU8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** @returns Base64 包装的 salt / iv / ciphertext，可 JSON 存入 storage */
export async function encryptUtf8WithPassword(
  plaintext: string,
  password: string
): Promise<{ saltB64: string; ivB64: string; cipherB64: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(password, salt);
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    enc.encode(plaintext)
  );
  const cipher = new Uint8Array(cipherBuf);
  return {
    saltB64: u8ToB64(salt),
    ivB64: u8ToB64(iv),
    cipherB64: u8ToB64(cipher)
  };
}

/** 口令错误时 `decrypt` 抛错，由调用方捕获为失败路径 */
export async function decryptUtf8WithPassword(
  bundle: { saltB64: string; ivB64: string; cipherB64: string },
  password: string
): Promise<string> {
  const salt = b64ToU8(bundle.saltB64);
  const iv = b64ToU8(bundle.ivB64);
  const cipher = b64ToU8(bundle.cipherB64);
  const key = await deriveAesKey(password, salt);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    cipher as BufferSource
  );
  return new TextDecoder().decode(plainBuf);
}
