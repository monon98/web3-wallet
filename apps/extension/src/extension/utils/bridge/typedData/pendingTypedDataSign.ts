import type { PendingTypedDataSign } from '~/types/bridge';

/**
 * EIP-712 签名挂起单例；`typedData` 为已校验的可序列化结构，供弹窗展示与 `signTypedData` 复用。
 *
 * 读写本身不打开发日志；排障见 `resolvePendingTypedDataSign.ts`。
 */

const SESSION_KEY = 'web3_wallet_pending_typed_data_sign_v1' as const;

function isTypedDataStruct(raw: unknown): raw is PendingTypedDataSign['typedData'] {
  if (!raw || typeof raw !== 'object') {
    return false;
  }
  const o = raw as Record<string, unknown>;
  if (!o.domain || typeof o.domain !== 'object') {
    return false;
  }
  if (!o.types || typeof o.types !== 'object' || Array.isArray(o.types)) {
    return false;
  }
  if (typeof o.primaryType !== 'string') {
    return false;
  }
  if (!o.message || typeof o.message !== 'object' || Array.isArray(o.message)) {
    return false;
  }
  const typesObj = o.types as Record<string, unknown>;
  for (const v of Object.values(typesObj)) {
    if (!Array.isArray(v)) {
      return false;
    }
    for (const field of v) {
      if (!field || typeof field !== 'object') {
        return false;
      }
      const f = field as Record<string, unknown>;
      if (typeof f.name !== 'string' || typeof f.type !== 'string') {
        return false;
      }
    }
  }
  return true;
}

function isPending(raw: unknown): raw is PendingTypedDataSign {
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
    isTypedDataStruct(o.typedData)
  );
}

export async function setPendingTypedDataSign(p: PendingTypedDataSign): Promise<void> {
  await chrome.storage.session.set({ [SESSION_KEY]: p });
}

export async function getPendingTypedDataSign(): Promise<PendingTypedDataSign | null> {
  const bag = await chrome.storage.session.get(SESSION_KEY);
  const raw = bag[SESSION_KEY];
  return isPending(raw) ? raw : null;
}

export async function clearPendingTypedDataSign(): Promise<void> {
  await chrome.storage.session.remove(SESSION_KEY);
}
