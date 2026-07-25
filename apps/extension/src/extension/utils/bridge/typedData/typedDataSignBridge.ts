import { EIP1193_ERROR_CODES } from '@plugin/shared';

import type { SerializableEip712TypedData } from '~/types/bridge';
import { getPendingPersonalSign } from '~lib/bridge/personalSign/pendingPersonalSign';
import { getPendingSiteConnect } from '~lib/bridge/siteConnect/pendingSiteConnect';
import { getPendingSendTransaction } from '~lib/bridge/transaction/pendingSendTransaction';
import { openTypedDataSignApprovalPopup } from '~lib/bridge/typedData/openTypedDataSignPopup';
import { getPendingTypedDataSign, setPendingTypedDataSign } from '~lib/bridge/typedData/pendingTypedDataSign';
import { extLogInfo, extLogWarn } from '~lib/extensionLog';
import { getWalletAccountStoredByAddress } from '~lib/vault/record';
import { getSiteSessionAccountsForOrigin, isSiteOriginAuthorized } from '~lib/walletUi/walletUiState';
import { getAddress } from '~web3/evm/viem';

/**
 * **EIP-712 挂起入口**：解�?`eth_signTypedData*` �?payload（JSON 或对象），校验与 `personalSignBridge` 相同的前置条件后入队并打开 typed data 弹窗�?
 *
 * 未进�?deferred 的拒绝打 `typed_data_sign_blocked`�?*�?*记录 typedData 内容）�?
 */

const PENDING_RPC_CODE = -32002;

type BeginOutcome =
  | { kind: 'deferred'; requestId: string }
  | { kind: 'error'; error: { code: number | string; message: string } };

/** �?DApp 传入�?string JSON 或对象规范为�?JSON 序列化进 session 的结构；不满�?EIP-712 最小形状则返回 `null`�?*/
function parseTypedDataPayload(raw: unknown): SerializableEip712TypedData | null {
  let obj: unknown;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw) as unknown;
    } catch {
      return null;
    }
  } else if (raw && typeof raw === 'object') {
    obj = raw;
  } else {
    return null;
  }
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  const o = obj as Record<string, unknown>;
  if (!o.domain || typeof o.domain !== 'object' || Array.isArray(o.domain)) {
    return null;
  }
  if (!o.types || typeof o.types !== 'object' || Array.isArray(o.types)) {
    return null;
  }
  if (typeof o.primaryType !== 'string') {
    return null;
  }
  if (!o.message || typeof o.message !== 'object' || Array.isArray(o.message)) {
    return null;
  }
  const typesObj = o.types as Record<string, unknown>;
  const types: Record<string, ReadonlyArray<{ name: string; type: string }>> = {};
  for (const [key, val] of Object.entries(typesObj)) {
    if (!Array.isArray(val)) {
      return null;
    }
    const fields: { name: string; type: string }[] = [];
    for (const field of val) {
      if (!field || typeof field !== 'object') {
        return null;
      }
      const f = field as Record<string, unknown>;
      if (typeof f.name !== 'string' || typeof f.type !== 'string') {
        return null;
      }
      fields.push({ name: f.name, type: f.type });
    }
    types[key] = fields;
  }
  return {
    domain: { ...(o.domain as Record<string, unknown>) },
    types,
    primaryType: o.primaryType,
    message: { ...(o.message as Record<string, unknown>) }
  };
}

/**
 * @param params 通常�?`[address, typedData]`（`typedData` 可为 JSON 字符串）
 * @returns �?`beginPersonalSignDeferred`
 */
export async function beginTypedDataSignDeferred(
  bridgeRequestId: string,
  params: readonly unknown[],
  origin: string,
  sender: chrome.runtime.MessageSender
): Promise<BeginOutcome> {
  const tabId = sender.tab?.id ?? -1;
  const windowId = sender.tab?.windowId;
  if (tabId < 0 || windowId === undefined) {
    extLogWarn('typed_data_sign_blocked', {
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
    extLogWarn('typed_data_sign_blocked', {
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

  const addrRaw = params[0];
  const dataRaw = params[1];
  if (typeof addrRaw !== 'string') {
    extLogWarn('typed_data_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'invalid_params_shape'
    });
    return { kind: 'error', error: { code: -32602, message: 'Invalid typed data params' } };
  }

  let signer: `0x${string}`;
  try {
    signer = getAddress(addrRaw as `0x${string}`);
  } catch {
    extLogWarn('typed_data_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'invalid_signer_address'
    });
    return { kind: 'error', error: { code: -32602, message: 'Invalid signer address' } };
  }

  const typedData = parseTypedDataPayload(dataRaw);
  if (!typedData) {
    extLogWarn('typed_data_sign_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'invalid_typed_data_shape'
    });
    return {
      kind: 'error',
      error: { code: -32602, message: 'Invalid typed data JSON (need domain, types, primaryType, message).' }
    };
  }

  const connected = await getSiteSessionAccountsForOrigin(origin, tabId);
  if (connected.length === 0) {
    extLogWarn('typed_data_sign_blocked', {
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
    extLogWarn('typed_data_sign_blocked', {
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
    extLogWarn('typed_data_sign_blocked', {
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
    extLogWarn('typed_data_sign_blocked', {
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
    extLogWarn('typed_data_sign_blocked', {
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
    extLogWarn('typed_data_sign_blocked', {
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
    extLogWarn('typed_data_sign_blocked', {
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

  const pending = {
    bridgeRequestId,
    origin,
    tabId,
    windowId,
    ts: Date.now(),
    signerAddress: signer,
    typedData
  };
  await setPendingTypedDataSign(pending);
  void openTypedDataSignApprovalPopup(pending);
  extLogInfo('typed_data_sign_deferred', {
    requestId: bridgeRequestId,
    origin,
    tabId
  });
  return { kind: 'deferred', requestId: bridgeRequestId };
}
