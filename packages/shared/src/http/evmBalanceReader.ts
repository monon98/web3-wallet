import { z } from 'zod';

/** 单次查询允许的 ERC-20 合约数量上限 */
export const EVM_BALANCE_READER_MAX_TOKENS = 10;

/** 仅查原生币（`tokenAddresses` 为空）时，`addresses` 上限 */
export const EVM_BALANCE_READER_MAX_ACCOUNTS_NATIVE_ONLY = 300;

/** 带 ERC-20 时，`addresses` 的绝对上限（与 `EVM_BALANCE_READER_MAX_PAIRS` 共同约束） */
export const EVM_BALANCE_READER_MAX_ACCOUNTS_WITH_TOKENS = 200;

/** `(地址数 × 代币数)` 上限，控制单次 `eth_call` 规模 */
export const EVM_BALANCE_READER_MAX_PAIRS = 1000;

/**
 * 在给定代币个数下，允许的最多地址数（阶梯）：`min(MAX_ACCOUNTS_WITH_TOKENS, floor(MAX_PAIRS / t))`。
 * `t === 0` 时请用 {@link EVM_BALANCE_READER_MAX_ACCOUNTS_NATIVE_ONLY}。
 */
export function evmBalanceReaderMaxAccountsForTokenCount(
  tokenCount: number
): number {
  if (tokenCount <= 0) {
    return EVM_BALANCE_READER_MAX_ACCOUNTS_NATIVE_ONLY;
  }
  const byPairs = Math.floor(EVM_BALANCE_READER_MAX_PAIRS / tokenCount);
  return Math.min(EVM_BALANCE_READER_MAX_ACCOUNTS_WITH_TOKENS, byPairs);
}

export const evmBalanceReaderQueryRequestSchema = z
  .object({
    chainId: z.number().int().positive(),
    addresses: z.array(z.string()).min(1, 'addresses_min_1'),
    tokenAddresses: z
      .array(z.string())
      .max(EVM_BALANCE_READER_MAX_TOKENS)
      .default([])
  })
  .superRefine((data, ctx) => {
    const t = data.tokenAddresses.length;
    const n = data.addresses.length;

    if (t === 0) {
      if (n > EVM_BALANCE_READER_MAX_ACCOUNTS_NATIVE_ONLY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `addresses_max_${EVM_BALANCE_READER_MAX_ACCOUNTS_NATIVE_ONLY}_native_only`
        });
      }
      return;
    }

    const maxAddr = evmBalanceReaderMaxAccountsForTokenCount(t);
    if (n > maxAddr) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `addresses_max_${maxAddr}_for_${t}_tokens`
      });
    }
  });

export type EvmBalanceReaderQueryRequest = z.infer<
  typeof evmBalanceReaderQueryRequestSchema
>;
