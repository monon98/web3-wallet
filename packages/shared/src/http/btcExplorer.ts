import { z } from 'zod';

/** 服务端串行请求 Esplora 的批量地址上限（MVP 与 EVM / Tron explorer 对齐） */
export const BTCEXPLORER_MAX_ADDRESSES_PER_BATCH = 20;

export const btcExplorerAddressesRequestSchema = z.object({
  addresses: z
    .array(z.string())
    .min(1, 'addresses_min_1')
    .max(BTCEXPLORER_MAX_ADDRESSES_PER_BATCH)
});

export type BtcExplorerAddressesRequest = z.infer<
  typeof btcExplorerAddressesRequestSchema
>;
