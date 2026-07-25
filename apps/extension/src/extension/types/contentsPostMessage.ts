import {
  BRIDGE_POSTMESSAGE_KIND_PENDING,
  RUNTIME_MSG_DEFERRED_BRIDGE_RESULT,
  WEB3_WALLET_POSTMESSAGE_CONTENT_SOURCE,
  WEB3_WALLET_POSTMESSAGE_INPAGE_SOURCE
} from '~lib/bridge/constants';

/**
 * 隔离内容脚本与 MAIN inpage 之间的 **postMessage** 形状，以及隔离脚本监听的 **deferred runtime** 消息。
 * 字符串常量须与 `~lib/bridge/constants` 完全一致。
 */

export type Eip1193RequestArgs = { method: string; params?: readonly unknown[] };

export type InpageBridgeMessage = {
  source: typeof WEB3_WALLET_POSTMESSAGE_INPAGE_SOURCE;
  kind: 'bridge-request';
  payload: unknown;
};

export type ContentBridgeResponse = {
  source: typeof WEB3_WALLET_POSTMESSAGE_CONTENT_SOURCE;
  kind: 'bridge-response';
  id: string;
  result?: unknown;
  error?: { code: number | string; message: string; data?: unknown };
};

export type ContentBridgePending = {
  source: typeof WEB3_WALLET_POSTMESSAGE_CONTENT_SOURCE;
  kind: typeof BRIDGE_POSTMESSAGE_KIND_PENDING;
  id: string;
};

export type DeferredBridgeRuntimeMessage = {
  type: typeof RUNTIME_MSG_DEFERRED_BRIDGE_RESULT;
  requestId: string;
  result?: unknown;
  error?: { code: number | string; message: string; data?: unknown };
};
