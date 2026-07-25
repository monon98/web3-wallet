import { EIP1193_ERROR_CODES } from '@plugin/shared';

import { RUNTIME_MSG_DEFERRED_BRIDGE_RESULT } from '~lib/bridge/constants';
import { eip1193TxToSendParams } from '~lib/bridge/transaction/eip1193SendTransactionParams';
import { clearPendingSendTransaction, getPendingSendTransaction } from '~lib/bridge/transaction/pendingSendTransaction';
import { extLogInfo, extLogWarn } from '~lib/extensionLog';
import { unlockLocalAccountForAddress } from '~lib/vault/signing';
import { getWalletBuiltinChain } from '~lib/walletUi/readonlyEvmRpc';
import { loadWalletUiState } from '~lib/walletUi/walletUiState';
import { createPublicClient, getAddress, http, type TransactionSerializable } from '~web3/evm/viem';

/**
 * **`eth_sendTransaction` 完成态**：口令解密 → 本地签名 → 按全局钱包设置 `evmTxSubmitMode`
 * 仅返回已签名 RLP，或经内置 RPC `eth_sendRawTransaction` 广播后返回交易哈希。
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

export async function approvePendingSendTransactionAndNotify(
  password: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const pending = await getPendingSendTransaction();
  if (!pending) {
    extLogWarn('resolve_send_transaction', { result: 'no_pending' });
    return { ok: false, error: '没有待处理的交易请求。' };
  }

  const addr = getAddress(pending.signerAddress);
  const acc = await unlockLocalAccountForAddress(addr, password);
  if (!acc) {
    extLogWarn('resolve_send_transaction', {
      requestId: pending.bridgeRequestId,
      result: 'unlock_failed'
    });
    return { ok: false, error: '口令错误或本地无该地址的加密账户。' };
  }

  const state = await loadWalletUiState();
  const chainIdHex = state.chainIdHex as `0x${string}`;
  const chain = getWalletBuiltinChain(chainIdHex);
  if (!chain) {
    await clearPendingSendTransaction();
    await closeApprovalWindowIfAny(pending.approvalWindowId);
    return { ok: false, error: '当前链无内置 RPC，无法签名或发送交易。' };
  }

  const parsed = eip1193TxToSendParams(pending.transaction, chainIdHex);
  if (parsed.ok === false) {
    await clearPendingSendTransaction();
    await closeApprovalWindowIfAny(pending.approvalWindowId);
    return { ok: false, error: parsed.message };
  }

  const publicClient = createPublicClient({ chain, transport: http() });

  let resultHex: `0x${string}`;
  try {
    const serialized = await acc.signTransaction({
      chainId: chain.id,
      ...parsed.params
    } as TransactionSerializable);
    const signOnly = pending.pendingTxRpcMethod === 'eth_signTransaction' || state.evmTxSubmitMode === 'signOnly';
    if (signOnly) {
      resultHex = serialized;
    } else {
      resultHex = await publicClient.sendRawTransaction({ serializedTransaction: serialized });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    extLogWarn('resolve_send_transaction', {
      requestId: pending.bridgeRequestId,
      result:
        pending.pendingTxRpcMethod === 'eth_signTransaction' || state.evmTxSubmitMode === 'signOnly'
          ? 'sign_failed'
          : 'send_failed',
      message: msg
    });
    return {
      ok: false,
      error:
        msg ||
        (pending.pendingTxRpcMethod === 'eth_signTransaction' || state.evmTxSubmitMode === 'signOnly'
          ? '签名失败。'
          : '发送交易失败。')
    };
  }

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
