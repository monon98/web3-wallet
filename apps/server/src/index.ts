import './loadEnv.js';

import { buildApp } from './app.js';
import { createRootLogger } from './config/logger.js';

const port = Number(process.env.SERVER_PORT ?? '8787');
// 默认仅绑定本机，避免 0.0.0.0 时 Fastify 对每个网卡各打一行 listening；局域网访问请设 SERVER_HOST=0.0.0.0
const host = process.env.SERVER_HOST ?? '127.0.0.1';

const rootLogger = createRootLogger();

async function main(): Promise<void> {
  const app = await buildApp({ loggerInstance: rootLogger });

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
