import type { PendingSiteConnect } from '~/types/bridge';
import { setPendingSiteConnect } from '~lib/bridge/siteConnect/pendingSiteConnect';
import { extLogDebug, extLogWarn } from '~lib/extensionLog';

/**
 * **站点连接**审批弹窗；逻辑�?`openPersonalSignPopup`（复用窗口、回�?`approvalWindowId`）�?
 * `windows.create` 失败或返回无 `id` 时打 `approval_popup_create_failed`�?
 */

const APPROVAL_TAB_PATH = 'tabs/siteConnect.html' as const;

export async function openSiteConnectApprovalPopup(pending: PendingSiteConnect): Promise<void> {
  const url = chrome.runtime.getURL(APPROVAL_TAB_PATH);
  const wid = pending.approvalWindowId;
  if (wid !== undefined) {
    try {
      await chrome.windows.get(wid);
      await chrome.windows.update(wid, { focused: true });
      extLogDebug('approval_popup_focus', {
        kind: 'site_connect',
        requestId: pending.bridgeRequestId,
        windowId: wid
      });
      return;
    } catch {
      /* 窗口已关闭，重新创建 */
    }
  }

  try {
    const created = await chrome.windows.create({
      url,
      type: 'popup',
      width: 440,
      height: 480,
      focused: true
    });

    const id = created.id;
    if (id !== undefined) {
      await setPendingSiteConnect({ ...pending, approvalWindowId: id });
      extLogDebug('approval_popup_create', {
        kind: 'site_connect',
        requestId: pending.bridgeRequestId,
        windowId: id
      });
    } else {
      extLogWarn('approval_popup_create_failed', {
        kind: 'site_connect',
        requestId: pending.bridgeRequestId,
        reason: 'missing_window_id'
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    extLogWarn('approval_popup_create_failed', {
      kind: 'site_connect',
      requestId: pending.bridgeRequestId,
      reason: 'create_threw',
      message
    });
  }
}
