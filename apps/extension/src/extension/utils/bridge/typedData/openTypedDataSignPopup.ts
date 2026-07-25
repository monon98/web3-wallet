import type { PendingTypedDataSign } from '~/types/bridge';
import { setPendingTypedDataSign } from '~lib/bridge/typedData/pendingTypedDataSign';
import { extLogDebug, extLogWarn } from '~lib/extensionLog';

/**
 * **EIP-712** 审批弹窗（尺寸略大以容纳类型化数据展示）；创建失败日志同 `openPersonalSignPopup`�?
 */

const TAB_PATH = 'tabs/signTypedData.html' as const;

export async function openTypedDataSignApprovalPopup(pending: PendingTypedDataSign): Promise<void> {
  const url = chrome.runtime.getURL(TAB_PATH);
  const wid = pending.approvalWindowId;
  if (wid !== undefined) {
    try {
      await chrome.windows.get(wid);
      await chrome.windows.update(wid, { focused: true });
      extLogDebug('approval_popup_focus', {
        kind: 'typed_data_sign',
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
      width: 480,
      height: 640,
      focused: true
    });

    const id = created.id;
    if (id !== undefined) {
      await setPendingTypedDataSign({ ...pending, approvalWindowId: id });
      extLogDebug('approval_popup_create', {
        kind: 'typed_data_sign',
        requestId: pending.bridgeRequestId,
        windowId: id
      });
    } else {
      extLogWarn('approval_popup_create_failed', {
        kind: 'typed_data_sign',
        requestId: pending.bridgeRequestId,
        reason: 'missing_window_id'
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    extLogWarn('approval_popup_create_failed', {
      kind: 'typed_data_sign',
      requestId: pending.bridgeRequestId,
      reason: 'create_threw',
      message
    });
  }
}
