import type { UnlockStatus, UnlockSummary } from '~/types';
import { RUNTIME_MSG_GET_UNLOCK_STATUS, RUNTIME_MSG_LOCK_UNLOCKED_ACCOUNTS } from '~lib/bridge/constants';

/**
 * 审批弹窗 / 侧栏读取**解锁态**的 runtime 消息封装（P2-2）。
 *
 * 调用链：`hooks/useSignerUnlockStatus`、`ui/wallet/sections/unlockSessionSection` → background。
 * 只传输公开地址、过期时间与 TTL；不读取任何口令或密钥材料。
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUnlockStatus(value: unknown): value is UnlockStatus {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.unlocked === 'boolean' &&
    (value.expiresAt === null || typeof value.expiresAt === 'number') &&
    typeof value.ttlMinutes === 'number'
  );
}

function isUnlockSummary(value: unknown): value is UnlockSummary {
  if (!isRecord(value) || !Array.isArray(value.accounts) || typeof value.ttlMinutes !== 'number') {
    return false;
  }
  return value.accounts.every(
    (item) =>
      isRecord(item) &&
      typeof item.address === 'string' &&
      /^0x[0-9a-fA-F]{40}$/.test(item.address) &&
      typeof item.expiresAt === 'number'
  );
}

export function fetchUnlockStatus(address: string): Promise<UnlockStatus | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_GET_UNLOCK_STATUS, address }, (resp: unknown) => {
      void chrome.runtime.lastError;
      resolve(isUnlockStatus(resp) ? resp : null);
    });
  });
}

export function fetchUnlockSummary(): Promise<UnlockSummary | null> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_GET_UNLOCK_STATUS }, (resp: unknown) => {
      void chrome.runtime.lastError;
      resolve(isUnlockSummary(resp) ? resp : null);
    });
  });
}

export function lockUnlockedAccounts(): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: RUNTIME_MSG_LOCK_UNLOCKED_ACCOUNTS }, (resp: unknown) => {
      void chrome.runtime.lastError;
      resolve(isRecord(resp) && resp.ok === true);
    });
  });
}
