import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { bridgeMethodSchema } from '@plugin/shared';
import Fastify, {
  LogController,
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyServerOptions
} from 'fastify';

import { assertCsrfSecretConfigured } from './auth/csrf.js';
import { assertSessionCookieConfig } from './auth/sessionCookie.js';
import { initializeSessionStore } from './auth/sessionStore.js';
import { getEtherscanApiKey, getServerRpcUrl } from './config/chain.js';
import { isCorsOriginAllowed } from './config/cors.js';
import { recordHttpRequest } from './observability/metrics.js';
import authRoutes from './routes/auth.js';
import balancesRoutes from './routes/balances.js';
import btcGatewayRoutes from './routes/btcGateway.js';
import evmGatewayRoutes from './routes/evmGateway.js';
import metricsRoutes from './routes/metrics.js';
import tronGatewayRoutes from './routes/tronGateway.js';
import txRoutes from './routes/tx.js';
import {
  isSwaggerDevEnabled,
  registerSwaggerGenerator,
  registerSwaggerUi
} from './swagger/devSwagger.js';
import { healthSchema, metaSchema } from './swagger/routeSchemas.js';

/**
 * Fastify 应用组装（不负责监听端口）。
 *
 * `index.ts` 传入生产 logger 并调用 `listen`；测试直接 `buildApp({ logger: false })`
 * 后用 `app.inject` 调用路由。这样余额查询集成测试无需启动真实端口或外部网络。
 *
 * 安全边界：
 * - CORS 只放行 `SERVER_CORS_ORIGINS`（开发默认 localhost:3000），并允许凭据；
 * - 浏览器会话走 HttpOnly Cookie + CSRF，API 客户端仍可用 Bearer；
 * - 所有响应补基础安全头；access log 只记录路由模板，不记录查询串中的地址；
 * - `SERVER_TRUST_PROXY=1` 时才信任 `X-Forwarded-For`，避免客户端伪造限流 IP。
 */

export type BuildAppOptions = {
  logger?: boolean;
  loggerInstance?: FastifyBaseLogger;
  enableSwagger?: boolean;
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

function resolveRequestId(req: IncomingMessage): string {
  const header = req.headers['x-request-id'];
  if (typeof header === 'string' && REQUEST_ID_PATTERN.test(header)) {
    return header;
  }
  return randomUUID();
}

export async function buildApp(
  options: BuildAppOptions = {}
): Promise<FastifyInstance> {
  const baseOptions: FastifyServerOptions = {
    // Fastify 5：`logger` 仅接受配置对；已构造的 Pino 实例用 `loggerInstance`。
    logController: new LogController({ disableRequestLogging: true }),
    requestIdHeader: 'x-request-id',
    genReqId: resolveRequestId,
    trustProxy:
      process.env.SERVER_TRUST_PROXY === '1' ||
      process.env.SERVER_TRUST_PROXY === 'true'
  };

  const app = options.loggerInstance
    ? Fastify({ ...baseOptions, loggerInstance: options.loggerInstance })
    : Fastify({ ...baseOptions, logger: options.logger ?? false });

  // P4-5：生产环境缺 SESSION_SECRET / Cookie 配置无效时直接启动失败；
  // 会话文件在启动阶段写入一次，避免运行中才发现目录不可写。
  assertCsrfSecretConfigured();
  assertSessionCookieConfig();
  initializeSessionStore();

  await app.register(cookie);

  // API 响应不主动内嵌、不嗅探 MIME；Swagger UI 仍可在开发态独立打开。
  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
    reply.header(
      'permissions-policy',
      'camera=(), microphone=(), geolocation=()'
    );
    return payload;
  });

  app.addHook('onResponse', (request, reply, done) => {
    const ms = Math.round(reply.elapsedTime);
    // 使用路由模板而非原始 URL，避免把地址查询串写进访问日志和指标标签。
    const route = request.routeOptions.url ?? 'unmatched';
    recordHttpRequest({
      method: request.method,
      route,
      statusCode: reply.statusCode,
      durationMs: reply.elapsedTime
    });
    request.log.info(
      {
        reqId: request.id,
        type: 'access',
        statusCode: reply.statusCode,
        responseTime: ms
      },
      `${request.method} ${route} ${reply.statusCode} ${ms}ms`
    );
    done();
  });

  const enableSwagger = options.enableSwagger ?? isSwaggerDevEnabled();
  if (enableSwagger) {
    await registerSwaggerGenerator(app);
  }

  await app.register(cors, {
    // 不回显任意 Origin；未配置白名单时不产生 CORS 放行头。
    origin: (origin, cb) => {
      cb(null, !origin || isCorsOriginAllowed(origin));
    },
    // P4-5：浏览器用 HttpOnly Cookie 会话；必须允许 credentials 且不能使用 `*`。
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-request-id',
      'x-csrf-token'
    ],
    exposedHeaders: [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after'
    ],
    maxAge: 600
  });
  await app.register(evmGatewayRoutes);
  await app.register(tronGatewayRoutes);
  await app.register(btcGatewayRoutes);
  await app.register(balancesRoutes);
  await app.register(authRoutes);
  await app.register(txRoutes);
  await app.register(metricsRoutes);

  app.get('/health', { schema: healthSchema }, async () => ({
    ok: true as const
  }));

  app.get('/api/v1/meta', { schema: metaSchema }, async () => ({
    service: '@plugin/server',
    rpcConfigured: Boolean(getServerRpcUrl()),
    etherscanConfigured: Boolean(getEtherscanApiKey()),
    bridgeMethods: bridgeMethodSchema.options
  }));

  if (enableSwagger) {
    await registerSwaggerUi(app);
  }

  return app;
}
