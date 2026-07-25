import type { PendingSendTransaction, PendingTxRpcMethod } from '~/types/bridge';

/**
 * `eth_sendTransaction` 挂起单例：`chrome.storage.session`。
 * 与 `pendingSiteConnect` / 个人签名 / typed data 互斥由调用方保证。
 */

const SESSION_KEY = 'web3_wallet_pending_send_transaction_v1' as const;

function isPendingTxRpcMethod(v: unknown): v is PendingTxRpcMethod {
  return v === 'eth_sendTransaction' || v === 'eth_signTransaction';
}

function isPending(raw: unknown): raw is PendingSendTransaction {
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
    isPendingTxRpcMethod(o.pendingTxRpcMethod) &&
    o.transaction !== null &&
    typeof o.transaction === 'object' &&
    !Array.isArray(o.transaction)
  );
}

export async function setPendingSendTransaction(p: PendingSendTransaction): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: p });
}

export async function getPendingSendTransaction(): Promise<PendingSendTransaction | null> {
  const bag = await chrome.storage.session.get(SESSION_KEY);
  const raw = bag[SESSION_KEY];
  return isPending(raw) ? raw : null;
}

export async function clearPendingSendTransaction(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEY);
}
