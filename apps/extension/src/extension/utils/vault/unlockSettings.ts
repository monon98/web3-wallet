import { extLogWarn } from '~lib/extensionLog';

/**
 * **账户解锁空闲 TTL**（P2-2，`chrome.storage.local`）。
 *
 * 调用链：侧栏「账户解锁」设置读写；`vault/unlockSession.ts` 在每次签名校验时读取。
 * 只保存分钟数，不包含账户、口令或密钥材料。
 */

export const UNLOCK_TTL_MINUTES_STORAGE_KEY = 'web3_wallet_unlock_ttl_minutes_v1' as const;

export const DEFAULT_UNLOCK_TTL_MINUTES = 15;
export const MIN_UNLOCK_TTL_MINUTES = 1;
export const MAX_UNLOCK_TTL_MINUTES = 120;

export function clampUnlockTtlMinutes(value: number): number {
  if (!Number.isFinite(value)) {
    return DEFAULT_UNLOCK_TTL_MINUTES;
  }
  return Math.min(MAX_UNLOCK_TTL_MINUTES, Math.max(MIN_UNLOCK_TTL_MINUTES, Math.floor(value)));
}

/** 读取空闲 TTL；存储不可用时回退默认值，不阻断签名流程。 */
export async function loadUnlockTtlMinutes(): Promise<number> {
  try {
    const bag = await chrome.storage.local.get(UNLOCK_TTL_MINUTES_STORAGE_KEY);
    const raw = bag[UNLOCK_TTL_MINUTES_STORAGE_KEY];
    return typeof raw === 'number' ? clampUnlockTtlMinutes(raw) : DEFAULT_UNLOCK_TTL_MINUTES;
  } catch {
    extLogWarn('unlock_settings', { result: 'load_failed' });
    return DEFAULT_UNLOCK_TTL_MINUTES;
  }
}

/** 保存空闲 TTL；范围 1–120 分钟。 */
export async function saveUnlockTtlMinutes(minutes: number): Promise<number> {
  const next = clampUnlockTtlMinutes(minutes);
  await chrome.storage.local.set({ [UNLOCK_TTL_MINUTES_STORAGE_KEY]: next });
  return next;
}
