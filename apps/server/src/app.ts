import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import cors from '@fastify/cors';
import { bridgeMethodSchema } from '@plugin/shared';
import Fastify, {
  type FastifyBaseLogger,
  type FastifyInstance,
  type FastifyServerOptions
} from 'fastify';

import { getEtherscanApiKey, getServerRpcUrl } from './config/chain.js';
import authRoutes from './routes/auth.js';
import balancesRoutes from './routes/balances.js';
import btcGatewayRoutes from './routes/btcGateway.js';
import evmGatewayRoutes from './routes/evmGateway.js';
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
 */

export type BuildAppOptions = {
  logger?: boolean;
  loggerInstance?: FastifyBaseLogger;
  enableSwagger?: boolean;
};

export async function buildApp(
  options: BuildAppOptions = {}
): Promise<FastifyInstance> {
  const baseOptions: FastifyServerOptions = {
    // Fastify 5：`logger` 仅接受配置对；已构造的 Pino 实例用 `loggerInstance`。
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    genReqId: (req: IncomingMessage) => {
      const h = req.headers['x-request-id'];
      return typeof h === 'string' && h.length > 0 ? h : randomUUID();
    }
  };

  const app = options.loggerInstance
    ? Fastify({ ...baseOptions, loggerInstance: options.loggerInstance })
    : Fastify({ ...baseOptions, logger: options.logger ?? false });

  app.addHook('onResponse', (request, reply, done) => {
    const ms = Math.round(reply.elapsedTime);
    request.log.info(
      {
        reqId: request.id,
        type: 'access',
        statusCode: reply.statusCode,
        responseTime: ms
      },
      `${request.method} ${request.url} ${reply.statusCode} ${ms}ms`
    );
    done();
  });

  const enableSwagger = options.enableSwagger ?? isSwaggerDevEnabled();
  if (enableSwagger) {
    await registerSwaggerGenerator(app);
  }

  await app.register(cors, {
    origin: true,
    // Web 通过 Authorization: Bearer 访问 auth / tx；余额查询也会携带可选会话。
    allowedHeaders: ['content-type', 'authorization', 'x-request-id'],
    exposedHeaders: [
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after'
    ]
  });
  await app.register(evmGatewayRoutes);
  await app.register(tronGatewayRoutes);
  await app.register(btcGatewayRoutes);
  await app.register(balancesRoutes);
  await app.register(authRoutes);
  await app.register(txRoutes);

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
