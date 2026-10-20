import { txBroadcastRequestSchema } from '@plugin/shared';
import type { FastifyPluginAsync } from 'fastify';

import { getBearerToken, getSessionFromToken } from '../auth/authService.js';
import {
  broadcastEvmTransaction,
  TxBroadcastError
} from '../evm/txBroadcast.js';
import { txBroadcastSchema } from '../swagger/routeSchemas.js';

/**
 * 交易广播路由：登录会话 + 已签名 raw tx → 服务端 RPC。
 *
 * 调用链：Web `/account` 页 → 本路由；签名在扩展内完成，服务端只负责转发。
 * 安全边界：不接收 / 不记录私钥、助记词或明文签名材料；会话地址必须与交易签名者一致。
 */
const txRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/api/v1/tx/broadcast',
    { bodyLimit: 128 * 1024, schema: txBroadcastSchema },
    async (request, reply) => {
      const token = getBearerToken(request.headers.authorization);
      const session = token ? getSessionFromToken(token) : null;
      if (!session) {
        return reply.code(401).send({ error: 'unauthorized' });
      }

      const parsed = txBroadcastRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'invalid_body',
          detail: parsed.error.flatten()
        });
      }

      try {
        const result = await broadcastEvmTransaction({
          ...parsed.data,
          from: session.address
        });
        request.log.info(
          {
            chainId: parsed.data.chainId,
            address: session.address,
            hash: result.hash
          },
          'tx_broadcast'
        );
        return { chainId: parsed.data.chainId, hash: result.hash };
      } catch (e) {
        if (e instanceof TxBroadcastError) {
          request.log.warn(
            {
              statusCode: e.statusCode,
              code: e.message,
              chainId: parsed.data.chainId,
              address: session.address
            },
            'tx_broadcast_error'
          );
          return reply.code(e.statusCode).send({
            error: e.message,
            ...(e.detail ? { detail: e.detail } : {})
          });
        }
        request.log.error({ err: e }, 'tx_broadcast');
        return reply.code(500).send({ error: 'internal_error' });
      }
    }
  );
};

export default txRoutes;
