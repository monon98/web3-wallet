import {
  evmBalanceReaderQueryRequestSchema,
  evmBatchSenderBuildRequestSchema,
  evmExplorerAddressTokenBalancesRequestSchema,
  evmExplorerNativeBalancesRequestSchema
} from '@plugin/shared';
import type { FastifyPluginAsync } from 'fastify';

import { getEtherscanApiKey, getServerRpcUrl } from '../config/chain.js';
import {
  BalanceReaderError,
  hasAnyBalanceReaderAddress,
  runEvmBalanceReaderQuery
} from '../evm/balanceReaderQuery.js';
import {
  BatchSenderError,
  buildBatchSendErc20TransferFrom,
  buildBatchSendEth
} from '../evm/batchSenderBuild.js';
import {
  EtherscanError,
  getAddressTokenHoldingsBatchEtherscan,
  getNativeBalanceEtherscan,
  getNativeBalancesBatchEtherscan
} from '../evm/etherscanV2.js';
import {
  forwardToRpc,
  RpcForwardError,
  validateRpcPayload
} from '../evm/rpcForward.js';
import {
  evmBalanceReaderQuerySchema,
  evmBatchSenderBuildSchema,
  evmExplorerAddressTokenBalancesSchema,
  evmExplorerNativeBalanceSchema,
  evmExplorerNativeBalancesSchema,
  evmRpcForwardSchema,
  evmStatusSchema
} from '../swagger/routeSchemas.js';

const evmGatewayRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/api/v1/evm/explorer/native-balance',
    { schema: evmExplorerNativeBalanceSchema },
    async (request, reply) => {
      const q = request.query as Record<string, unknown>;
      const address = typeof q.address === 'string' ? q.address : undefined;
      const chainIdRaw =
        typeof q.chainId === 'string'
          ? q.chainId
          : typeof q.chainId === 'number'
            ? String(q.chainId)
            : undefined;

      if (!address || chainIdRaw === undefined) {
        request.log.debug('native_balance_missing_query');
        return reply.code(400).send({
          error: 'missing_query',
          detail: 'address and chainId are required'
        });
      }

      const chainId = Number.parseInt(chainIdRaw, 10);
      try {
        request.log.debug({ chainId }, 'native_balance_request');
        const result = await getNativeBalanceEtherscan({ chainId, address });
        return result;
      } catch (e) {
        if (e instanceof EtherscanError) {
          request.log.warn(
            { chainId, statusCode: e.statusCode, err: e },
            'etherscan_client_error'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'etherscan_native_balance');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.post(
    '/api/v1/evm/explorer/native-balances',
    { bodyLimit: 16_384, schema: evmExplorerNativeBalancesSchema },
    async (request, reply) => {
      const parsed = evmExplorerNativeBalancesRequestSchema.safeParse(
        request.body
      );
      if (!parsed.success) {
        request.log.debug(
          { issues: parsed.error.flatten() },
          'native_balances_validation'
        );
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      const { chainId, addresses } = parsed.data;
      try {
        request.log.debug(
          { chainId, count: addresses.length },
          'native_balances_batch'
        );
        const result = await getNativeBalancesBatchEtherscan({
          chainId,
          addresses
        });
        return { chainId, balances: result };
      } catch (e) {
        if (e instanceof EtherscanError) {
          request.log.warn(
            { chainId, statusCode: e.statusCode, err: e },
            'etherscan_native_balances_batch'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'etherscan_native_balances_batch');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.post(
    '/api/v1/evm/balance-reader/query',
    { bodyLimit: 32_768, schema: evmBalanceReaderQuerySchema },
    async (request, reply) => {
      const parsed = evmBalanceReaderQueryRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        request.log.debug(
          { issues: parsed.error.flatten() },
          'balance_reader_query_validation'
        );
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      const { chainId, addresses, tokenAddresses } = parsed.data;
      try {
        request.log.debug(
          {
            chainId,
            accountCount: addresses.length,
            tokenCount: tokenAddresses.length
          },
          'balance_reader_query'
        );
        const result = await runEvmBalanceReaderQuery({
          chainId,
          addresses,
          tokenAddresses
        });
        return result;
      } catch (e) {
        if (e instanceof BalanceReaderError) {
          request.log.warn(
            { chainId, statusCode: e.statusCode, err: e },
            'balance_reader_query_error'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'balance_reader_query');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.post(
    '/api/v1/evm/batch-sender/build',
    { bodyLimit: 262_144, schema: evmBatchSenderBuildSchema },
    async (request, reply) => {
      const parsed = evmBatchSenderBuildRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        request.log.debug(
          { issues: parsed.error.flatten() },
          'batch_sender_build_validation'
        );
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      const body = parsed.data;
      try {
        request.log.debug(
          {
            chainId: body.chainId,
            kind: body.kind,
            count: body.recipients.length
          },
          'batch_sender_build'
        );
        if (body.kind === 'eth') {
          return buildBatchSendEth({
            chainId: body.chainId,
            recipients: body.recipients,
            amountsWei: body.amountsWei
          });
        }
        return buildBatchSendErc20TransferFrom({
          chainId: body.chainId,
          tokenAddress: body.tokenAddress,
          recipients: body.recipients,
          amounts: body.amounts
        });
      } catch (e) {
        if (e instanceof BatchSenderError) {
          request.log.warn(
            { chainId: body.chainId, statusCode: e.statusCode, err: e },
            'batch_sender_build_error'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'batch_sender_build');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.post(
    '/api/v1/evm/explorer/address-token-balances',
    { bodyLimit: 16_384, schema: evmExplorerAddressTokenBalancesSchema },
    async (request, reply) => {
      const parsed = evmExplorerAddressTokenBalancesRequestSchema.safeParse(
        request.body
      );
      if (!parsed.success) {
        request.log.debug(
          { issues: parsed.error.flatten() },
          'address_token_balances_validation'
        );
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      const { chainId, addresses, page, offset } = parsed.data;
      try {
        request.log.debug(
          { chainId, count: addresses.length, page, offset },
          'address_token_balances_batch'
        );
        const items = await getAddressTokenHoldingsBatchEtherscan({
          chainId,
          addresses,
          page,
          offset
        });
        return { chainId, page, offset, items };
      } catch (e) {
        if (e instanceof EtherscanError) {
          request.log.warn(
            { chainId, statusCode: e.statusCode, err: e },
            'etherscan_address_token_balances'
          );
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'etherscan_address_token_balances');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.post(
    '/api/v1/evm/rpc',
    {
      bodyLimit: 262_144,
      schema: evmRpcForwardSchema
    },
    async (request, reply) => {
      const rpcUrl = getServerRpcUrl();
      if (!rpcUrl) {
        request.log.warn('rpc_forward_skipped_not_configured');
        return reply.code(503).send({ error: 'rpc_not_configured' });
      }

      const body = request.body;
      try {
        validateRpcPayload(body);
      } catch (e) {
        if (e instanceof RpcForwardError) {
          request.log.debug({ err: e }, 'rpc_validation_failed');
          return reply.code(e.statusCode).send({ error: e.message });
        }
        throw e;
      }

      if (Array.isArray(body)) {
        request.log.debug({ batchSize: body.length }, 'rpc_forward_batch');
      } else if (
        typeof body === 'object' &&
        body !== null &&
        'method' in body &&
        typeof (body as { method: unknown }).method === 'string'
      ) {
        request.log.debug(
          { method: (body as { method: string }).method },
          'rpc_forward'
        );
      }

      try {
        const result = await forwardToRpc(rpcUrl, body);
        return result;
      } catch (e) {
        if (e instanceof RpcForwardError) {
          request.log.warn({ err: e }, 'rpc_upstream_error');
          return reply.code(e.statusCode).send({ error: e.message });
        }
        request.log.error({ err: e }, 'rpc_forward');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );

  app.get('/api/v1/evm/status', { schema: evmStatusSchema }, async () => ({
    rpc: Boolean(getServerRpcUrl()),
    etherscan: Boolean(getEtherscanApiKey()),
    balanceReaderConfigured: hasAnyBalanceReaderAddress()
  }));
};

export default evmGatewayRoutes;
