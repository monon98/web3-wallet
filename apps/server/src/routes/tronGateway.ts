import { tronExplorerAccountsRequestSchema } from '@plugin/shared';
import type { FastifyPluginAsync } from 'fastify';

import { getTronApiKey } from '../config/chain.js';
import {
  tronExplorerAccountSchema,
  tronExplorerAccountsSchema,
  tronStatusSchema
} from '../swagger/routeSchemas.js';
import { isTronBase58Address } from '../tron/tronAddress.js';
import {
  getTronAccountBalances,
  getTronAccountBalancesBatch,
  getTronMinIntervalMs,
  TronGridError
} from '../tron/tronGrid.js';

const tronGatewayRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/v1/tron/explorer/account',
    { schema: tronExplorerAccountSchema },
    async (request, reply) => {
      const q = request.query as Record<string, unknown>;
      const address = typeof q.address === 'string' ? q.address.trim() : '';

      if (!address) {
        request.log.debug('tron_account_missing_query');
        return reply.code(400).send({
          error: 'missing_query',
          detail: 'address is required'
        });
      }

      if (!isTronBase58Address(address)) {
        request.log.debug({ address }, 'tron_account_invalid_address');
        return reply.code(400).send({ error: 'invalid_address' });
      }

      try {
        request.log.debug({ address }, 'tron_account_request');
        return await getTronAccountBalances(address);
      } catch (e) {
        if (e instanceof TronGridError) {
          request.log.warn(
            { address, statusCode: e.statusCode, err: e },
            'tron_grid_client_error'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'tron_account_balance');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.post(
    '/api/v1/tron/explorer/accounts',
    { bodyLimit: 16_384, schema: tronExplorerAccountsSchema },
    async (request, reply) => {
      const parsed = tronExplorerAccountsRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        request.log.debug(
          { issues: parsed.error.flatten() },
          'tron_accounts_validation'
        );
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      const addresses = parsed.data.addresses.map((a) => a.trim());
      try {
        request.log.debug({ count: addresses.length }, 'tron_accounts_batch');
        const result = await getTronAccountBalancesBatch(addresses);
        return { accounts: result };
      } catch (e) {
        if (e instanceof TronGridError) {
          request.log.warn(
            { statusCode: e.statusCode, err: e },
            'tron_grid_accounts_batch'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'tron_accounts_batch');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.get('/api/v1/tron/status', { schema: tronStatusSchema }, async () => ({
    apiKeyConfigured: Boolean(getTronApiKey()),
    minIntervalMs: getTronMinIntervalMs()
  }));
};

export default tronGatewayRoutes;
