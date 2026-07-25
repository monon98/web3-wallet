import type { PendingSendTransaction } from '~/types/bridge';
import { setPendingSendTransaction } from '~lib/bridge/transaction/pendingSendTransaction';
import { extLogDebug, extLogWarn } from '~lib/extensionLog';

/**
 * **`eth_sendTransaction`** 审批小窗：创建或聚焦 popup，写入 `approvalWindowId`。
 */

const TAB_PATH = 'tabs/signSendTransaction.html' as const;

export async function openSendTransactionApprovalPopup(pending: PendingSendTransaction): Promise<void> {
  const url = chrome.runtime.getURL(TAB_PATH);
  const wid = pending.approvalWindowId;
  if (wid !== undefined) {
    try {
      await chrome.windows.get(wid);
      await chrome.windows.update(wid, { focused: true });
      extLogDebug('approval_popup_focus', {
        kind: 'send_transaction',
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
      height: 620,
      focused: true
    });
    const id = created.id;
    if (id !== undefined) {
      await setPendingSendTransaction({ ...pending, approvalWindowId: id });
      extLogDebug('approval_popup_create', {
        kind: 'send_transaction',
        requestId: pending.bridgeRequestId,
        windowId: id
      });
    } else {
      extLogWarn('approval_popup_create_failed', {
        kind: 'send_transaction',
        requestId: pending.bridgeRequestId,
        reason: 'missing_window_id'
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    extLogWarn('approval_popup_create_failed', {
      kind: 'send_transaction',
      requestId: pending.bridgeRequestId,
      reason: 'create_threw',
      message
    });
  }
}
