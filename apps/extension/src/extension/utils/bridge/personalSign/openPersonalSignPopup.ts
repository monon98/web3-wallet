import type { PendingPersonalSign } from '~/types/bridge';
import { setPendingPersonalSign } from '~lib/bridge/personalSign/pendingPersonalSign';
import { extLogDebug, extLogWarn } from '~lib/extensionLog';

/**
 * 创建或聚�?**personal_sign** 审批小窗；创建成功后�?`approvalWindowId` 写回 pending 以便 resolve �?`windows.remove`�?
 * 创建失败：`approval_popup_create_failed`（`reason`: `missing_window_id` | `create_threw`）�?
 */

const TAB_PATH = 'tabs/signPersonal.html' as const;

export async function openPersonalSignApprovalPopup(pending: PendingPersonalSign): Promise<void> {
  const url = chrome.runtime.getURL(TAB_PATH);
  const wid = pending.approvalWindowId;
  if (wid !== undefined) {
    try {
      await chrome.windows.get(wid);
      await chrome.windows.update(wid, { focused: true });
      extLogDebug('approval_popup_focus', {
        kind: 'personal_sign',
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
      height: 560,
      focused: true
    });
    const id = created.id;
    if (id !== undefined) {
      await setPendingPersonalSign({ ...pending, approvalWindowId: id });
      extLogDebug('approval_popup_create', {
        kind: 'personal_sign',
        requestId: pending.bridgeRequestId,
        windowId: id
      });
    } else {
      extLogWarn('approval_popup_create_failed', {
        kind: 'personal_sign',
        requestId: pending.bridgeRequestId,
        reason: 'missing_window_id'
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    extLogWarn('approval_popup_create_failed', {
      kind: 'personal_sign',
      requestId: pending.bridgeRequestId,
      reason: 'create_threw',
      message
    });
  }
}
