import { EIP1193_ERROR_CODES } from '@plugin/shared';

import { openPersonalSignApprovalPopup } from '~lib/bridge/personalSign/openPersonalSignPopup';
import { getPendingPersonalSign, setPendingPersonalSign } from '~lib/bridge/personalSign/pendingPersonalSign';
import { getPendingSiteConnect } from '~lib/bridge/siteConnect/pendingSiteConnect';
import { getPendingSendTransaction } from '~lib/bridge/transaction/pendingSendTransaction';
import { getPendingTypedDataSign } from '~lib/bridge/typedData/pendingTypedDataSign';
import { extLogInfo, extLogWarn } from '~lib/extensionLog';
import { getWalletAccountStoredByAddress } from '~lib/vault/record';
import { personalSignPayloadToHex } from '~lib/vault/signing';
import { getSiteSessionAccountsForOrigin, isSiteOriginAuthorized } from '~lib/walletUi/walletUiState';
import { getAddress } from '~web3/evm/viem';

/**
 * **personal_sign 挂起入口**（由 `handleBridgeRequest` 调用）：校验站点已连接、signer 与当前会话一致�?
 * 本地存在加密账户，且与其�?pending（连�?/ 另一签名）互斥；通过后写�?`chrome.storage.session` 并打开签名弹窗�?
 *
 * 未进�?deferred 的拒绝打 `personal_sign_blocked`（含 `reason`�?*�?*记录消息体）�?
 */

const PENDING_RPC_CODE = -32002;

type BeginPersonalSignOutcome =
  | { kind: 'deferred'; requestId: string }
  | { kind: 'error'; error: { code: number | string; message: string } };

/**
 * @param bridgeRequestId �?DApp �?deferred 响应关联�?id（同 `BridgeRequest.id`�?
 * @param params EIP-1193 `personal_sign`：`[message, address]`
 * @returns `deferred` 表示已打开弹窗；`error` 为参�?授权/互斥等问�?
 */
export async function beginPersonalSignDeferred(
  bridgeRequestId: string,
  params: readonly unknown[],
  origin: string,
  sender: chrome.runtime.MessageSender
): Promise<BeginPersonalSignOutcome> {
  const tabId = sender.tab?.id ?? -1;
  const windowId = sender.tab?.windowId;
  if (tabId < 0 || windowId === undefined) {
    extLogWarn('personal_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'missing_tab'
    });
    return {
      kind: 'error',
      error: {
        code: EIP1193_ERROR_CODES.CHAIN_DISCONNECTED,
        message: 'Cannot sign from this context (missing tab).'
      }
    };
  }

  if (!(await isSiteOriginAuthorized(origin, tabId))) {
    extLogWarn('personal_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'site_not_authorized'
    });
    return {
      kind: 'error',
      error: {
        code: EIP1193_ERROR_CODES.UNAUTHORIZED,
        message: 'Connect the site before signing.'
      }
    };
  }

  const msgRaw = params[0];
  const addrRaw = params[1];
  if (typeof msgRaw !== 'string' || typeof addrRaw !== 'string') {
    extLogWarn('personal_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'invalid_params_shape'
    });
    return { kind: 'error', error: { code: -32602, message: 'Invalid personal_sign params' } };
  }

  let signer: `0x${string}`;
  try {
    signer = getAddress(addrRaw as `0x${string}`);
  } catch {
    extLogWarn('personal_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'invalid_signer_address'
    });
    return { kind: 'error', error: { code: -32602, message: 'Invalid signer address' } };
  }

  const connected = await getSiteSessionAccountsForOrigin(origin, tabId);
  if (connected.length === 0) {
    extLogWarn('personal_sign_blocked', {
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
    extLogWarn('personal_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'signer_mismatch'
    });
    return {
      kind: 'error',
      error: {
        code: -32602,
        message: 'Signer address does not match the active account for this site.'
      }
    };
  }

  if (!(await getWalletAccountStoredByAddress(signer))) {
    extLogWarn('personal_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'no_encrypted_local_account'
    });
    return {
      kind: 'error',
      error: {
        code: EIP1193_ERROR_CODES.UNSUPPORTED_METHOD,
        message:
          'No encrypted local account for this address. Import a mnemonic or private key in the extension to sign.'
      }
    };
  }

  if (await getPendingSiteConnect()) {
    extLogWarn('personal_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'pending_site_connect'
    });
    return {
      kind: 'error',
      error: {
        code: PENDING_RPC_CODE,
        message: 'A connection request is pending; finish or dismiss it first.'
      }
    };
  }
  if (await getPendingPersonalSign()) {
    extLogWarn('personal_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'pending_personal_sign'
    });
    return {
      kind: 'error',
      error: {
        code: PENDING_RPC_CODE,
        message: 'A signature request is already pending.'
      }
    };
  }
  if (await getPendingTypedDataSign()) {
    extLogWarn('personal_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'pending_typed_data_sign'
    });
    return {
      kind: 'error',
      error: {
        code: PENDING_RPC_CODE,
        message: 'A typed data signature request is already pending.'
      }
    };
  }
  if (await getPendingSendTransaction()) {
    extLogWarn('personal_sign_blocked', {
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

  const messageHex = personalSignPayloadToHex(msgRaw);
  const pending = {
    bridgeRequestId,
    origin,
    tabId,
    windowId,
    ts: Date.now(),
    signerAddress: signer,
    messageHex
  };
  await setPendingPersonalSign(pending);
  void openPersonalSignApprovalPopup(pending);
  extLogInfo('personal_sign_deferred', {
    requestId: bridgeRequestId,
    origin,
    tabId
  });
  return { kind: 'deferred', requestId: bridgeRequestId };
}
