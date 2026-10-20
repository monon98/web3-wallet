import { z } from 'zod';

/** POST /api/v1/auth/challenge */
export const authChallengeRequestSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'invalid EVM address'),
  chainId: z.number().int().positive()
});

export type AuthChallengeRequest = z.infer<typeof authChallengeRequestSchema>;

export const authChallengeResponseSchema = z.object({
  challengeId: z.string().min(1),
  /** SIWE 风格文本或待 personal_sign 的消息 */
  message: z.string().min(1),
  expiresAt: z.string().min(1)
});

export type AuthChallengeResponse = z.infer<typeof authChallengeResponseSchema>;

/** POST /api/v1/auth/verify */
export const authVerifyRequestSchema = z.object({
  challengeId: z.string().min(1),
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'invalid EVM address'),
  signature: z.string().min(1)
});

export type AuthVerifyRequest = z.infer<typeof authVerifyRequestSchema>;

export const authVerifyResponseSchema = z.object({
  address: z.string().min(1),
  sessionToken: z.string().min(1),
  expiresAt: z.string().min(1)
});

export type AuthVerifyResponse = z.infer<typeof authVerifyResponseSchema>;

/** GET /api/v1/auth/me（示例形状，业务字段后续扩展） */
export const meResponseSchema = z.object({
  address: z.string().min(1).optional(),
  chainId: z.number().int().positive().optional(),
  expiresAt: z.string().min(1).optional()
});

export type MeResponse = z.infer<typeof meResponseSchema>;

/** POST /api/v1/auth/logout */
export const authLogoutResponseSchema = z.object({
  ok: z.literal(true)
});

export type AuthLogoutResponse = z.infer<typeof authLogoutResponseSchema>;
