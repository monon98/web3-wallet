/**
 * Fastify `route.schema`，供 `@fastify/swagger` 生成 OpenAPI（仅 dev 注册插件时生效）。
 * 与运行时校验无关；详细 body 仍以各路由内 Zod / 自定义校验为准。
 */

export const healthSchema = {
  tags: ['meta'],
  summary: '存活探针',
  response: {
    200: {
      type: 'object',
      properties: { ok: { type: 'boolean', const: true } },
      required: ['ok']
    }
  }
} as const;

export const metaSchema = {
  tags: ['meta'],
  summary: '服务元数据与 bridge 方法枚举',
  response: {
    200: {
      type: 'object',
      properties: {
        service: { type: 'string' },
        rpcConfigured: { type: 'boolean' },
        etherscanConfigured: { type: 'boolean' },
        bridgeMethods: { type: 'array', items: { type: 'string' } }
      }
    }
  }
} as const;

export const evmExplorerNativeBalanceSchema = {
  tags: ['evm-explorer'],
  summary: '单地址原生币余额（Etherscan V2）',
  querystring: {
    type: 'object',
    required: ['address', 'chainId'],
    properties: {
      address: { type: 'string', description: 'Checksummed or hex address' },
      chainId: { type: 'string', description: 'Decimal chain id' }
    }
  }
} as const;

export const evmExplorerNativeBalancesSchema = {
  tags: ['evm-explorer'],
  summary: '批量原生币余额（Etherscan）',
  body: {
    type: 'object',
    description: '见 @plugin/shared evmExplorerNativeBalancesRequestSchema'
  }
} as const;

export const evmBalanceReaderQuerySchema = {
  tags: ['evm-onchain'],
  summary: '链上 BalanceBatchReader 批量余额（eth_call）',
  body: {
    type: 'object',
    description: '见 @plugin/shared evmBalanceReaderQueryRequestSchema'
  }
} as const;

export const evmBatchSenderBuildSchema = {
  tags: ['evm-onchain'],
  summary: '批量转账 calldata 构造（BatchSender）',
  body: {
    type: 'object',
    description: '见 @plugin/shared evmBatchSenderBuildRequestSchema'
  }
} as const;

export const evmExplorerAddressTokenBalancesSchema = {
  tags: ['evm-explorer'],
  summary: '多地址 ERC-20 持仓（Etherscan PRO）',
  body: {
    type: 'object',
    description:
      '见 @plugin/shared evmExplorerAddressTokenBalancesRequestSchema'
  }
} as const;

export const evmRpcForwardSchema = {
  tags: ['evm-rpc'],
  summary: 'JSON-RPC 转发（方法白名单）；单条对象或 batch 数组',
  body: {
    oneOf: [
      { type: 'object', additionalProperties: true },
      { type: 'array', items: { type: 'object', additionalProperties: true } }
    ]
  }
} as const;

export const evmStatusSchema = {
  tags: ['evm-meta'],
  summary: 'RPC / Etherscan / balance reader 是否已配置',
  response: {
    200: {
      type: 'object',
      properties: {
        rpc: { type: 'boolean' },
        etherscan: { type: 'boolean' },
        balanceReaderConfigured: { type: 'boolean' }
      }
    }
  }
} as const;
