import { z } from 'zod';

/**
 * **扩展 ↔ 网页 DApp** 的桥接信封（方法名 + 请求/响应形状），与 `apps/extension` content/background 共用。
 * `eip1193_request` 承载标准 JSON-RPC 子调用；其余为历史/高层方法占位。
 * 技术方案约定见 `docs/engineering/TECHNICAL-SOLUTION.md` 桥接与信任边界（§5.1、§4.1）；扩展侧 **开发态日志索引**见同文档 §4.1「开发态可观测性（扩展日志索引）」。
 */

/** 扩展 ↔ Web bridge 方法名（技术方案 §5.1） */
export const bridgeMethodSchema = z.enum([
  'connect',
  'disconnect',
  'eth_accounts',
  'signMessage',
  'signTypedData',
  'signTransaction',
  'sendTransaction',
  /** inpage → content → background 转发的 JSON-RPC；params 为 { method: string; params?: unknown[] } */
  'eip1193_request'
]);

export type BridgeMethod = z.infer<typeof bridgeMethodSchema>;

/** 与 EIP-1193 风格对齐的错误载荷（仅 code + message + 可选 data） */
export const bridgeErrorPayloadSchema = z.object({
  code: z.union([z.number(), z.string()]),
  message: z.string(),
  data: z.unknown().optional()
});

export type BridgeErrorPayload = z.infer<typeof bridgeErrorPayloadSchema>;

export const bridgeRequestSchema = z.object({
  id: z.string().min(1),
  method: bridgeMethodSchema,
  params: z.unknown().optional()
});

export type BridgeRequest = z.infer<typeof bridgeRequestSchema>;

export const bridgeResponseSchema = z.object({
  id: z.string().min(1),
  result: z.unknown().optional(),
  error: bridgeErrorPayloadSchema.optional()
});

export type BridgeResponse = z.infer<typeof bridgeResponseSchema>;

/** 运行时校验未知输入；校验失败抛 Zod 错误（调用方宜 try/catch 或先 safeParse）。 */
export function parseBridgeRequest(input: unknown): BridgeRequest {
  return bridgeRequestSchema.parse(input);
}

/** 同上，用于解析来自扩展的响应行。 */
export function parseBridgeResponse(input: unknown): BridgeResponse {
  return bridgeResponseSchema.parse(input);
}
