import {
  BALANCE_FAMILIES,
  BALANCE_MAX_ADDRESSES_PER_CHAIN,
  balanceQueryRequestSchema
} from '@plugin/shared';
import type { FastifyPluginAsync } from 'fastify';

import { getBearerToken } from '../auth/authService.js';
import { getRequestAuth } from '../auth/sessionAuth.js';
import {
  clearSessionCookie,
  getSessionCookieToken
} from '../auth/sessionCookie.js';
import { getBalanceCacheOptions } from '../balances/balanceCache.js';
import {
  BalanceQueryServiceError,
  runBalanceQuery
} from '../balances/queryBalances.js';
import { getBalanceRateLimits } from '../balances/rateLimit.js';
import {
  getEtherscanApiKey,
  getServerRpcUrl,
  getTronApiKey
} from '../config/chain.js';
import {
  getEtherscanCooldownRemainingMs,
  getEtherscanTokenCacheStaleTtlMs,
  getEtherscanTokenCacheTtlMs
} from '../evm/etherscanV2.js';
import {
  consumeRateLimit,
  setRateLimitHeaders
} from '../security/rateLimit.js';
import {
  balancesQuerySchema,
  balancesStatusSchema
} from '../swagger/routeSchemas.js';

/**
 * 统一多链余额查询路由。
 *
 * - `POST /api/v1/balances/query`：EVM / Tron / BTC 统一编排；登录可选，登录后限额更高。
 * - `GET /api/v1/balances/status`：限额、缓存与上游配置探测（不含密钥）。
 * 会话：浏览器 HttpOnly Cookie 或 Bearer；本接口只读，不要求 CSRF 头。
 * 安全边界：只接收公开地址，不接触私钥 / 助记词；日志只记录数量、耗时与状态。
 */

const balancesRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/v1/balances/query',
    { bodyLimit: 64 * 1024, schema: balancesQuerySchema },
    async (request, reply) => {
      const cookieToken = getSessionCookieToken(request);
      const requestAuth = getRequestAuth(request);
      const bearerToken = getBearerToken(request.headers.authorization);
      if (!requestAuth) {
        // 过期 Cookie 不阻塞匿名查询：清掉后按匿名限额继续；无效 Bearer 仍返回 401。
        if (cookieToken) {
          clearSessionCookie(reply);
        }
        if (bearerToken) {
          return reply.code(401).send({ error: 'unauthorized' });
        }
      }

      const session = requestAuth?.session;
      const auth = session ? 'session' : 'anonymous';
      const limits = getBalanceRateLimits();
      const limit =
        auth === 'session'
          ? limits.sessionPerMinute
          : limits.anonymousPerMinute;
      const rateKey = `balances:${auth}:${
        session ? session.address : request.ip
      }`;
      const rate = consumeRateLimit(rateKey, limit);
      setRateLimitHeaders(reply, rate);

      if (!rate.allowed) {
        reply.header(
          'retry-after',
          String(Math.ceil(rate.retryAfterMs / 1000))
        );
        request.log.warn(
          { auth, limit, retryAfterMs: rate.retryAfterMs },
          'balances_rate_limited'
        );
        return reply.code(429).send({
          error: 'rate_limited',
          retryAfterMs: rate.retryAfterMs
        });
      }

      const parsed = balanceQueryRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      try {
        const result = await runBalanceQuery(parsed.data, { auth });
        request.log.info(
          {
            requestId: result.requestId,
            auth,
            partial: result.partial,
            durationMs: result.durationMs,
            evmCached: result.evm?.meta.cached,
            tronCached: result.tron?.meta.cached,
            btcCached: result.btc?.meta.cached
          },
          'balances_query'
        );
        return result;
      } catch (e) {
        if (e instanceof BalanceQueryServiceError) {
          request.log.warn(
            { statusCode: e.statusCode, code: e.message },
            'balances_query_invalid'
          );
          return reply.code(e.statusCode).send({
            error: e.message,
            ...(e.detail ? { detail: e.detail } : {})
          });
        }
        request.log.error({ err: e }, 'balances_query');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.get(
    '/api/v1/balances/status',
    { schema: balancesStatusSchema },
    async () => {
      const cache = getBalanceCacheOptions();
      const limits = getBalanceRateLimits();
      return {
        families: BALANCE_FAMILIES,
        maxAddressesPerChain: BALANCE_MAX_ADDRESSES_PER_CHAIN,
        cache: {
          ttlMs: cache.ttlMs,
          staleTtlMs: cache.staleTtlMs,
          etherscanTokenTtlMs: getEtherscanTokenCacheTtlMs(),
          etherscanTokenStaleTtlMs: getEtherscanTokenCacheStaleTtlMs()
        },
        rateLimit: limits,
        upstream: {
          rpcConfigured: Boolean(getServerRpcUrl()),
          etherscanConfigured: Boolean(getEtherscanApiKey()),
          etherscanCooldownRemainingMs: getEtherscanCooldownRemainingMs(),
          tronApiKeyConfigured: Boolean(getTronApiKey()),
          btcApiUrlConfigured: Boolean(process.env.SERVER_BTC_API_URL?.trim())
        }
      };
    }
  );
};

export default balancesRoutes;
