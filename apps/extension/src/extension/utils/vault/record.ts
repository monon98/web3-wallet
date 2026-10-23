import type { AccountsBundleV1, WalletAccountStored, WalletAccountSummary } from '~/types/vault';
import { extLogWarn } from '~lib/extensionLog';
import { getAddress } from '~web3/evm/viem';

import { encryptUtf8WithPassword } from './crypto';

/**
 * **加密账户包**（`chrome.storage.local`）：多条 `WalletAccountStored`（助记词或私钥经 AES 加密后的 payload）。
 * 仅暴露摘要列表给 UI；解密仅在 `signing.unlockLocalAccountForAddress` / `unlockSession` 等用户口令路径。
 *
 * 加载时若某条 `address` 无法 `getAddress` 规范化则**丢弃该条**并打 `vault_bundle_coerce`（不记录地址或密文）。
 */

export const WALLET_ACCOUNTS_BUNDLE_STORAGE_KEY = 'web3_wallet_accounts_bundle_v1' as const;
const ACCOUNTS_BUNDLE_KEY = WALLET_ACCOUNTS_BUNDLE_STORAGE_KEY;

function isAccountsBundle(raw: unknown): raw is AccountsBundleV1 {
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
      (x.walletKind === 'mnemonic' || x.walletKind === 'privateKey') &&
      typeof x.saltB64 === 'string' &&
      typeof x.ivB64 === 'string' &&
      typeof x.cipherB64 === 'string' &&
      typeof x.address === 'string'
    );
  });
}

async function loadBundle(): Promise<AccountsBundleV1> {
  const bag = await chrome.storage.local.get(ACCOUNTS_BUNDLE_KEY);
  const raw = bag[ACCOUNTS_BUNDLE_KEY];
  if (!isAccountsBundle(raw)) {
    return { version: 1, accounts: [] };
  }
  const accounts: WalletAccountStored[] = [];
  let skippedInvalidAddress = 0;
  for (const a of raw.accounts) {
    try {
      accounts.push({
        ...a,
        address: getAddress(a.address as `0x${string}`)
      });
    } catch {
      skippedInvalidAddress += 1;
    }
  }
  if (skippedInvalidAddress > 0) {
    extLogWarn('vault_bundle_coerce', {
      reason: 'invalid_address_record',
      skippedCount: skippedInvalidAddress
    });
  }
  return { version: 1, accounts };
}

async function saveBundle(bundle: AccountsBundleV1): Promise<void> {
  await chrome.storage.local.set({ [ACCOUNTS_BUNDLE_KEY]: bundle });
}

export async function listWalletAccountSummaries(): Promise<WalletAccountSummary[]> {
  const { accounts } = await loadBundle();
  return accounts.map(({ id, label, walletKind, address }) => ({
    id,
    label,
    walletKind,
    address
  }));
}

export async function hasWalletAccounts(): Promise<boolean> {
  const { accounts } = await loadBundle();
  return accounts.length > 0;
}

/** 列表顺序第一个账户地址；无账户时 null */
export async function getFirstWalletAccountAddress(): Promise<`0x${string}` | null> {
  const { accounts } = await loadBundle();
  return accounts[0]?.address ?? null;
}

/**
 * 将助记词加密为 `{ k:'m', v: mnemonic }` 后入库；`address` 须与派生地址一致（由 UI 预先校验）。
 */
export async function addWalletAccountFromMnemonic(
  mnemonic: string,
  password: string,
  address: `0x${string}`,
  hdPath: string,
  label?: string
): Promise<WalletAccountStored> {
  const normalized = mnemonic.trim().replace(/\s+/g, ' ');
  const plaintext = JSON.stringify({ k: 'm', v: normalized, p: hdPath.trim() });
  const { saltB64, ivB64, cipherB64 } = await encryptUtf8WithPassword(plaintext, password);
  const bundle = await loadBundle();
  const id = crypto.randomUUID();
  const acc: WalletAccountStored = {
    id,
    label: (label?.trim() || `账户 ${bundle.accounts.length + 1}`).slice(0, 48),
    walletKind: 'mnemonic',
    saltB64,
    ivB64,
    cipherB64,
    address: getAddress(address)
  };
  await saveBundle({ version: 1, accounts: [...bundle.accounts, acc] });
  return acc;
}

/** 私钥明文仅出现在加密调用栈中，持久化仅为 `{ k:'p', v: privateKey }` 的密文。 */
export async function addWalletAccountFromPrivateKey(
  privateKey: `0x${string}`,
  password: string,
  address: `0x${string}`,
  label?: string
): Promise<WalletAccountStored> {
  const plaintext = JSON.stringify({ k: 'p', v: privateKey });
  const { saltB64, ivB64, cipherB64 } = await encryptUtf8WithPassword(plaintext, password);
  const bundle = await loadBundle();
  const id = crypto.randomUUID();
  const acc: WalletAccountStored = {
    id,
    label: (label?.trim() || `账户 ${bundle.accounts.length + 1}`).slice(0, 48),
    walletKind: 'privateKey',
    saltB64,
    ivB64,
    cipherB64,
    address: getAddress(address)
  };
  await saveBundle({ version: 1, accounts: [...bundle.accounts, acc] });
  return acc;
}

export async function removeWalletAccount(id: string): Promise<void> {
  const bundle = await loadBundle();
  await saveBundle({
    version: 1,
    accounts: bundle.accounts.filter((a) => a.id !== id)
  });
}

export async function renameWalletAccount(id: string, label: string): Promise<void> {
  const nextLabel = label.trim().slice(0, 48) || '未命名';
  const bundle = await loadBundle();
  await saveBundle({
    version: 1,
    accounts: bundle.accounts.map((a) => (a.id === id ? { ...a, label: nextLabel } : a))
  });
}

/** 在列表中上移一位（更靠前）；首条为「默认」展示与连接审批优先项。 */
export async function moveWalletAccountUp(id: string): Promise<void> {
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
export async function moveWalletAccountDown(id: string): Promise<void> {
  const bundle = await loadBundle();
  const idx = bundle.accounts.findIndex((a) => a.id === id);
  if (idx < 0 || idx >= bundle.accounts.length - 1) {
    return;
  }
  const next = [...bundle.accounts];
  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
  await saveBundle({ version: 1, accounts: next });
}

export async function clearAllWalletAccounts(): Promise<void> {
  await saveBundle({ version: 1, accounts: [] });
}

/** 按地址查找本地加密账户（用于签名前解密）。 */
export async function getWalletAccountStoredByAddress(address: `0x${string}`): Promise<WalletAccountStored | null> {
  const { accounts } = await loadBundle();
  const want = getAddress(address).toLowerCase();
  const hit = accounts.find((a) => a.address.toLowerCase() === want);
  return hit ?? null;
}
