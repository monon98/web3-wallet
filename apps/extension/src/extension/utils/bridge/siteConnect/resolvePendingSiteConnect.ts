import { EIP1193_ERROR_CODES } from '@plugin/shared';

import { RUNTIME_MSG_DEFERRED_BRIDGE_RESULT } from '~lib/bridge/constants';
import { clearPendingSiteConnect, getPendingSiteConnect } from '~lib/bridge/siteConnect/pendingSiteConnect';
import { resolveConnectApprovalAddress } from '~lib/bridge/siteConnect/resolveConnectApprovalAddress';
import { extLogInfo, extLogWarn } from '~lib/extensionLog';
import { authorizeSiteSession, loadWalletUiState } from '~lib/walletUi/walletUiState';

/**
 * **站点连接完成�?*：弹窗用户选定地址后写�?**origin+tab** 会话，并�?`pending.kind` 组装
 * `eth_requestAccounts` / `connect` �?bridge 结果推回 DApp tab�? */

async function closeApprovalWindowIfAny(windowId: number | undefined): Promise<void> {
  if (windowId === undefined) {
    return;
  }
  try {
    await chrome.windows.remove(windowId);
  } catch {
    /* 已关�?*/
  }
}

/**
 * @param selectedAddressRaw 弹窗选择的地址；须能通过 `resolveConnectApprovalAddress` 校验且为已保存的本地加密账户
 */
export async function approvePendingSiteConnectAndNotify(selectedAddressRaw?: string): Promise<{ ok: boolean }> {
  const pending = await getPendingSiteConnect();
  if (!pending) {
    extLogWarn('resolve_site_connect', { result: 'no_pending' });
    return { ok: false };
  }
  const resolved = await resolveConnectApprovalAddress(selectedAddressRaw);
  if (!resolved.ok) {
    extLogWarn('resolve_site_connect', {
      requestId: pending.bridgeRequestId,
      result: 'address_resolve_failed'
    });
    return { ok: false };
  }
  const winId = pending.approvalWindowId;
  await authorizeSiteSession(pending.origin, pending.tabId, undefined, resolved.address);
  const addr = resolved.address;
  const s = await loadWalletUiState();
  const result = pending.kind === 'connect' ? { accounts: [addr], chainId: s.chainIdHex } : [addr];
  let tabNotified = false;
  try {
    await chrome.tabs.sendMessage(pending.tabId, {
      type: RUNTIME_MSG_DEFERRED_BRIDGE_RESULT,
      requestId: pending.bridgeRequestId,
      result
    });
    tabNotified = true;
  } catch {
    extLogWarn('resolve_site_connect', {
      requestId: pending.bridgeRequestId,
      result: 'tab_send_failed'
    });
  }
  await clearPendingSiteConnect();
  await closeApprovalWindowIfAny(winId);
  extLogInfo('resolve_site_connect', {
    requestId: pending.bridgeRequestId,
    origin: pending.origin,
    kind: pending.kind,
    result: 'ok',
    tabNotified
  });
  return { ok: true };
}

/** 用户拒绝连接：对页面返回标准 `USER_REJECTED`�?*/
export async function rejectPendingSiteConnectAndNotify(): Promise<{ ok: boolean }> {
  const pending = await getPendingSiteConnect();
  if (!pending) {
    extLogWarn('reject_site_connect', { result: 'no_pending' });
    return { ok: false };
  }
  const winId = pending.approvalWindowId;
  try {
    await chrome.tabs.sendMessage(pending.tabId, {
      type: RUNTIME_MSG_DEFERRED_BRIDGE_RESULT,
      requestId: pending.bridgeRequestId,
      error: {
        code: EIP1193_ERROR_CODES.USER_REJECTED,
        message: 'User rejected the request.'
      }
    });
  } catch {
    extLogWarn('reject_site_connect', {
      requestId: pending.bridgeRequestId,
      result: 'tab_send_failed'
    });
  }
  await clearPendingSiteConnect();
  await closeApprovalWindowIfAny(winId);
  extLogInfo('reject_site_connect', {
    requestId: pending.bridgeRequestId,
    origin: pending.origin
  });
  return { ok: true };
}
