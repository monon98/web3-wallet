import type { PlasmoCSConfig } from 'plasmo';

import type { ContentBridgePending, ContentBridgeResponse, Eip1193RequestArgs } from '~/types/contentsPostMessage';
import {
  BRIDGE_POSTMESSAGE_KIND_PENDING,
  WEB3_WALLET_POSTMESSAGE_CONTENT_SOURCE,
  WEB3_WALLET_POSTMESSAGE_INPAGE_SOURCE
} from '~lib/bridge/constants';
import { extLogDebug, extLogInfo, extLogWarn } from '~lib/extensionLog';

/**
 * 页面 **MAIN** 世界入口（Plasmo `world: "MAIN"`，等价于向页面注入 `<script>`）。
 * 暴露 **EIP-6963** 广播与 `window.ethereum`（`request` → `postMessage` → 隔离脚本 `allUrls.ts` → background；注入范围见 `~lib/extension/contentScriptWhitelist`）。
 *
 * **约束**：勿 `import` 会拖入 Node / 过重依赖的模块，以免页面上下文解析失败；`extensionLog` 仅封装 `console` + `NODE_ENV`，可安全打包进 MAIN。
 *
 * @see https://eips.ethereum.org/EIPS/eip-6963
 * @see https://eips.ethereum.org/EIPS/eip-1193
 */
export const config: PlasmoCSConfig = {
  matches: ['http://localhost/*', 'http://127.0.0.1/*', 'https://localhost/*', 'https://127.0.0.1/*'],
  run_at: 'document_start',
  all_frames: true,
  world: 'MAIN'
};

/** 与 @plugin/shared EIP1193_ERROR_CODES.CHAIN_DISCONNECTED 对齐 */
const EIP1193_CHAIN_DISCONNECTED = 4901;

const ANNOUNCE_EVENT = 'eip6963:announceProvider';
const REQUEST_EVENT = 'eip6963:requestProvider';

const INPAGE_SOURCE = WEB3_WALLET_POSTMESSAGE_INPAGE_SOURCE;
const CONTENT_SOURCE = WEB3_WALLET_POSTMESSAGE_CONTENT_SOURCE;

const WALLET_ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#627EEA"/><path fill="#fff" d="M9 11h14v10H9z" opacity=".9"/></svg>'
  );

const WALLET_NAME = 'Web3 wallet';
const WALLET_RDNS = 'com.monon98.web3wallet';

const BRIDGE_CALL_TIMEOUT_MS = 12_000;
const USER_APPROVAL_BRIDGE_TIMEOUT_MS = 300_000;

/** 与隔离脚本 `postMessage` 的 `targetOrigin` 对齐；沙箱/不透明 origin 时为 `*`。 */
function bridgePostMessageTargetOrigin(): string {
  try {
    const o = window.location.origin;
    if (typeof o === 'string' && o.length > 0 && o !== 'null') {
      return o;
    }
  } catch {
    /* location 不可读 */
  }
  return '*';
}

function newBridgeRequestId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* 非安全上下文等 */
  }
  return `rid_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function rpcError(code: number, message: string): Error {
  const err = new Error(message);
  Object.assign(err, { code });
  return err;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isBridgeResponse(data: unknown, expectId: string): data is ContentBridgeResponse {
  if (!isRecord(data)) {
    return false;
  }
  return data.source === CONTENT_SOURCE && data.kind === 'bridge-response' && data.id === expectId;
}

function isBridgePending(data: unknown, expectId: string): data is ContentBridgePending {
  if (!isRecord(data)) {
    return false;
  }
  return data.source === CONTENT_SOURCE && data.kind === BRIDGE_POSTMESSAGE_KIND_PENDING && data.id === expectId;
}

/**
 * 向隔离世界发 `bridge-request`，等待 `bridge-response`；若先收到 **pending**，则拉长超时等待用户弹窗。
 * 错误以带 `code` 的 `Error` reject（对齐 EIP-1193 习惯）。
 */
function callBackgroundViaBridge(args: Eip1193RequestArgs): Promise<unknown> {
  const id = newBridgeRequestId();
  const payload = {
    id,
    method: 'eip1193_request' as const,
    params: {
      method: args.method,
      params: args.params !== undefined ? [...args.params] : []
    }
  };

  return new Promise((resolve, reject) => {
    const root = globalThis as unknown as Window;
    if (typeof root.postMessage !== 'function') {
      extLogWarn('inpage_bridge', { phase: 'no_postMessage', requestId: id, method: args.method });
      reject(rpcError(EIP1193_CHAIN_DISCONNECTED, 'window.postMessage is not available in this context.'));
      return;
    }

    const targetOrigin = bridgePostMessageTargetOrigin();
    extLogDebug('inpage_bridge_rpc_start', {
      requestId: id,
      method: args.method,
      targetOrigin: targetOrigin === '*' ? 'opaque' : 'same_page'
    });

    let timer = root.setTimeout(() => {
      root.removeEventListener('message', onResponse);
      extLogWarn('inpage_bridge_timeout', {
        requestId: id,
        method: args.method,
        phase: 'rpc'
      });
      reject(rpcError(EIP1193_CHAIN_DISCONNECTED, 'Extension bridge timeout.'));
    }, BRIDGE_CALL_TIMEOUT_MS);

    function onResponse(event: MessageEvent): void {
      if (event.source !== root) {
        return;
      }
      if (isBridgePending(event.data, id)) {
        root.clearTimeout(timer);
        extLogInfo('inpage_bridge_pending', { requestId: id, method: args.method });
        timer = root.setTimeout(() => {
          root.removeEventListener('message', onResponse);
          extLogWarn('inpage_bridge_timeout', {
            requestId: id,
            method: args.method,
            phase: 'approval'
          });
          reject(rpcError(EIP1193_CHAIN_DISCONNECTED, 'User approval timed out.'));
        }, USER_APPROVAL_BRIDGE_TIMEOUT_MS);
        return;
      }
      if (!isBridgeResponse(event.data, id)) {
        return;
      }
      root.clearTimeout(timer);
      root.removeEventListener('message', onResponse);
      const d = event.data;
      if (d.error) {
        const raw = d.error.code;
        const code =
          typeof raw === 'number'
            ? raw
            : typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))
              ? Number(raw)
              : 4000;
        extLogDebug('inpage_bridge_error', {
          requestId: id,
          method: args.method,
          code
        });
        reject(rpcError(code, String(d.error.message)));
      } else {
        extLogDebug('inpage_bridge_ok', { requestId: id, method: args.method });
        resolve(d.result);
      }
    }

    try {
      root.addEventListener('message', onResponse, false);
      root.postMessage(
        {
          source: INPAGE_SOURCE,
          kind: 'bridge-request',
          payload
        },
        targetOrigin
      );
    } catch (e) {
      root.removeEventListener('message', onResponse);
      root.clearTimeout(timer);
      const msg = e instanceof Error ? e.message : String(e);
      extLogWarn('inpage_bridge_postMessage_throw', { requestId: id, method: args.method, message: msg });
      reject(rpcError(EIP1193_CHAIN_DISCONNECTED, `Bridge postMessage failed: ${msg}`));
    }
  });
}

const providerSessionUuid = newBridgeRequestId();

function announceProvider(provider: {
  request: (args: Eip1193RequestArgs) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => unknown;
  removeListener: (event: string, handler: (...args: unknown[]) => void) => unknown;
}): void {
  const detail = Object.freeze({
    info: Object.freeze({
      uuid: providerSessionUuid,
      name: WALLET_NAME,
      icon: WALLET_ICON,
      rdns: WALLET_RDNS
    }),
    provider
  });

  try {
    const root = globalThis as unknown as Window;
    root.dispatchEvent(new CustomEvent(ANNOUNCE_EVENT, { detail }));
  } catch {
    /* 极端环境无 CustomEvent */
  }
}

const ethereumProvider = {
  request: (args: Eip1193RequestArgs): Promise<unknown> => callBackgroundViaBridge(args),

  on(_event: string, _handler: (...args: unknown[]) => void) {
    return ethereumProvider;
  },

  removeListener(_event: string, _handler: (...args: unknown[]) => void) {
    return ethereumProvider;
  }
};

/** 注册 `eip6963:requestProvider`、立即 announce 一次，并在未占用时挂上 `window.ethereum`。 */
function installEip6963AndEthereum(): void {
  const root = globalThis as unknown as Window & { ethereum?: unknown };
  if (typeof root.addEventListener !== 'function') {
    return;
  }
  root.addEventListener(REQUEST_EVENT, () => {
    announceProvider(ethereumProvider);
  });

  announceProvider(ethereumProvider);

  if (root.ethereum === undefined) {
    root.ethereum = ethereumProvider;
  }
}

installEip6963AndEthereum();
