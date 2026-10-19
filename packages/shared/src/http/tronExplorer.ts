import { z } from 'zod';

/** 服务端串行请求 TronGrid 的批量地址上限（公共额度受限，MVP 与 EVM explorer 对齐） */
export const TRONEXPLORER_MAX_ADDRESSES_PER_BATCH = 20;

export const tronExplorerAccountsRequestSchema = z.object({
  addresses: z
    .array(z.string())
    .min(1, 'addresses_min_1')
    .max(TRONEXPLORER_MAX_ADDRESSES_PER_BATCH)
});

export type TronExplorerAccountsRequest = z.infer<
  typeof tronExplorerAccountsRequestSchema
>;
