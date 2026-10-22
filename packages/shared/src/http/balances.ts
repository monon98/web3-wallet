import { z } from 'zod';

/**
 * 统一多链余额查询契约（`POST /api/v1/balances/query`）。
 *
 * 设计要点：
 * - 一次请求最多查询 EVM / Tron / BTC 三组，每组最多 20 个地址；
 * - 单条链失败不阻断其它链，响应以 `errors` + `partial` 表达部分失败；
 * - 地址格式由服务端按链校验，Web 侧只做基础格式与去重提示。
 */

export const BALANCE_MAX_ADDRESSES_PER_CHAIN = 20;

export const BALANCE_FAMILIES = ['evm', 'tron', 'btc'] as const;

export const balanceFamilySchema = z.enum(BALANCE_FAMILIES);

export type BalanceFamily = z.infer<typeof balanceFamilySchema>;

const addressListSchema = z
  .array(z.string().trim().min(1))
  .min(1, 'addresses_min_1')
  .max(
    BALANCE_MAX_ADDRESSES_PER_CHAIN,
    `addresses_max_${BALANCE_MAX_ADDRESSES_PER_CHAIN}`
  );

export const balanceQueryEvmRequestSchema = z.object({
  chainId: z.number().int().positive(),
  addresses: addressListSchema,
  /** 是否查询 ERC-20 持仓；关闭后只返回原生币余额 */
  includeTokens: z.boolean().optional().default(true)
});

export const balanceQueryTronRequestSchema = z.object({
  addresses: addressListSchema,
  /** 是否查询 TRC-20 持仓；关闭后只返回 TRX 余额 */
  includeTokens: z.boolean().optional().default(true)
});

export const balanceQueryBtcRequestSchema = z.object({
  addresses: addressListSchema
});

export const balanceQueryRequestSchema = z
  .object({
    evm: balanceQueryEvmRequestSchema.optional(),
    tron: balanceQueryTronRequestSchema.optional(),
    btc: balanceQueryBtcRequestSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (!value.evm && !value.tron && !value.btc) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'at_least_one_family',
        path: []
      });
    }
  });

export type BalanceQueryRequest = z.infer<typeof balanceQueryRequestSchema>;
export type BalanceQueryRequestInput = z.input<
  typeof balanceQueryRequestSchema
>;

export const balanceTokenHoldingSchema = z.object({
  tokenAddress: z.string().min(1),
  tokenName: z.string(),
  tokenSymbol: z.string(),
  /** 原始数量（未除 divisor） */
  tokenQuantity: z.string().regex(/^\d+$/),
  tokenDivisor: z.string().regex(/^\d+$/),
  tokenPriceUsd: z.string().optional()
});

export type BalanceTokenHolding = z.infer<typeof balanceTokenHoldingSchema>;

export const balanceCacheMetaSchema = z.object({
  /** 是否来自服务端缓存（fresh 或 stale） */
  cached: z.boolean(),
  /** 缓存写入距今毫秒数 */
  cacheAgeMs: z.number().int().nonnegative().optional(),
  /** 上游失败时回退到过期缓存 */
  stale: z.boolean().optional()
});

export type BalanceCacheMeta = z.infer<typeof balanceCacheMetaSchema>;

export const evmBalanceRowSchema = z.object({
  address: z.string().min(1),
  /** 原生币余额，wei 十进制字符串 */
  balanceWei: z.string().regex(/^\d+$/),
  /** `includeTokens=false` 时省略；查询失败时为空数组并带 tokenError */
  tokens: z.array(balanceTokenHoldingSchema).optional(),
  tokenError: z.string().optional(),
  tokenCachedAt: z.string().optional(),
  tokenStale: z.boolean().optional(),
  tokenRetryAfterMs: z.number().int().nonnegative().optional()
});

export const evmBalanceResultSchema = z.object({
  chainId: z.number().int().positive(),
  source: z.enum(['rpc', 'etherscan']),
  meta: balanceCacheMetaSchema,
  rows: z.array(evmBalanceRowSchema)
});

export type EvmBalanceResult = z.infer<typeof evmBalanceResultSchema>;

export const tronBalanceRowSchema = z.object({
  address: z.string().min(1),
  /** TRX 余额（sun） */
  balanceSun: z.string().regex(/^\d+$/),
  trc20: z.array(
    z.object({
      contractAddress: z.string().min(1),
      balanceRaw: z.string().regex(/^\d+$/)
    })
  ),
  error: z.string().optional()
});

export const tronBalanceResultSchema = z.object({
  meta: balanceCacheMetaSchema,
  accounts: z.array(tronBalanceRowSchema)
});

export type TronBalanceResult = z.infer<typeof tronBalanceResultSchema>;

export const btcBalanceRowSchema = z.object({
  address: z.string().min(1),
  balanceSat: z.string().regex(/^\d+$/),
  mempoolBalanceSat: z.string().regex(/^-?\d+$/),
  txCount: z.number().int().nonnegative(),
  error: z.string().optional()
});

export const btcBalanceResultSchema = z.object({
  meta: balanceCacheMetaSchema,
  addresses: z.array(btcBalanceRowSchema)
});

export type BtcBalanceResult = z.infer<typeof btcBalanceResultSchema>;

export const balanceQueryErrorSchema = z.object({
  family: balanceFamilySchema,
  code: z.string().min(1),
  message: z.string().min(1),
  /** 上游冷却 / 限流时建议的客户端等待时间 */
  retryAfterMs: z.number().int().nonnegative().optional()
});

export type BalanceQueryError = z.infer<typeof balanceQueryErrorSchema>;

export const balanceQueryResponseSchema = z.object({
  requestId: z.string().min(1),
  partial: z.boolean(),
  durationMs: z.number().int().nonnegative(),
  auth: z.enum(['anonymous', 'session']),
  evm: evmBalanceResultSchema.optional(),
  tron: tronBalanceResultSchema.optional(),
  btc: btcBalanceResultSchema.optional(),
  errors: z.array(balanceQueryErrorSchema)
});

export type BalanceQueryResponse = z.infer<typeof balanceQueryResponseSchema>;

export const balanceStatusResponseSchema = z.object({
  families: z.array(balanceFamilySchema),
  maxAddressesPerChain: z.number().int().positive(),
  cache: z.object({
    ttlMs: z.number().int().nonnegative(),
    staleTtlMs: z.number().int().nonnegative(),
    etherscanTokenTtlMs: z.number().int().nonnegative(),
    etherscanTokenStaleTtlMs: z.number().int().nonnegative()
  }),
  rateLimit: z.object({
    anonymousPerMinute: z.number().int().positive(),
    sessionPerMinute: z.number().int().positive()
  }),
  upstream: z.object({
    rpcConfigured: z.boolean(),
    etherscanConfigured: z.boolean(),
    etherscanCooldownRemainingMs: z.number().int().nonnegative(),
    tronApiKeyConfigured: z.boolean(),
    btcApiUrlConfigured: z.boolean()
  })
});

export type BalanceStatusResponse = z.infer<typeof balanceStatusResponseSchema>;
