import { parseBridgeRequest, type BridgeRequest } from '@plugin/shared';
import type { PlasmoCSConfig } from 'plasmo';

import type {
  ContentBridgePending,
  ContentBridgeResponse,
  DeferredBridgeRuntimeMessage,
  InpageBridgeMessage
} from '~/types/contentsPostMessage';
import {
  BRIDGE_POSTMESSAGE_KIND_PENDING,
  RUNTIME_MSG_DEFERRED_BRIDGE_RESULT,
  WEB3_WALLET_BRIDGE_RUNTIME_CHANNEL,
  WEB3_WALLET_POSTMESSAGE_CONTENT_SOURCE,
  WEB3_WALLET_POSTMESSAGE_INPAGE_SOURCE
} from '~lib/bridge/constants';
import { extLogDebug, extLogInfo, extLogWarn } from '~lib/extensionLog';

/**
 * **隔离世界（ISOLATED）** 内容脚本：与页面 **MAIN** 世界的 `inpageEvm.ts` 通过同源 `window.postMessage` 通信，
 * 再把合法 {@link BridgeRequest} 转给 `chrome.runtime.sendMessage` → `background.ts` / `handleBridgeRequest`。
 *
 * **deferred**：后台若返回 `deferred: true`，本脚本会注册 `runtime.onMessage`，直到弹窗批准/拒绝或超时（`DEFERRED_LISTENER_MAX_MS`），
 * 再把最终结果 `postMessage` 回 MAIN。**勿**在此文件执行需要密钥的逻辑。
 *
 * Plasmo：这里的 `matches` 需要**静态字面量**，以便构建阶段生成 `manifest.json` 的 `content_scripts[].matches`。
 * 白名单逻辑与说明见 `~lib/extension/contentScriptWhitelist`。
 */
export const config: PlasmoCSConfig = {
  matches: ['http://localhost/*', 'http://127.0.0.1/*', 'https://localhost/*', 'https://127.0.0.1/*'],
  run_at: 'document_start',
  all_frames: true
};

const INPAGE_SOURCE = WEB3_WALLET_POSTMESSAGE_INPAGE_SOURCE;
const CONTENT_SOURCE = WEB3_WALLET_POSTMESSAGE_CONTENT_SOURCE;
const BRIDGE_CHANNEL = WEB3_WALLET_BRIDGE_RUNTIME_CHANNEL;

/** 用户长时间不关闭弹窗时，避免 `runtime.onMessage` 泄漏；应大于个人签名等交互上限。 */
const DEFERRED_LISTENER_MAX_MS = 310_000;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isInpageBridgeMessage(data: unknown): data is InpageBridgeMessage {
  if (!isRecord(data)) {
    return false;
  }
  return data.source === INPAGE_SOURCE && data.kind === 'bridge-request' && 'payload' in data;
}

function bridgeResponseTargetOrigin(): string {
  try {
    const o = window.location.origin;
    if (typeof o === 'string' && o.length > 0 && o !== 'null') {
      return o;
    }
  } catch {
    /* 不可读 */
  }
  return '*';
}

function postBridgeResponse(msg: ContentBridgeResponse | ContentBridgePending): void {
  try {
    if (typeof window.postMessage !== 'function') {
      return;
    }
    window.postMessage(msg, bridgeResponseTargetOrigin());
  } catch {
    /* 标签页关闭或上下文销毁 */
  }
}

function isDeferredRuntimeMessage(msg: unknown, expectId: string): msg is DeferredBridgeRuntimeMessage {
  if (!isRecord(msg) || msg.type !== RUNTIME_MSG_DEFERRED_BRIDGE_RESULT) {
    return false;
  }
  return msg.requestId === expectId;
}

/** `sendMessage` 到 background；同步结果直接回传，deferred 则挂起监听 `RUNTIME_MSG_DEFERRED_BRIDGE_RESULT`。 */
function relayBridgeRequest(req: BridgeRequest): void {
  chrome.runtime.sendMessage({ channel: BRIDGE_CHANNEL, request: req }, (resp: unknown) => {
    const le = chrome.runtime.lastError;
    if (le) {
      extLogWarn('cs_bridge_sendMessage_error', {
        requestId: req.id,
        message: le.message
      });
      postBridgeResponse({
        source: CONTENT_SOURCE,
        kind: 'bridge-response',
        id: req.id,
        error: { code: -32603, message: le.message }
      });
      return;
    }

    const r = isRecord(resp) ? resp : {};
    if (r.deferred === true && typeof r.requestId === 'string' && r.requestId === req.id) {
      extLogInfo('cs_bridge_deferred_wait', { requestId: req.id });
      const pendingMsg: ContentBridgePending = {
        source: CONTENT_SOURCE,
        kind: BRIDGE_POSTMESSAGE_KIND_PENDING,
        id: req.id
      };
      postBridgeResponse(pendingMsg);

      const finish = (out: ContentBridgeResponse): void => {
        window.clearTimeout(maxWait);
        chrome.runtime.onMessage.removeListener(onRuntimeMessage);
        extLogInfo('cs_bridge_deferred_finish', {
          requestId: req.id,
          hasError: Boolean(out.error)
        });
        postBridgeResponse(out);
      };

      const onRuntimeMessage = (msg: unknown): void => {
        if (!isDeferredRuntimeMessage(msg, req.id)) {
          return;
        }
        finish({
          source: CONTENT_SOURCE,
          kind: 'bridge-response',
          id: req.id,
          result: 'result' in msg ? msg.result : undefined,
          error:
            'error' in msg && isRecord(msg.error) && typeof msg.error.message === 'string'
              ? {
                  code:
                    typeof msg.error.code === 'number' || typeof msg.error.code === 'string' ? msg.error.code : -32603,
                  message: msg.error.message,
                  data: 'data' in msg.error ? msg.error.data : undefined
                }
              : undefined
        });
      };

      const maxWait = window.setTimeout(() => {
        chrome.runtime.onMessage.removeListener(onRuntimeMessage);
        extLogWarn('cs_bridge_deferred_timeout', { requestId: req.id });
        postBridgeResponse({
          source: CONTENT_SOURCE,
          kind: 'bridge-response',
          id: req.id,
          error: { code: 4901, message: 'Extension bridge timeout waiting for user approval.' }
        });
      }, DEFERRED_LISTENER_MAX_MS);

      chrome.runtime.onMessage.addListener(onRuntimeMessage);
      return;
    }

    extLogDebug('cs_bridge_sync_response', {
      requestId: req.id,
      hasError: Boolean('error' in r && isRecord(r.error) && typeof r.error.message === 'string')
    });
    postBridgeResponse({
      source: CONTENT_SOURCE,
      kind: 'bridge-response',
      id: req.id,
      result: 'result' in r ? r.result : undefined,
      error:
        'error' in r && isRecord(r.error) && typeof r.error.message === 'string'
          ? {
              code: typeof r.error.code === 'number' || typeof r.error.code === 'string' ? r.error.code : -32603,
              message: r.error.message,
              data: 'data' in r.error ? r.error.data : undefined
            }
          : undefined
    });
  });
}

function onWindowMessage(event: MessageEvent): void {
  if (event.source !== window || !isInpageBridgeMessage(event.data)) {
    return;
  }

  let req: BridgeRequest;
  try {
    req = parseBridgeRequest(event.data.payload);
  } catch {
    extLogWarn('cs_bridge_parse_failed');
    postBridgeResponse({
      source: CONTENT_SOURCE,
      kind: 'bridge-response',
      id: 'invalid',
      error: { code: -32602, message: 'Invalid bridge envelope' }
    });
    return;
  }

  relayBridgeRequest(req);
}

window.addEventListener('message', onWindowMessage, false);
