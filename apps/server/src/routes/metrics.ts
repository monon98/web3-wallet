import { timingSafeEqual } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';

import { getEtherscanApiKey, getServerRpcUrl } from '../config/chain.js';
import { getMetricsToken } from '../config/metrics.js';
import { getEtherscanCooldownRemainingMs } from '../evm/etherscanV2.js';
import { renderPrometheusMetrics } from '../observability/prometheusText.js';

/**
 * P4-4 Prometheus 抓取端点。
 *
 * 只有设置 `SERVER_METRICS_TOKEN` 时才启用；请求必须带
 * `Authorization: Bearer <token>`。未设置 token 时返回 404，避免默认暴露
 * 进程内部计数。响应不含地址、RPC URL、API Key 或请求内容。
 */
function readBearerToken(header: string | undefined): string | undefined {
  const match = /^Bearer\s+(.+)$/i.exec(header?.trim() ?? '');
  const token = match?.[1]?.trim();
  return token || undefined;
}

function tokenMatches(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

const metricsRoutes: FastifyPluginAsync = async (app) => {
  app.get('/metrics', { schema: { hide: true } }, async (request, reply) => {
    reply.header('cache-control', 'no-store');

    const token = getMetricsToken();
    if (!token) {
      return reply.code(404).send({ error: 'not_found' });
    }

    const provided = readBearerToken(request.headers.authorization);
    if (!provided || !tokenMatches(provided, token)) {
      reply.header('www-authenticate', 'Bearer realm="metrics"');
      return reply.code(401).send({ error: 'unauthorized' });
    }

    return reply.type('text/plain; version=0.0.4; charset=utf-8').send(
      renderPrometheusMetrics({
        configured: {
          rpc: Boolean(getServerRpcUrl()),
          etherscan: Boolean(getEtherscanApiKey()),
          trongrid: true,
          esplora: true
        },
        cooldownRemainingMs: {
          etherscan: getEtherscanCooldownRemainingMs()
        }
      })
    );
  });
};

export default metricsRoutes;
