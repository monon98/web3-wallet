import { EIP1193_ERROR_CODES } from '@plugin/shared';

import type { PendingSendTransaction, PendingTxRpcMethod } from '~/types/bridge';
import { getPendingPersonalSign } from '~lib/bridge/personalSign/pendingPersonalSign';
import { getPendingSiteConnect } from '~lib/bridge/siteConnect/pendingSiteConnect';
import { eip1193TxToSendParams } from '~lib/bridge/transaction/eip1193SendTransactionParams';
import { openSendTransactionApprovalPopup } from '~lib/bridge/transaction/openSendTransactionPopup';
import { getPendingSendTransaction, setPendingSendTransaction } from '~lib/bridge/transaction/pendingSendTransaction';
import { getPendingTypedDataSign } from '~lib/bridge/typedData/pendingTypedDataSign';
import { extLogInfo, extLogWarn } from '~lib/extensionLog';
import { getWalletAccountStoredByAddress } from '~lib/vault/record';
import {
  getSiteSessionAccountsForOrigin,
  isSiteOriginAuthorized,
  loadWalletUiState
} from '~lib/walletUi/walletUiState';
import { getAddress } from '~web3/evm/viem';

/**
 * **`eth_sendTransaction` / `eth_signTransaction` 挂起入口**：校验站点、发起地址与当前会话一致、交易字段与当前链一致。
 */

const PENDING_RPC_CODE = -32002;

type BeginOutcome =
  | { kind: 'deferred'; requestId: string }
  | { kind: 'error'; error: { code: number | string; message: string } };

export async function beginSendTransactionDeferred(
  bridgeRequestId: string,
  params: readonly unknown[],
  origin: string,
  sender: chrome.runtime.MessageSender,
  pendingTxRpcMethod: PendingTxRpcMethod = 'eth_sendTransaction'
): Promise<BeginOutcome> {
  const tabId = sender.tab?.id ?? -1;
  const windowId = sender.tab?.windowId;
  if (tabId < 0 || windowId === undefined) {
    extLogWarn('send_tx_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'missing_tab'
    });
    return {
      kind: 'error',
      error: {
        code: EIP1193_ERROR_CODES.CHAIN_DISCONNECTED,
        message: 'Cannot send transaction from this context (missing tab).'
      }
    };
  }

  if (!(await isSiteOriginAuthorized(origin, tabId))) {
    extLogWarn('send_tx_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'site_not_authorized'
    });
    return {
      kind: 'error',
      error: {
        code: EIP1193_ERROR_CODES.UNAUTHORIZED,
        message: 'Connect the site before sending a transaction.'
      }
    };
  }

  const head = params[0];
  if (!head || typeof head !== 'object' || Array.isArray(head)) {
    extLogWarn('send_tx_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'invalid_params_shape'
    });
    return {
      kind: 'error',
      error: {
        code: -32602,
        message:
          pendingTxRpcMethod === 'eth_signTransaction'
            ? 'Invalid eth_signTransaction params'
            : 'Invalid eth_sendTransaction params'
      }
    };
  }

  const txObj = head as Record<string, unknown>;
  const fromRaw = txObj.from;
  if (typeof fromRaw !== 'string') {
    return { kind: 'error', error: { code: -32602, message: 'Missing from in transaction.' } };
  }

  let signer: `0x${string}`;
  try {
    signer = getAddress(fromRaw as `0x${string}`);
  } catch {
    extLogWarn('send_tx_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'invalid_from'
    });
    return { kind: 'error', error: { code: -32602, message: 'Invalid from address.' } };
  }

  const connected = await getSiteSessionAccountsForOrigin(origin, tabId);
  if (connected.length === 0) {
    extLogWarn('send_tx_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'no_active_site_account'
    });
    return {
      kind: 'error',
      error: {
        code: EIP1193_ERROR_CODES.UNAUTHORIZED,
        message: 'No active account for this site.'
      }
    };
  }
  if (getAddress(connected[0] as `0x${string}`) !== signer) {
    extLogWarn('send_tx_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'signer_mismatch'
    });
    return {
      kind: 'error',
      error: {
        code: -32602,
        message: 'from does not match the active account for this site.'
      }
    };
  }

  if (!(await getWalletAccountStoredByAddress(signer))) {
    extLogWarn('send_tx_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'no_encrypted_local_account'
    });
    return {
      kind: 'error',
      error: {
        code: EIP1193_ERROR_CODES.UNSUPPORTED_METHOD,
        message:
          'No encrypted local account for this address. Import a mnemonic or private key in the extension to send transactions.'
      }
    };
  }

  const state = await loadWalletUiState();
  const chainParse = eip1193TxToSendParams(txObj, state.chainIdHex as `0x${string}`);
  if (chainParse.ok === false) {
    extLogWarn('send_tx_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'tx_parse_failed'
    });
    return { kind: 'error', error: { code: -32602, message: chainParse.message } };
  }

  if (await getPendingSiteConnect()) {
    return {
      kind: 'error',
      error: {
        code: PENDING_RPC_CODE,
        message: 'A connection request is pending; finish or dismiss it first.'
      }
    };
  }
  if (await getPendingPersonalSign()) {
    return {
      kind: 'error',
      error: {
        code: PENDING_RPC_CODE,
        message: 'A signature request is already pending.'
      }
    };
  }
  if (await getPendingTypedDataSign()) {
    return {
      kind: 'error',
      error: {
        code: PENDING_RPC_CODE,
        message: 'A typed data signature request is already pending.'
      }
    };
  }
  if (await getPendingSendTransaction()) {
    extLogWarn('send_tx_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'pending_send_transaction'
    });
    return {
      kind: 'error',
      error: {
        code: PENDING_RPC_CODE,
        message: 'A transaction request is already pending.'
      }
    };
  }

  const pending: PendingSendTransaction = {
    bridgeRequestId,
    origin,
    tabId,
    windowId,
    ts: Date.now(),
    signerAddress: signer,
    pendingTxRpcMethod,
    transaction: txObj
  };
  await setPendingSendTransaction(pending);
  void openSendTransactionApprovalPopup(pending);
  extLogInfo('send_transaction_deferred', {
    requestId: bridgeRequestId,
    origin,
    tabId,
    pendingTxRpcMethod
  });
  return { kind: 'deferred', requestId: bridgeRequestId };
}
