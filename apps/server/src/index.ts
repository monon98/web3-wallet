import './loadEnv.js';

import { randomUUID } from 'node:crypto';
import cors from '@fastify/cors';
import { bridgeMethodSchema } from '@plugin/shared';
import Fastify from 'fastify';

import { getEtherscanApiKey, getServerRpcUrl } from './config/chain.js';
import { createRootLogger } from './config/logger.js';
import authRoutes from './routes/auth.js';
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

const port = Number(process.env.SERVER_PORT ?? '8787');
// 默认仅绑定本机，避免 0.0.0.0 时 Fastify 对每个网卡各打一行 listening；局域网访问请设 SERVER_HOST=0.0.0.0
const host = process.env.SERVER_HOST ?? '127.0.0.1';

const rootLogger = createRootLogger();

async function main(): Promise<void> {
  const app = Fastify({
    // Fastify 5：`logger` 仅接受配置对象；已构造的 Pino 实例用 `loggerInstance`。
    loggerInstance: rootLogger,
    disableRequestLogging: true,
    requestIdHeader: 'x-request-id',
    genReqId: (req) => {
      const h = req.headers['x-request-id'];
      return typeof h === 'string' && h.length > 0 ? h : randomUUID();
    }
  });

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

  if (isSwaggerDevEnabled()) {
    await registerSwaggerGenerator(app);
  }

  await app.register(cors, {
    origin: true,
    // Web 通过 Authorization: Bearer 访问 auth/tx；显式放行预检请求头。
    allowedHeaders: ['content-type', 'authorization', 'x-request-id']
  });
  await app.register(evmGatewayRoutes);
  await app.register(tronGatewayRoutes);
  await app.register(btcGatewayRoutes);
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

  if (isSwaggerDevEnabled()) {
    await registerSwaggerUi(app);
  }

  await app.listen({
    port,
    host,
    listenTextResolver: (addr) => `listening ${addr}`
  });
}

main().catch((err) => {
  rootLogger.fatal({ err }, 'server_failed');
  process.exit(1);
});
