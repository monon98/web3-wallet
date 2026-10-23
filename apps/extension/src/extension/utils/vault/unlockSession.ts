import type { UnlockStatus, UnlockSummary } from '~/types';
import { getAddress } from '~web3/evm/viem';

import { getWalletAccountStoredByAddress } from './record';
import { unlockLocalAccountForAddress, type UnlockableLocalAccount } from './signing';
import { loadUnlockTtlMinutes } from './unlockSettings';

/**
 * **会话级账户解锁**（P2-2，仅 background 内存）。
 *
 * 调用链：`resolvePendingPersonalSign` / `resolvePendingTypedDataSign` /
 * `resolvePendingSendTransaction` → 本模块；侧栏与审批弹窗只通过 runtime 消息读取状态。
 * 安全边界：缓存的是 viem 可签名账户，**不落盘**、不进入 content script / 网页；
 * Service Worker 休眠或浏览器重启即清空。成功签名后才刷新空闲 TTL。
 */

type UnlockedEntry = {
  address: `0x${string}`;
  account: UnlockableLocalAccount;
  lastUsedAt: number;
  /** 到期主动清除内存账户；Service Worker 被回收时随进程一起消失。 */
  expiryTimer: ReturnType<typeof setTimeout> | null;
};

const unlockedAccounts = new Map<string, UnlockedEntry>();
/** 手动锁定 / 删除账户会递增；用于阻止解密中的请求在锁定后重新写回缓存。 */
let lockEpoch = 0;

function accountKey(address: string): string {
  return address.trim().toLowerCase();
}

/** 规范化地址；非法地址返回 null（不抛错到审批 UI）。 */
function normalizeAddress(address: string): `0x${string}` | null {
  try {
    return getAddress(address as `0x${string}`);
  } catch {
    return null;
  }
}

async function readTtlMs(): Promise<number> {
  return (await loadUnlockTtlMinutes()) * 60_000;
}

function isFresh(entry: UnlockedEntry, ttlMs: number, now = Date.now()): boolean {
  return now - entry.lastUsedAt < ttlMs;
}

function clearEntryTimer(entry: UnlockedEntry): void {
  if (entry.expiryTimer !== null) {
    clearTimeout(entry.expiryTimer);
    entry.expiryTimer = null;
  }
}

function deleteEntry(key: string): void {
  const entry = unlockedAccounts.get(key);
  if (entry) {
    clearEntryTimer(entry);
  }
  unlockedAccounts.delete(key);
}

/** 按空闲 TTL 主动淘汰内存账户；回调时重新读取 TTL，兼容侧栏调整时长。 */
function scheduleEntryExpiry(key: string, entry: UnlockedEntry, ttlMs: number): void {
  clearEntryTimer(entry);
  const remainingMs = Math.max(0, ttlMs - (Date.now() - entry.lastUsedAt));
  entry.expiryTimer = setTimeout(() => {
    void (async () => {
      if (unlockedAccounts.get(key) !== entry) {
        return;
      }
      const nextTtlMs = await readTtlMs();
      // 等待读取 TTL 期间可能已被手动锁定或删除，禁止把账户重新挂回定时器。
      if (unlockedAccounts.get(key) !== entry) {
        return;
      }
      if (!isFresh(entry, nextTtlMs)) {
        deleteEntry(key);
        return;
      }
      scheduleEntryExpiry(key, entry, nextTtlMs);
    })();
  }, remainingMs);
}

async function getFreshEntry(address: `0x${string}`, knownTtlMs?: number): Promise<UnlockedEntry | null> {
  const key = accountKey(address);
  const entry = unlockedAccounts.get(key);
  if (!entry) {
    return null;
  }
  const ttlMs = knownTtlMs ?? (await readTtlMs());
  // 等待读取 TTL 期间可能已被手动锁定；锁定后不得再把缓存账户交给签名路径。
  if (unlockedAccounts.get(key) !== entry) {
    return null;
  }
  if (!isFresh(entry, ttlMs)) {
    deleteEntry(key);
    return null;
  }
  // 对齐当前 TTL（侧栏可能刚改短），不改变 lastUsedAt，因此不会延长解锁。
  scheduleEntryExpiry(key, entry, ttlMs);
  return entry;
}

/** 单个地址的解锁状态（供审批弹窗展示；不刷新 TTL）。 */
export async function getUnlockStatus(address: string): Promise<UnlockStatus> {
  const ttlMinutes = await loadUnlockTtlMinutes();
  const normalized = normalizeAddress(address);
  if (!normalized) {
    return { unlocked: false, expiresAt: null, ttlMinutes };
  }
  const entry = await getFreshEntry(normalized, ttlMinutes * 60_000);
  return entry
    ? {
        unlocked: true,
        expiresAt: entry.lastUsedAt + ttlMinutes * 60_000,
        ttlMinutes
      }
    : { unlocked: false, expiresAt: null, ttlMinutes };
}

/** 侧栏摘要；顺带清理已过期条目。 */
export async function getUnlockSummary(): Promise<UnlockSummary> {
  const ttlMinutes = await loadUnlockTtlMinutes();
  const ttlMs = ttlMinutes * 60_000;
  const now = Date.now();
  const accounts: UnlockSummary['accounts'] = [];
  for (const [key, entry] of unlockedAccounts) {
    if (!isFresh(entry, ttlMs, now)) {
      deleteEntry(key);
      continue;
    }
    scheduleEntryExpiry(key, entry, ttlMs);
    accounts.push({
      address: entry.address,
      expiresAt: entry.lastUsedAt + ttlMs
    });
  }
  accounts.sort((a, b) => a.expiresAt - b.expiresAt);
  return { accounts, ttlMinutes };
}

export type UnlockAttempt =
  | { ok: true; account: UnlockableLocalAccount }
  | { ok: false; reason: 'unlock_required' | 'unlock_failed' };

/**
 * 优先复用未过期的内存解锁态；否则用本次口令解密并缓存。
 *
 * 每次调用先确认账户仍在加密 vault 中，避免删除账户后旧缓存继续签名。
 */
export async function getOrUnlockLocalAccount(address: `0x${string}`, password: string): Promise<UnlockAttempt> {
  const epoch = lockEpoch;
  const normalized = normalizeAddress(address);
  if (!normalized) {
    return { ok: false, reason: 'unlock_failed' };
  }

  const stored = await getWalletAccountStoredByAddress(normalized);
  if (!stored) {
    deleteEntry(accountKey(normalized));
    return { ok: false, reason: 'unlock_failed' };
  }

  const cached = await getFreshEntry(normalized);
  if (cached) {
    return { ok: true, account: cached.account };
  }

  if (!password) {
    return { ok: false, reason: 'unlock_required' };
  }

  const account = await unlockLocalAccountForAddress(normalized, password);
  if (!account) {
    return { ok: false, reason: 'unlock_failed' };
  }
  if (epoch !== lockEpoch) {
    return { ok: false, reason: 'unlock_required' };
  }
  const key = accountKey(normalized);
  const ttlMs = await readTtlMs();
  if (epoch !== lockEpoch) {
    return { ok: false, reason: 'unlock_required' };
  }
  const entry: UnlockedEntry = {
    address: normalized,
    account,
    lastUsedAt: Date.now(),
    expiryTimer: null
  };
  unlockedAccounts.set(key, entry);
  scheduleEntryExpiry(key, entry, ttlMs);
  return { ok: true, account };
}

/** 成功签名 / 广播后刷新空闲 TTL；已过期条目不会被复活。TTL 刷新失败不影响已完成的签名。 */
export async function markUnlockedAccountUsed(address: `0x${string}`): Promise<void> {
  try {
    const normalized = normalizeAddress(address);
    if (!normalized) {
      return;
    }
    const ttlMs = await readTtlMs();
    const entry = await getFreshEntry(normalized, ttlMs);
    if (entry) {
      entry.lastUsedAt = Date.now();
      scheduleEntryExpiry(accountKey(normalized), entry, ttlMs);
    }
  } catch {
    /* 解锁态刷新是 best-effort，不把错误抛回签名完成路径 */
  }
}

/** 手动锁定所有账户；返回被清理的条目数。 */
export function lockAllUnlockedAccounts(): number {
  lockEpoch += 1;
  const count = unlockedAccounts.size;
  for (const entry of unlockedAccounts.values()) {
    clearEntryTimer(entry);
  }
  unlockedAccounts.clear();
  return count;
}
