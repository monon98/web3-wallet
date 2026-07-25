import { z } from 'zod';

/** POST /auth/challenge */
export const authChallengeResponseSchema = z.object({
  challengeId: z.string().min(1),
  /** SIWE 文本或待 personal_sign 的消息 */
  message: z.string().min(1)
});

export type AuthChallengeResponse = z.infer<typeof authChallengeResponseSchema>;

/** POST /auth/verify */
export const authVerifyRequestSchema = z.object({
  challengeId: z.string().min(1),
  address: z.string().min(1),
  signature: z.string().min(1)
});

export type AuthVerifyRequest = z.infer<typeof authVerifyRequestSchema>;

/** GET /me（示例形状，业务字段后续扩展） */
export const meResponseSchema = z.object({
  address: z.string().min(1).optional()
});

export type MeResponse = z.infer<typeof meResponseSchema>;
