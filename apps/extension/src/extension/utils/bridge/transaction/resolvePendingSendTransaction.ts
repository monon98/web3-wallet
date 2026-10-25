import { EIP1193_ERROR_CODES, isWalletBuiltinEvmChainId } from '@plugin/shared';

import type { SignApprovalResult } from '~/types';
import { RUNTIME_MSG_DEFERRED_BRIDGE_RESULT } from '~lib/bridge/constants';
import { eip1193TxToSendParams } from '~lib/bridge/transaction/eip1193SendTransactionParams';
import { clearPendingSendTransaction, getPendingSendTransaction } from '~lib/bridge/transaction/pendingSendTransaction';
import { extLogInfo, extLogWarn } from '~lib/extensionLog';
import { getOrUnlockLocalAccount, markUnlockedAccountUsed } from '~lib/vault/unlockSession';
import { getWalletEvmChain, safeRpcErrorMessage } from '~lib/walletUi/readonlyEvmRpc';
import { loadWalletUiState } from '~lib/walletUi/walletUiState';
import { createPublicClient, getAddress, http, type TransactionSerializable } from '~web3/evm/viem';

/**
 * **`eth_sendTransaction` 完成态**：口令解密 → 本地签名 → 按全局钱包设置 `evmTxSubmitMode`
 * 仅返回已签名 RLP，或经当前链（内置 / 自定义 RPC）`eth_sendRawTransaction` 广播后返回交易哈希。
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

export async function approvePendingSendTransactionAndNotify(password: string): Promise<SignApprovalResult> {
  const pending = await getPendingSendTransaction();
  if (!pending) {
    extLogWarn('resolve_send_transaction', { result: 'no_pending' });
    return { ok: false, error: '没有待处理的交易请求。' };
  }

  const addr = getAddress(pending.signerAddress);
  const unlock = await getOrUnlockLocalAccount(addr, password);
  if (unlock.ok === false) {
    const unlockRequired = unlock.reason === 'unlock_required';
    extLogWarn('resolve_send_transaction', {
      requestId: pending.bridgeRequestId,
      result: unlockRequired ? 'unlock_required' : 'unlock_failed'
    });
    return {
      ok: false,
      error: unlockRequired ? '账户已锁定，请输入口令后重试。' : '口令错误或本地无该地址的加密账户。',
      ...(unlockRequired ? { code: 'unlock_required' as const } : {})
    };
  }

  const state = await loadWalletUiState();
  const chainIdHex = state.chainIdHex as `0x${string}`;
  const chain = await getWalletEvmChain(chainIdHex);
  if (!chain) {
    await clearPendingSendTransaction();
    await closeApprovalWindowIfAny(pending.approvalWindowId);
    return { ok: false, error: '当前链未配置 RPC，无法签名或发送交易。' };
  }

  const parsed = eip1193TxToSendParams(pending.transaction, chainIdHex);
  if (parsed.ok === false) {
    await clearPendingSendTransaction();
    await closeApprovalWindowIfAny(pending.approvalWindowId);
    return { ok: false, error: parsed.message };
  }

  const publicClient = createPublicClient({ chain, transport: http() });

  const signOnly = pending.pendingTxRpcMethod === 'eth_signTransaction' || state.evmTxSubmitMode === 'signOnly';
  let serialized: `0x${string}`;
  try {
    serialized = await unlock.account.signTransaction({
      chainId: chain.id,
      ...parsed.params
    } as TransactionSerializable);
  } catch (e) {
    // 本地签名错误可能包含交易字段；只记录错误类型，不把原始 message 带进日志 / UI。
    extLogWarn('resolve_send_transaction', {
      requestId: pending.bridgeRequestId,
      result: 'sign_failed',
      errorName: e instanceof Error ? e.name : 'Error'
    });
    return { ok: false, error: '签名失败，请检查交易参数或账户状态后重试。' };
  }

  let resultHex: `0x${string}`;
  if (signOnly) {
    resultHex = serialized;
  } else {
    try {
      resultHex = await publicClient.sendRawTransaction({ serializedTransaction: serialized });
    } catch (e) {
      // RPC URL 可能含 key；已签名 RLP 也不应进入日志。统一使用脱敏摘要。
      const message = safeRpcErrorMessage(e, !isWalletBuiltinEvmChainId(chain.id));
      extLogWarn('resolve_send_transaction', {
        requestId: pending.bridgeRequestId,
        result: 'send_failed',
        message
      });
      return { ok: false, error: message };
    }
  }
  await markUnlockedAccountUsed(addr);

  const winId = pending.approvalWindowId;
  let tabNotified = false;
  try {
    await chrome.tabs.sendMessage(pending.tabId, {
      type: RUNTIME_MSG_DEFERRED_BRIDGE_RESULT,
      requestId: pending.bridgeRequestId,
      result: resultHex
    });
    tabNotified = true;
  } catch {
    extLogWarn('resolve_send_transaction', {
      requestId: pending.bridgeRequestId,
      result: 'tab_send_failed'
    });
  }
  await clearPendingSendTransaction();
  await closeApprovalWindowIfAny(winId);
  extLogInfo('resolve_send_transaction', {
    requestId: pending.bridgeRequestId,
    origin: pending.origin,
    result: 'ok',
    pendingTxRpcMethod: pending.pendingTxRpcMethod,
    walletUiSubmitMode: state.evmTxSubmitMode,
    tabNotified
  });
  return { ok: true };
}

export async function rejectPendingSendTransactionAndNotify(): Promise<{ ok: boolean }> {
  const pending = await getPendingSendTransaction();
  if (!pending) {
    extLogWarn('reject_send_transaction', { result: 'no_pending' });
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
    extLogWarn('reject_send_transaction', {
      requestId: pending.bridgeRequestId,
      result: 'tab_send_failed'
    });
  }
  await clearPendingSendTransaction();
  await closeApprovalWindowIfAny(winId);
  extLogInfo('reject_send_transaction', {
    requestId: pending.bridgeRequestId,
    origin: pending.origin
  });
  return { ok: true };
}
