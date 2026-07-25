import type { PendingPersonalSign } from '~/types/bridge';

/**
 * `personal_sign` 挂起单例：`chrome.storage.session`（进程级，扩展重启即清空）。
 * 与 `pendingSiteConnect`、`pendingTypedDataSign` 互斥由调用方保证。
 *
 * 读写本身不打开发日志；排障见 `resolvePendingPersonalSign.ts` 与 `background` 的 `runtime_*`。
 */

const SESSION_KEY = 'web3_wallet_pending_personal_sign_v1' as const;

function isPending(raw: unknown): raw is PendingPersonalSign {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const o = raw as Record<string, unknown>;
  return (
    typeof o.bridgeRequestId === 'string' &&
    typeof o.origin === 'string' &&
    typeof o.tabId === 'number' &&
    typeof o.windowId === 'number' &&
    typeof o.ts === 'number' &&
    typeof o.signerAddress === 'string' &&
    typeof o.messageHex === 'string'
  );
}

/** 覆盖写入；通常仅在 begin 流程中调用。 */
export async function setPendingPersonalSign(p: PendingPersonalSign): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: p });
}

export async function getPendingPersonalSign(): Promise<PendingPersonalSign | null> {
  const bag = await chrome.storage.session.get(SESSION_KEY);
  const raw = bag[SESSION_KEY];
  return isPending(raw) ? raw : null;
}

export async function clearPendingPersonalSign(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEY);
}
