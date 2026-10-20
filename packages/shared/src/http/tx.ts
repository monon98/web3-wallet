import { z } from 'zod';

/** POST /api/v1/tx/broadcast — 仅已签名序列化交易，不含私钥 */
export const txBroadcastRequestSchema = z.object({
  chainId: z.number().int().positive(),
  /** 0x 前缀的已签名 raw transaction */
  signedTransaction: z.string().regex(/^0x[0-9a-fA-F]+$/)
});

export type TxBroadcastRequest = z.infer<typeof txBroadcastRequestSchema>;

export const txBroadcastResponseSchema = z.object({
  chainId: z.number().int().positive(),
  hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/)
});

export type TxBroadcastResponse = z.infer<typeof txBroadcastResponseSchema>;
