import { btcExplorerAddressesRequestSchema } from '@plugin/shared';
import type { FastifyPluginAsync } from 'fastify';

import { isBtcMainnetAddress } from '../btc/btcAddress.js';
import {
  EsploraError,
  getBtcAddressBalance,
  getBtcAddressBalancesBatch,
  getBtcMinIntervalMs
} from '../btc/esplora.js';
import {
  btcExplorerAddressesSchema,
  btcExplorerAddressSchema,
  btcStatusSchema
} from '../swagger/routeSchemas.js';

/**
 * BTC 只读网关（Esplora）。
 *
 * 路由：`GET /api/v1/btc/status`、`GET /api/v1/btc/explorer/address`、
 * `POST /api/v1/btc/explorer/addresses`（单次 ≤ 20，串行 + 节流）。
 * 契约（批量请求体）以 `@plugin/shared` 的 `btcExplorerAddressesRequestSchema` 为准。
 */
const btcGatewayRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/v1/btc/explorer/address',
    { schema: btcExplorerAddressSchema },
    async (request, reply) => {
      const q = request.query as Record<string, unknown>;
      const address = typeof q.address === 'string' ? q.address.trim() : '';

      if (!address) {
        request.log.debug('btc_address_missing_query');
        return reply.code(400).send({
          error: 'missing_query',
          detail: 'address is required'
        });
      }

      if (!isBtcMainnetAddress(address)) {
        request.log.debug({ address }, 'btc_address_invalid_address');
        return reply.code(400).send({ error: 'invalid_address' });
      }

      try {
        request.log.debug({ address }, 'btc_address_request');
        return await getBtcAddressBalance(address);
      } catch (e) {
        if (e instanceof EsploraError) {
          request.log.warn(
            { address, statusCode: e.statusCode, err: e },
            'esplora_client_error'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'btc_address_balance');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.post(
    '/api/v1/btc/explorer/addresses',
    { bodyLimit: 16_384, schema: btcExplorerAddressesSchema },
    async (request, reply) => {
      const parsed = btcExplorerAddressesRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        request.log.debug(
          { issues: parsed.error.flatten() },
          'btc_addresses_validation'
        );
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      const addresses = parsed.data.addresses.map((a) => a.trim());
      try {
        request.log.debug({ count: addresses.length }, 'btc_addresses_batch');
        const result = await getBtcAddressBalancesBatch(addresses);
        return { addresses: result };
      } catch (e) {
        if (e instanceof EsploraError) {
          request.log.warn(
            { statusCode: e.statusCode, err: e },
            'esplora_addresses_batch'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'btc_addresses_batch');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.get('/api/v1/btc/status', { schema: btcStatusSchema }, async () => ({
    apiUrlConfigured: Boolean(process.env.SERVER_BTC_API_URL?.trim()),
    minIntervalMs: getBtcMinIntervalMs()
  }));
};

export default btcGatewayRoutes;
