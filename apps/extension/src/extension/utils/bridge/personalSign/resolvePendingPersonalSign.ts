import { EIP1193_ERROR_CODES } from '@plugin/shared';
import type { Hex } from 'viem';

import { RUNTIME_MSG_DEFERRED_BRIDGE_RESULT } from '~lib/bridge/constants';
import { clearPendingPersonalSign, getPendingPersonalSign } from '~lib/bridge/personalSign/pendingPersonalSign';
import { extLogInfo, extLogWarn } from '~lib/extensionLog';
import { unlockLocalAccountForAddress } from '~lib/vault/signing';
import { getAddress } from '~web3/evm/viem';

/**
 * **personal_sign 完成态**：由弹窗页 `runtime` 消息触发；用用户口令解密本地账户、
 * `signMessage`（EIP-191）后通过 `RUNTIME_MSG_DEFERRED_BRIDGE_RESULT` 把签名送回 **DApp 所在 tab**，并清理 session 与弹窗。
 *
 * 失败时返回 `{ ok: false, error }`，不向页面发部分成功结果。
 */

async function closeApprovalWindowIfAny(windowId: number | undefined): Promise<void> {
  if (windowId === undefined) {
    return;
  }
  try {
    await chrome.windows.remove(windowId);
  } catch {
    /* 已关闭 */
  }
}

/**
 * @param password 用户在弹窗中输入的 vault 口令（不落盘、不写日志）
 * @returns 成功 `{ ok: true }`；口令/账户/签名失败时 `{ ok: false, error }`
 */
export async function approvePendingPersonalSignAndNotify(
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pending = await getPendingPersonalSign();
  if (!pending) {
    extLogWarn('resolve_personal_sign', { result: 'no_pending' });
    return { ok: false, error: '没有待处理的签名请求。' };
  }
  const addr = getAddress(pending.signerAddress);
  const acc = await unlockLocalAccountForAddress(addr, password);
  if (!acc) {
    extLogWarn('resolve_personal_sign', {
      requestId: pending.bridgeRequestId,
      result: 'unlock_failed'
    });
    return { ok: false, error: '口令错误或本地无该地址的加密账户。' };
  }
  let signature: Hex;
  try {
    signature = await acc.signMessage({ message: { raw: pending.messageHex as Hex } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    extLogWarn('resolve_personal_sign', {
      requestId: pending.bridgeRequestId,
      result: 'sign_error',
      message: msg
    });
    return { ok: false, error: msg || '签名失败。' };
  }
  const winId = pending.approvalWindowId;
  let tabNotified = false;
  try {
    await chrome.tabs.sendMessage(pending.tabId, {
      type: RUNTIME_MSG_DEFERRED_BRIDGE_RESULT,
      requestId: pending.bridgeRequestId,
      result: signature
    });
    tabNotified = true;
  } catch {
    extLogWarn('resolve_personal_sign', {
      requestId: pending.bridgeRequestId,
      result: 'tab_send_failed'
    });
  }
  await clearPendingPersonalSign();
  await closeApprovalWindowIfAny(winId);
  extLogInfo('resolve_personal_sign', {
    requestId: pending.bridgeRequestId,
    origin: pending.origin,
    result: 'ok',
    tabNotified
  });
  return { ok: true };
}

/** 向页面投递 `USER_REJECTED`，并关闭弹窗、清空 pending。 */
export async function rejectPendingPersonalSignAndNotify(): Promise<{ ok: boolean }> {
  const pending = await getPendingPersonalSign();
  if (!pending) {
    extLogWarn('reject_personal_sign', { result: 'no_pending' });
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
    extLogWarn('reject_personal_sign', {
      requestId: pending.bridgeRequestId,
      result: 'tab_send_failed'
    });
  }
  await clearPendingPersonalSign();
  await closeApprovalWindowIfAny(winId);
  extLogInfo('reject_personal_sign', {
    requestId: pending.bridgeRequestId,
    origin: pending.origin
  });
  return { ok: true };
}
