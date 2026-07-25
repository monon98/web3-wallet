import type { TvmAccountsBundleV1, TvmAccountStored, TvmAccountSummary } from '~/types/vault';
import { extLogWarn } from '~lib/extensionLog';
import { tronWebAddressApi, tronWebCreateAccount } from '~web3/tvm/tronWeb';

import { encryptUtf8WithPassword } from './crypto';

/**
 * **TVM(Tron) 加密账户包**（`chrome.storage.local`）：多条 `TvmAccountStored`（私钥经 AES 加密后的 payload）。
 * 仅暴露摘要列表给 UI；解密与签名能力后续可在独立模块中接入。
 *
 * 加载时若某条地址无法通过 TronWeb 地址校验则丢弃该条，并打 `tvm_vault_bundle_coerce`（不记录私钥/密文）。
 */

export const TVM_ACCOUNTS_BUNDLE_STORAGE_KEY = 'web3_wallet_tvm_accounts_bundle_v1' as const;
const ACCOUNTS_BUNDLE_KEY = TVM_ACCOUNTS_BUNDLE_STORAGE_KEY;

function isBundle(raw: unknown): raw is TvmAccountsBundleV1 {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const o = raw as Record<string, unknown>;
  if (o.version !== 1 || !Array.isArray(o.accounts)) {
    return false;
  }
  return o.accounts.every((a) => {
    if (!a || typeof a !== 'object') {
      return false;
    }
    const x = a as Record<string, unknown>;
    return (
      typeof x.id === 'string' &&
      typeof x.label === 'string' &&
      x.walletKind === 'privateKey' &&
      typeof x.saltB64 === 'string' &&
      typeof x.ivB64 === 'string' &&
      typeof x.cipherB64 === 'string' &&
      typeof x.addressBase58 === 'string' &&
      typeof x.addressHex === 'string'
    );
  });
}

/** 与入库明文 `{ k:'p', v }` 一致：64 位十六进制私钥（无 `0x`）。 */
function normalizePrivateKeyHexInput(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  const hex = s.startsWith('0x') ? s.slice(2) : s;
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    return null;
  }
  return hex;
}

function normalizeAddressPair(input: { base58: string; hex: string } | { base58: unknown; hex: unknown } | null): {
  base58: string;
  hex: string;
} | null {
  if (!input) {
    return null;
  }
  const base58 = typeof (input as { base58?: unknown }).base58 === 'string' ? (input as { base58: string }).base58 : '';
  const hex = typeof (input as { hex?: unknown }).hex === 'string' ? (input as { hex: string }).hex : '';
  try {
    const expectedHex = tronWebAddressApi().toHex(base58);
    if (typeof expectedHex !== 'string' || !/^41[0-9a-fA-F]{40}$/.test(expectedHex)) {
      return null;
    }
  } catch {
    return null;
  }
  if (!/^41[0-9a-fA-F]{40}$/.test(hex)) {
    return null;
  }
  return { base58, hex: hex.toUpperCase() };
}

async function loadBundle(): Promise<TvmAccountsBundleV1> {
  const bag = await chrome.storage.local.get(ACCOUNTS_BUNDLE_KEY);
  const raw = bag[ACCOUNTS_BUNDLE_KEY];
  if (!isBundle(raw)) {
    return { version: 1, accounts: [] };
  }
  const accounts: TvmAccountStored[] = [];
  let skippedInvalidAddress = 0;
  for (const a of raw.accounts) {
    try {
      const hex = tronWebAddressApi().toHex(a.addressBase58);
      if (!/^41[0-9a-fA-F]{40}$/.test(hex) || !/^41[0-9a-fA-F]{40}$/.test(a.addressHex)) {
        skippedInvalidAddress += 1;
        continue;
      }
    } catch {
      skippedInvalidAddress += 1;
      continue;
    }
    accounts.push({
      ...a,
      addressHex: a.addressHex.toUpperCase()
    });
  }
  if (skippedInvalidAddress > 0) {
    extLogWarn('tvm_vault_bundle_coerce', { reason: 'invalid_address_record', skippedCount: skippedInvalidAddress });
  }
  return { version: 1, accounts };
}

async function saveBundle(bundle: TvmAccountsBundleV1): Promise<void> {
  await chrome.storage.local.set({ [ACCOUNTS_BUNDLE_KEY]: bundle });
}

export async function listTvmAccountSummaries(): Promise<TvmAccountSummary[]> {
  const { accounts } = await loadBundle();
  return accounts.map(({ id, label, walletKind, addressBase58, addressHex }) => ({
    id,
    label,
    walletKind,
    addressBase58,
    addressHex
  }));
}

export async function hasTvmAccounts(): Promise<boolean> {
  const { accounts } = await loadBundle();
  return accounts.length > 0;
}

/** 列表首条摘要；无账户时 `null`（与 `record.getFirstWalletAccountAddress` 对齐用途）。 */
export async function getFirstTvmAccountSummary(): Promise<TvmAccountSummary | null> {
  const { accounts } = await loadBundle();
  const first = accounts[0];
  if (!first) {
    return null;
  }
  return {
    id: first.id,
    label: first.label,
    walletKind: first.walletKind,
    addressBase58: first.addressBase58,
    addressHex: first.addressHex
  };
}

/**
 * 按 Base58（`T...`）或 hex（`41...` / 可选 `0x` 前缀）查找本地加密账户；供后续 TVM 签名解密等路径使用。
 */
export async function getTvmAccountStoredByAddress(addressInput: string): Promise<TvmAccountStored | null> {
  const { accounts } = await loadBundle();
  const trimmed = addressInput.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('T')) {
    const hit = accounts.find((a) => a.addressBase58 === trimmed);
    return hit ?? null;
  }
  const hexNorm = trimmed.replace(/^0x/i, '').toUpperCase();
  if (/^41[0-9A-F]{40}$/.test(hexNorm)) {
    const hit = accounts.find((a) => a.addressHex.toUpperCase() === hexNorm);
    return hit ?? null;
  }
  try {
    const converted = tronWebAddressApi().toHex(trimmed).toUpperCase();
    if (/^41[0-9A-F]{40}$/.test(converted)) {
      return accounts.find((a) => a.addressHex.toUpperCase() === converted) ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export async function addTvmAccountFromPrivateKey(
  privateKeyInput: string,
  password: string,
  label?: string
): Promise<TvmAccountStored> {
  const pk = normalizePrivateKeyHexInput(privateKeyInput);
  if (!pk) {
    throw new Error('invalid_private_key');
  }

  const addrApi = tronWebAddressApi();
  const base58 = addrApi.fromPrivateKey(pk);
  if (base58 === false) {
    throw new Error('invalid_private_key');
  }
  const hex = addrApi.toHex(base58);
  const pair = normalizeAddressPair({ base58, hex });
  if (!pair) {
    throw new Error('invalid_address_derived');
  }

  const plaintext = JSON.stringify({ k: 'p', v: pk });
  const { saltB64, ivB64, cipherB64 } = await encryptUtf8WithPassword(plaintext, password);
  const bundle = await loadBundle();
  const id = crypto.randomUUID();
  const acc: TvmAccountStored = {
    id,
    label: (label?.trim() || `Tron 账户 ${bundle.accounts.length + 1}`).slice(0, 48),
    walletKind: 'privateKey',
    saltB64,
    ivB64,
    cipherB64,
    addressBase58: pair.base58,
    addressHex: pair.hex
  };
  await saveBundle({ version: 1, accounts: [...bundle.accounts, acc] });
  return acc;
}

/**
 * 生成一条新 Tron 账户并直接加密入库。
 * 注意：该 API 会在内存中产生明文私钥；调用方应避免日志/上报，并尽快结束生命周期。
 */
export async function generateAndAddTvmAccount(password: string, label?: string): Promise<TvmAccountStored> {
  const created = await tronWebCreateAccount()();
  const pair = normalizeAddressPair(created?.address ?? null);
  const rawPk = created?.privateKey;
  if (typeof rawPk !== 'string' || !pair) {
    throw new Error('create_account_failed');
  }
  const pk = normalizePrivateKeyHexInput(rawPk);
  if (!pk) {
    throw new Error('create_account_failed');
  }
  const plaintext = JSON.stringify({ k: 'p', v: pk });
  const { saltB64, ivB64, cipherB64 } = await encryptUtf8WithPassword(plaintext, password);
  const bundle = await loadBundle();
  const id = crypto.randomUUID();
  const acc: TvmAccountStored = {
    id,
    label: (label?.trim() || `Tron 账户 ${bundle.accounts.length + 1}`).slice(0, 48),
    walletKind: 'privateKey',
    saltB64,
    ivB64,
    cipherB64,
    addressBase58: pair.base58,
    addressHex: pair.hex
  };
  await saveBundle({ version: 1, accounts: [...bundle.accounts, acc] });
  return acc;
}

export async function removeTvmAccount(id: string): Promise<void> {
  const bundle = await loadBundle();
  await saveBundle({ version: 1, accounts: bundle.accounts.filter((a) => a.id !== id) });
}

export async function renameTvmAccount(id: string, label: string): Promise<void> {
  const nextLabel = label.trim().slice(0, 48) || '未命名';
  const bundle = await loadBundle();
  await saveBundle({
    version: 1,
    accounts: bundle.accounts.map((a) => (a.id === id ? { ...a, label: nextLabel } : a))
  });
}

/** 在列表中上移一位（更靠前）。 */
export async function moveTvmAccountUp(id: string): Promise<void> {
  const bundle = await loadBundle();
  const idx = bundle.accounts.findIndex((a) => a.id === id);
  if (idx <= 0) {
    return;
  }
  const next = [...bundle.accounts];
  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
  await saveBundle({ version: 1, accounts: next });
}

/** 在列表中下移一位。 */
export async function moveTvmAccountDown(id: string): Promise<void> {
  const bundle = await loadBundle();
  const idx = bundle.accounts.findIndex((a) => a.id === id);
  if (idx < 0 || idx >= bundle.accounts.length - 1) {
    return;
  }
  const next = [...bundle.accounts];
  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
  await saveBundle({ version: 1, accounts: next });
}

export async function clearAllTvmAccounts(): Promise<void> {
  await saveBundle({ version: 1, accounts: [] });
}
