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

export const tronExplorerAccountSchema = {
  tags: ['tron-explorer'],
  summary: '单地址账户余额（TRX + TRC-20，TronGrid）',
  querystring: {
    type: 'object',
    required: ['address'],
    properties: {
      address: { type: 'string', description: 'Tron base58 address (T...)' }
    }
  }
} as const;

export const tronExplorerAccountsSchema = {
  tags: ['tron-explorer'],
  summary: '批量账户余额（TronGrid，服务端串行 + 节流）',
  body: {
    type: 'object',
    description: '见 @plugin/shared tronExplorerAccountsRequestSchema'
  }
} as const;

export const tronStatusSchema = {
  tags: ['tron-meta'],
  summary: 'Tron 网关配置探测（API Key / 串行间隔）',
  response: {
    200: {
      type: 'object',
      properties: {
        apiKeyConfigured: { type: 'boolean' },
        minIntervalMs: { type: 'number' }
      }
    }
  }
} as const;

export const btcExplorerAddressSchema = {
  tags: ['btc-explorer'],
  summary: '单地址余额（Esplora）',
  querystring: {
    type: 'object',
    required: ['address'],
    properties: {
      address: {
        type: 'string',
        description: 'Bitcoin mainnet address (1 / 3 / bc1)'
      }
    }
  }
} as const;

export const btcExplorerAddressesSchema = {
  tags: ['btc-explorer'],
  summary: '批量地址余额（Esplora，服务端串行 + 节流）',
  body: {
    type: 'object',
    description: '见 @plugin/shared btcExplorerAddressesRequestSchema'
  }
} as const;

export const btcStatusSchema = {
  tags: ['btc-meta'],
  summary: 'BTC 网关配置探测（自定义端点 / 串行间隔）',
  response: {
    200: {
      type: 'object',
      properties: {
        apiUrlConfigured: { type: 'boolean' },
        minIntervalMs: { type: 'number' }
      }
    }
  }
} as const;

export const authChallengeSchema = {
  tags: ['auth'],
  summary: '创建一次性登录 challenge（SIWE 风格消息）',
  body: {
    type: 'object',
    required: ['address', 'chainId'],
    properties: {
      address: { type: 'string', description: 'EVM 0x address' },
      chainId: { type: 'integer', minimum: 1 }
    }
  }
} as const;

export const authVerifySchema = {
  tags: ['auth'],
  summary: '校验 personal_sign 签名并签发 Bearer 会话',
  body: {
    type: 'object',
    required: ['challengeId', 'address', 'signature'],
    properties: {
      challengeId: { type: 'string' },
      address: { type: 'string' },
      signature: { type: 'string' }
    }
  }
} as const;

export const authMeSchema = {
  tags: ['auth'],
  summary: '读取当前 Bearer 会话',
  response: {
    200: {
      type: 'object',
      properties: {
        address: { type: 'string' },
        chainId: { type: 'integer' },
        expiresAt: { type: 'string' }
      }
    }
  }
} as const;

export const authLogoutSchema = {
  tags: ['auth'],
  summary: '注销 Bearer 会话（幂等）',
  response: {
    200: {
      type: 'object',
      properties: { ok: { type: 'boolean', const: true } },
      required: ['ok']
    }
  }
} as const;

export const txBroadcastSchema = {
  tags: ['tx'],
  summary: '广播已签名 EVM 交易（需 Bearer 会话）',
  body: {
    type: 'object',
    required: ['chainId', 'signedTransaction'],
    properties: {
      chainId: { type: 'integer', minimum: 1 },
      signedTransaction: {
        type: 'string',
        description: '0x-prefixed signed raw transaction'
      }
    }
  },
  response: {
    200: {
      type: 'object',
      properties: {
        chainId: { type: 'integer' },
        hash: { type: 'string' }
      }
    }
  }
} as const;
