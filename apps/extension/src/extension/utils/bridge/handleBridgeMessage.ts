import type { BridgeRequest } from '@plugin/shared';
import { EIP1193_ERROR_CODES } from '@plugin/shared';
import type { Address } from 'viem';

import type { BridgeHandlerResult, PendingSiteConnectKind } from '~/types/bridge';
import { getPendingPersonalSign } from '~lib/bridge/personalSign/pendingPersonalSign';
import { beginPersonalSignDeferred } from '~lib/bridge/personalSign/personalSignBridge';
import { openSiteConnectApprovalPopup } from '~lib/bridge/siteConnect/openSiteConnectPopup';
import { getPendingSiteConnect, setPendingSiteConnect } from '~lib/bridge/siteConnect/pendingSiteConnect';
import { getPendingSendTransaction } from '~lib/bridge/transaction/pendingSendTransaction';
import { beginSendTransactionDeferred } from '~lib/bridge/transaction/sendTransactionBridge';
import { getPendingTypedDataSign } from '~lib/bridge/typedData/pendingTypedDataSign';
import { beginTypedDataSignDeferred } from '~lib/bridge/typedData/typedDataSignBridge';
import { extLogInfo, extLogWarn } from '~lib/extensionLog';
import {
  broadcastSignedRawTransaction,
  fetchEthBlockNumberHex,
  fetchEthGetBalanceHex,
  isWalletEvmChainConfigured,
  NO_CONFIGURED_RPC_ERROR_PREFIX
} from '~lib/walletUi/readonlyEvmRpc';
import {
  getSiteSessionAccountsForOrigin,
  isSiteOriginAuthorized,
  loadWalletUiState,
  normalizeChainIdHexInput,
  revokeSiteSessionOrigin,
  setWalletChainIdHex
} from '~lib/walletUi/walletUiState';
import { isAddress, isHex, type Hex } from '~web3/evm/viem';

/**
 * **DApp 桥接请求处理**（background 核心）：将 content script 收到的 {@link BridgeRequest} 转为钱包状态读写、
 * EIP-1193 JSON-RPC 行为，或挂起为「待用户批准」的连接/签名（打开对应 tab 弹窗）。
 *
 * **数据流**：网页 `window.ethereum`（inpage）→ 隔离脚本信封 → 本模块 → `chrome.storage` / 只读 RPC / 弹窗。
 *
 * **站点维度**：多数逻辑以 **origin + tabId** 区分会话；`senderOrigin` 从 `sender.tab.url` 解析，扩展页无有效站点 origin 时拒绝。
 *
 * 契约类型见 `@plugin/shared` `bridge/envelope`；错误码与 EIP-1193 对齐，见 `EIP1193_ERROR_CODES`。
 *
 * 开发日志：除同步拒绝的 `bridge_throw`（JSON-RPC throw）外，还有 `site_connect_blocked`、`bridge_handler_reject`。
 */

/** 从消息发送者解析页面 origin；扩展自身 URL 无有效站点 origin 时返回 null。 */
function senderOrigin(sender: chrome.runtime.MessageSender): string | null {
  const url = sender.tab?.url ?? sender.url;
  if (!url || url.startsWith('chrome-extension://')) {
    return null;
  }
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** `eip1193_request` 的 params 为单个 `{ method, params }`，与标准 JSON-RPC 嵌套一致。 */
function parseEip1193NestedParams(params: unknown): { method: string; params: unknown[] } {
  if (!params || typeof params !== 'object') {
    return { method: '', params: [] };
  }
  const o = params as Record<string, unknown>;
  const method = typeof o.method === 'string' ? o.method : '';
  const inner = o.params;
  const paramsArr = Array.isArray(inner) ? inner : [];
  return { method, params: paramsArr };
}

/** `net_version` 返回十进制字符串链 ID（历史兼容）。 */
function chainIdToNetVersion(chainIdHex: string): string {
  try {
    return BigInt(chainIdHex).toString(10);
  } catch {
    return '1';
  }
}

/** 与挂起连接/签名冲突时返回的 JSON-RPC 风格 code（非标准 EIP-1193 枚举，DApp 可据此提示用户先处理弹窗）。 */
const PENDING_CONNECT_RPC_CODE = -32002;

/**
 * 处理 **已授权站点** 下的标准 JSON-RPC（不含 `eth_requestAccounts` / `personal_sign` / typed data，它们在入口处分流）。
 *
 * - 只读：`eth_getBalance` / `eth_blockNumber` 走内置公共 RPC 或用户配置的自定义 RPC。
 * - 切链：`wallet_*` 仅允许切换到内置链或侧栏已配置的自定义链。
 * - 广播：`eth_sendRawTransaction`（已签名 RLP），使用当前链配置的 RPC。
 * - 未列入此函数的：`eth_sign` / `personal_sign` / typed data / 交易类在 `eip1193_request` 入口分流。
 */
async function handleEip1193JsonRpc(
  method: string,
  _params: readonly unknown[],
  origin: string,
  tabId: number
): Promise<unknown> {
  const state = await loadWalletUiState();

  switch (method) {
    case 'eth_chainId':
      return state.chainIdHex;
    case 'net_version':
      return chainIdToNetVersion(state.chainIdHex);
    case 'eth_accounts':
      return [...(await getSiteSessionAccountsForOrigin(origin, tabId))];
    case 'eth_getBalance': {
      if (!(await isSiteOriginAuthorized(origin, tabId))) {
        throw Object.assign(new Error('Unauthorized: connect the site first'), {
          code: EIP1193_ERROR_CODES.UNAUTHORIZED
        });
      }
      const addrParam = _params[0];
      const blockArg = typeof _params[1] === 'string' ? _params[1] : 'latest';
      if (typeof addrParam !== 'string' || !isAddress(addrParam)) {
        throw Object.assign(new Error('Invalid address'), { code: -32602 });
      }
      try {
        return await fetchEthGetBalanceHex(state.chainIdHex, addrParam as Address, blockArg);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const code = msg.includes(NO_CONFIGURED_RPC_ERROR_PREFIX) ? EIP1193_ERROR_CODES.UNSUPPORTED_METHOD : -32603;
        throw Object.assign(new Error(msg), { code });
      }
    }
    case 'eth_blockNumber': {
      try {
        return await fetchEthBlockNumberHex(state.chainIdHex);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const code = msg.includes(NO_CONFIGURED_RPC_ERROR_PREFIX) ? EIP1193_ERROR_CODES.UNSUPPORTED_METHOD : -32603;
        throw Object.assign(new Error(msg), { code });
      }
    }
    case 'wallet_switchEthereumChain': {
      const head = _params[0];
      if (!head || typeof head !== 'object') {
        throw Object.assign(new Error('Invalid params'), { code: -32602 });
      }
      const raw = (head as Record<string, unknown>).chainId;
      if (typeof raw !== 'string') {
        throw Object.assign(new Error('Invalid chainId'), { code: -32602 });
      }
      const normalized = normalizeChainIdHexInput(raw);
      if (!normalized) {
        throw Object.assign(new Error('Invalid chainId'), { code: -32602 });
      }
      if (!(await isWalletEvmChainConfigured(normalized))) {
        throw Object.assign(new Error('Unrecognized chain'), { code: 4902 });
      }
      if (state.chainIdHex.toLowerCase() === normalized.toLowerCase()) {
        return null;
      }
      await setWalletChainIdHex(normalized);
      return null;
    }
    case 'wallet_addEthereumChain': {
      const head = _params[0];
      if (!head || typeof head !== 'object') {
        throw Object.assign(new Error('Invalid params'), { code: -32602 });
      }
      const raw = (head as Record<string, unknown>).chainId;
      if (typeof raw !== 'string') {
        throw Object.assign(new Error('Invalid chainId'), { code: -32602 });
      }
      const normalized = normalizeChainIdHexInput(raw);
      if (!normalized) {
        throw Object.assign(new Error('Invalid chainId'), { code: -32602 });
      }
      // 自定义链只允许用户在侧栏显式添加；DApp 传入的 rpcUrls 不作为信任来源。
      if (!(await isWalletEvmChainConfigured(normalized))) {
        throw Object.assign(new Error('Unrecognized chain; add it in the wallet DApp settings first'), {
          code: 4902
        });
      }
      await setWalletChainIdHex(normalized);
      return null;
    }
    case 'eth_sendRawTransaction': {
      if (!(await isSiteOriginAuthorized(origin, tabId))) {
        throw Object.assign(new Error('Unauthorized: connect the site first'), {
          code: EIP1193_ERROR_CODES.UNAUTHORIZED
        });
      }
      const rawTx = _params[0];
      if (typeof rawTx !== 'string' || !isHex(rawTx)) {
        throw Object.assign(new Error('Invalid serialized transaction'), { code: -32602 });
      }
      try {
        return await broadcastSignedRawTransaction(state.chainIdHex, rawTx as Hex);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        const code = msg.includes(NO_CONFIGURED_RPC_ERROR_PREFIX) ? EIP1193_ERROR_CODES.UNSUPPORTED_METHOD : -32603;
        throw Object.assign(new Error(msg), { code });
      }
    }
    default:
      throw Object.assign(new Error(`Unsupported method: ${method}`), {
        code: EIP1193_ERROR_CODES.UNSUPPORTED_METHOD
      });
  }
}

type BeginDeferredOutcome =
  | { kind: 'authorized' }
  | { kind: 'deferred'; requestId: string }
  | { kind: 'error'; error: { code: number | string; message: string } };

/**
 * 站点连接前置：已授权则直接通过；否则检查是否与别的挂起请求互斥，再写入 pending 并打开连接批准弹窗。
 * @returns `authorized` | `deferred`（DApp 应等待 bridge 后续响应）| `error`
 */
async function beginSiteConnectFlow(
  bridgeRequestId: string,
  pendingKind: PendingSiteConnectKind,
  origin: string,
  sender: chrome.runtime.MessageSender
): Promise<BeginDeferredOutcome> {
  const tabId = sender.tab?.id ?? -1;
  const windowId = sender.tab?.windowId;
  if (tabId < 0 || windowId === undefined) {
    extLogWarn('site_connect_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'missing_tab'
    });
    return {
      kind: 'error',
      error: {
        code: EIP1193_ERROR_CODES.CHAIN_DISCONNECTED,
        message: 'Cannot connect from this context (missing tab).'
      }
    };
  }

  if (await isSiteOriginAuthorized(origin, tabId)) {
    return { kind: 'authorized' };
  }
  if (await getPendingSiteConnect()) {
    extLogWarn('site_connect_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'pending_connect'
    });
    return {
      kind: 'error',
      error: {
        code: PENDING_CONNECT_RPC_CODE,
        message: 'A connection request is already pending. Approve or reject it in the extension approval window first.'
      }
    };
  }
  if (await getPendingPersonalSign()) {
    extLogWarn('site_connect_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'pending_personal_sign'
    });
    return {
      kind: 'error',
      error: {
        code: PENDING_CONNECT_RPC_CODE,
        message: 'A signature request is pending. Approve or reject it in the extension window first.'
      }
    };
  }
  if (await getPendingTypedDataSign()) {
    extLogWarn('site_connect_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'pending_typed_data_sign'
    });
    return {
      kind: 'error',
      error: {
        code: PENDING_CONNECT_RPC_CODE,
        message: 'A typed data signature request is pending. Approve or reject it in the extension window first.'
      }
    };
  }
  if (await getPendingSendTransaction()) {
    extLogWarn('site_connect_blocked', {
      requestId: bridgeRequestId,
      origin,
      reason: 'pending_send_transaction'
    });
    return {
      kind: 'error',
      error: {
        code: PENDING_CONNECT_RPC_CODE,
        message: 'A transaction request is pending. Approve or reject it in the extension window first.'
      }
    };
  }

  const pending = {
    bridgeRequestId,
    kind: pendingKind,
    origin,
    tabId,
    windowId,
    ts: Date.now()
  };
  await setPendingSiteConnect(pending);
  void openSiteConnectApprovalPopup(pending);
  extLogInfo('site_connect_deferred', {
    requestId: bridgeRequestId,
    origin,
    kind: pendingKind
  });
  return { kind: 'deferred', requestId: bridgeRequestId };
}

/**
 * Bridge 总入口：按 `request.method` 分发到 EIP-1193 子流程、connect/disconnect 或显式不支持的方法。
 * @param request 已通过内容脚本校验的信封（含 `id`）
 * @param sender Chrome `runtime` 消息发送者（用于 origin 与 tabId）
 * @returns 同步 `result`、错误 `error`、或 `deferred: true`（连接/签名待弹窗确认）
 */
export async function handleBridgeRequest(
  request: BridgeRequest,
  sender: chrome.runtime.MessageSender
): Promise<BridgeHandlerResult> {
  const origin = senderOrigin(sender);
  if (!origin) {
    extLogWarn('bridge_no_origin', {
      requestId: request.id,
      bridgeMethod: request.method
    });
    return {
      error: {
        code: EIP1193_ERROR_CODES.DISCONNECTED,
        message: 'Cannot resolve page origin for this message.'
      }
    };
  }

  const dappTabId = sender.tab?.id ?? -1;
  const eip1193Sub =
    request.method === 'eip1193_request' ? parseEip1193NestedParams(request.params).method || undefined : undefined;
  extLogInfo('bridge_in', {
    requestId: request.id,
    bridgeMethod: request.method,
    origin,
    tabId: dappTabId,
    eip1193Method: eip1193Sub
  });

  try {
    switch (request.method) {
      case 'eip1193_request': {
        const { method, params } = parseEip1193NestedParams(request.params);
        if (!method) {
          extLogWarn('bridge_handler_reject', {
            requestId: request.id,
            origin,
            reason: 'missing_eip1193_inner_method'
          });
          return {
            error: { code: -32602, message: 'Invalid eip1193_request params' }
          };
        }
        if (method === 'eth_requestAccounts') {
          const flow = await beginSiteConnectFlow(request.id, 'eth_requestAccounts', origin, sender);
          if (flow.kind === 'error') {
            return { error: flow.error };
          }
          if (flow.kind === 'deferred') {
            return { deferred: true, requestId: flow.requestId };
          }
          const accts = await getSiteSessionAccountsForOrigin(origin, dappTabId);
          if (accts.length === 0) {
            extLogWarn('bridge_handler_reject', {
              requestId: request.id,
              origin,
              reason: 'eth_request_accounts_no_session'
            });
            return {
              error: {
                code: EIP1193_ERROR_CODES.UNAUTHORIZED,
                message: 'No account connected for this site. Connect again from the extension.'
              }
            };
          }
          return { result: [...accts] };
        }
        if (method === 'personal_sign') {
          const flow = await beginPersonalSignDeferred(request.id, params, origin, sender);
          if (flow.kind === 'error') {
            return { error: flow.error };
          }
          return { deferred: true, requestId: flow.requestId };
        }
        if (method === 'eth_sign') {
          const addr = params[0];
          const data = params[1];
          if (typeof addr !== 'string' || typeof data !== 'string') {
            return { error: { code: -32602, message: 'Invalid eth_sign params' } };
          }
          const flow = await beginPersonalSignDeferred(request.id, [data, addr], origin, sender);
          if (flow.kind === 'error') {
            return { error: flow.error };
          }
          return { deferred: true, requestId: flow.requestId };
        }
        if (method === 'eth_signTypedData_v4' || method === 'eth_signTypedData_v3' || method === 'eth_signTypedData') {
          const flow = await beginTypedDataSignDeferred(request.id, params, origin, sender);
          if (flow.kind === 'error') {
            return { error: flow.error };
          }
          return { deferred: true, requestId: flow.requestId };
        }
        if (method === 'eth_sendTransaction') {
          const flow = await beginSendTransactionDeferred(request.id, params, origin, sender);
          if (flow.kind === 'error') {
            return { error: flow.error };
          }
          return { deferred: true, requestId: flow.requestId };
        }
        if (method === 'eth_signTransaction') {
          const flow = await beginSendTransactionDeferred(request.id, params, origin, sender, 'eth_signTransaction');
          if (flow.kind === 'error') {
            return { error: flow.error };
          }
          return { deferred: true, requestId: flow.requestId };
        }
        const result = await handleEip1193JsonRpc(method, params, origin, dappTabId);
        return { result };
      }
      case 'connect': {
        const flow = await beginSiteConnectFlow(request.id, 'connect', origin, sender);
        if (flow.kind === 'error') {
          return { error: flow.error };
        }
        if (flow.kind === 'deferred') {
          return { deferred: true, requestId: flow.requestId };
        }
        const s = await loadWalletUiState();
        const accts = await getSiteSessionAccountsForOrigin(origin, dappTabId);
        if (accts.length === 0) {
          extLogWarn('bridge_handler_reject', {
            requestId: request.id,
            origin,
            reason: 'connect_no_session'
          });
          return {
            error: {
              code: EIP1193_ERROR_CODES.UNAUTHORIZED,
              message: 'No account connected for this site.'
            }
          };
        }
        return {
          result: {
            accounts: [...accts],
            chainId: s.chainIdHex
          }
        };
      }
      case 'disconnect': {
        await revokeSiteSessionOrigin(origin);
        return { result: null };
      }
      case 'eth_accounts': {
        const accounts = await getSiteSessionAccountsForOrigin(origin, dappTabId);
        return { result: [...accounts] };
      }
      case 'signMessage':
      case 'signTypedData':
        extLogWarn('bridge_handler_reject', {
          requestId: request.id,
          origin,
          reason: 'legacy_bridge_method_not_implemented',
          bridgeMethod: request.method
        });
        return {
          error: {
            code: EIP1193_ERROR_CODES.UNSUPPORTED_METHOD,
            message: 'Not implemented.'
          }
        };
      case 'signTransaction': {
        const raw = request.params;
        const arr: unknown[] = Array.isArray(raw) ? raw : raw !== undefined && raw !== null ? [raw] : [];
        const flow = await beginSendTransactionDeferred(request.id, arr, origin, sender, 'eth_signTransaction');
        if (flow.kind === 'error') {
          return { error: flow.error };
        }
        return { deferred: true, requestId: flow.requestId };
      }
      case 'sendTransaction': {
        const raw = request.params;
        const arr: unknown[] = Array.isArray(raw) ? raw : raw !== undefined && raw !== null ? [raw] : [];
        const flow = await beginSendTransactionDeferred(request.id, arr, origin, sender, 'eth_sendTransaction');
        if (flow.kind === 'error') {
          return { error: flow.error };
        }
        return { deferred: true, requestId: flow.requestId };
      }
      default:
        extLogWarn('bridge_handler_reject', {
          requestId: request.id,
          origin,
          reason: 'unknown_bridge_method',
          bridgeMethod: request.method
        });
        return {
          error: {
            code: EIP1193_ERROR_CODES.UNSUPPORTED_METHOD,
            message: 'Unknown bridge method.'
          }
        };
    }
  } catch (e) {
    const err = e as { code?: number; message?: string };
    const code = typeof err.code === 'number' ? err.code : EIP1193_ERROR_CODES.UNSUPPORTED_METHOD;
    const message = typeof err.message === 'string' ? err.message : 'Request failed';
    extLogWarn('bridge_throw', { requestId: request.id, origin, code, message });
    return { error: { code, message } };
  }
}
