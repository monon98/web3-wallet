import { z } from 'zod';

/** 与 [Etherscan balance](https://docs.etherscan.io/api-reference/endpoint/balance) 单请求地址上限一致 */
export const EVEXPLORER_MAX_ADDRESSES_PER_BATCH = 20;

export const evmExplorerNativeBalancesRequestSchema = z.object({
  chainId: z.number().int().positive(),
  addresses: z
    .array(z.string())
    .min(1, 'addresses_min_1')
    .max(EVEXPLORER_MAX_ADDRESSES_PER_BATCH)
});

export type EvmExplorerNativeBalancesRequest = z.infer<
  typeof evmExplorerNativeBalancesRequestSchema
>;

/** [addresstokenbalance](https://docs.etherscan.io/api-reference/endpoint/addresstokenbalance) 为单地址；服务端按地址顺序串行请求并限流 */
export const evmExplorerAddressTokenBalancesRequestSchema = z.object({
  chainId: z.number().int().positive(),
  addresses: z
    .array(z.string())
    .min(1, 'addresses_min_1')
    .max(EVEXPLORER_MAX_ADDRESSES_PER_BATCH),
  page: z.number().int().positive().optional().default(1),
  offset: z.number().int().positive().max(1000).optional().default(100)
});

export type EvmExplorerAddressTokenBalancesRequest = z.infer<
  typeof evmExplorerAddressTokenBalancesRequestSchema
>;
