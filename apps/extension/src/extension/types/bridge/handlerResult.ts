/**
 * `handleBridgeRequest`（background）同步返回形态（含 deferred）。
 */

export type BridgeHandlerResult =
  | { result?: unknown; error?: { code: number | string; message: string } }
  | { deferred: true; requestId: string };
