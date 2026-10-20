import {
  authChallengeRequestSchema,
  authVerifyRequestSchema
} from '@plugin/shared';
import type { FastifyPluginAsync } from 'fastify';

import {
  AuthError,
  createAuthChallenge,
  getBearerToken,
  getSessionFromToken,
  revokeSession,
  verifyAuthChallenge
} from '../auth/authService.js';
import {
  authChallengeSchema,
  authLogoutSchema,
  authMeSchema,
  authVerifySchema
} from '../swagger/routeSchemas.js';

/**
 * Auth 路由：challenge → 钱包 personal_sign → verify → Bearer 会话。
 *
 * 调用链：Web `/account` 页；`routes/tx.ts` 复用 Bearer 会话。
 * 安全边界：不接收私钥/助记词；签名只用于一次性 challenge 校验，不落库、不写日志。
 */
const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/v1/auth/challenge',
    { bodyLimit: 4_096, schema: authChallengeSchema },
    async (request, reply) => {
      const parsed = authChallengeRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      try {
        const result = createAuthChallenge({
          ...parsed.data,
          origin: request.headers.origin
        });
        request.log.info(
          { address: parsed.data.address, chainId: parsed.data.chainId },
          'auth_challenge_created'
        );
        return result;
      } catch (e) {
        if (e instanceof AuthError) {
          request.log.warn(
            { statusCode: e.statusCode, code: e.message },
            'auth_challenge_error'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'auth_challenge');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.post(
    '/api/v1/auth/verify',
    { bodyLimit: 8_192, schema: authVerifySchema },
    async (request, reply) => {
      const parsed = authVerifyRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      try {
        const result = await verifyAuthChallenge(parsed.data);
        request.log.info({ address: result.address }, 'auth_session_created');
        return result;
      } catch (e) {
        if (e instanceof AuthError) {
          request.log.warn(
            { statusCode: e.statusCode, code: e.message },
            'auth_verify_error'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'auth_verify');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.get(
    '/api/v1/auth/me',
    { schema: authMeSchema },
    async (request, reply) => {
      const token = getBearerToken(request.headers.authorization);
      const session = token ? getSessionFromToken(token) : null;
      if (!session) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
      return {
        address: session.address,
        chainId: session.chainId,
        expiresAt: new Date(session.expiresAt).toISOString()
      };
    }
  );

  app.post(
    '/api/v1/auth/logout',
    { schema: authLogoutSchema },
    async (request) => {
      const token = getBearerToken(request.headers.authorization);
      if (token) {
        revokeSession(token);
      }
      return { ok: true as const };
    }
  );
};

export default authRoutes;
