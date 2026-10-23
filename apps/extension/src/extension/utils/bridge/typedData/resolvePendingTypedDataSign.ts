import { EIP1193_ERROR_CODES } from '@plugin/shared';
import type { Hex } from 'viem';

import type { SignApprovalResult } from '~/types';
import { RUNTIME_MSG_DEFERRED_BRIDGE_RESULT } from '~lib/bridge/constants';
import { clearPendingTypedDataSign, getPendingTypedDataSign } from '~lib/bridge/typedData/pendingTypedDataSign';
import { extLogInfo, extLogWarn } from '~lib/extensionLog';
import { getOrUnlockLocalAccount, markUnlockedAccountUsed } from '~lib/vault/unlockSession';
import { getAddress } from '~web3/evm/viem';

/**
 * **EIP-712 / typed data 签名完成态**：与 `resolvePendingPersonalSign` 对称，
 * 使用 viem `signTypedData` 后将 `0x` 签名回传 DApp tab。
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
 * @param password 弹窗收集的解密口令；已解锁时为空串
 * @returns 签名成功或 `{ ok: false, error }`（解析/口令/签名错误；锁定且未带口令时含 `unlock_required`）
 */
export async function approvePendingTypedDataSignAndNotify(password: string): Promise<SignApprovalResult> {
  const pending = await getPendingTypedDataSign();
  if (!pending) {
    extLogWarn('resolve_typed_data_sign', { result: 'no_pending' });
    return { ok: false, error: '没有待处理的签名请求。' };
  }
  const addr = getAddress(pending.signerAddress);
  const unlock = await getOrUnlockLocalAccount(addr, password);
  if (unlock.ok === false) {
    const unlockRequired = unlock.reason === 'unlock_required';
    extLogWarn('resolve_typed_data_sign', {
      requestId: pending.bridgeRequestId,
      result: unlockRequired ? 'unlock_required' : 'unlock_failed'
    });
    return {
      ok: false,
      error: unlockRequired ? '账户已锁定，请输入口令后重试。' : '口令错误或本地无该地址的加密账户。',
      ...(unlockRequired ? { code: 'unlock_required' as const } : {})
    };
  }

  const td = pending.typedData;
  let signature: Hex;
  try {
    // JSON 解析后的 EIP-712 结构与 viem `TypedDataDefinition` 一致；具体字段由链上/ DApp 决定。
    signature = await unlock.account.signTypedData({
      domain: td.domain,
      types: td.types,
      primaryType: td.primaryType,
      message: td.message
    });
    await markUnlockedAccountUsed(addr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    extLogWarn('resolve_typed_data_sign', {
      requestId: pending.bridgeRequestId,
      result: 'sign_error',
      message: msg
    });
    return { ok: false, error: msg || 'EIP-712 签名失败。' };
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
    extLogWarn('resolve_typed_data_sign', {
      requestId: pending.bridgeRequestId,
      result: 'tab_send_failed'
    });
  }
  await clearPendingTypedDataSign();
  await closeApprovalWindowIfAny(winId);
  extLogInfo('resolve_typed_data_sign', {
    requestId: pending.bridgeRequestId,
    origin: pending.origin,
    result: 'ok',
    tabNotified
  });
  return { ok: true };
}

/** 用户拒绝 EIP-712 签名。 */
export async function rejectPendingTypedDataSignAndNotify(): Promise<{ ok: boolean }> {
  const pending = await getPendingTypedDataSign();
  if (!pending) {
    extLogWarn('reject_typed_data_sign', { result: 'no_pending' });
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
    extLogWarn('reject_typed_data_sign', {
      requestId: pending.bridgeRequestId,
      result: 'tab_send_failed'
    });
  }
  await clearPendingTypedDataSign();
  await closeApprovalWindowIfAny(winId);
  extLogInfo('reject_typed_data_sign', {
    requestId: pending.bridgeRequestId,
    origin: pending.origin
  });
  return { ok: true };
}
