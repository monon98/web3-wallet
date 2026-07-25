import type { PendingSiteConnect } from '~/types/bridge';

/**
 * 站点连接 / `eth_requestAccounts` 挂起单例（`chrome.storage.session`）。
 * 存 `kind` 以区分 bridge 方法，便于 resolve 时组装不同形状的 `result`。
 *
 * 读写本身不打开发日志；排障见 `resolvePendingSiteConnect.ts`、`resolveConnectApprovalAddress.ts`。
 */

const SESSION_KEY = 'web3_wallet_pending_site_connect_v1' as const;

function isPending(raw: unknown): raw is PendingSiteConnect {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const o = raw as Record<string, unknown>;
  const kind = o.kind;
  return (
    typeof o.bridgeRequestId === 'string' &&
    (kind === 'eth_requestAccounts' || kind === 'connect') &&
    typeof o.origin === 'string' &&
    typeof o.tabId === 'number' &&
    typeof o.windowId === 'number' &&
    typeof o.ts === 'number'
  );
}

export async function setPendingSiteConnect(p: PendingSiteConnect): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: p });
}

export async function getPendingSiteConnect(): Promise<PendingSiteConnect | null> {
  const bag = await chrome.storage.session.get(SESSION_KEY);
  const raw = bag[SESSION_KEY];
  return isPending(raw) ? raw : null;
}

export async function clearPendingSiteConnect(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEY);
}
