import { z } from 'zod';

export const EVM_BATCH_SENDER_MAX_RECIPIENTS = 200;

export const evmBatchSendEthRequestSchema = z.object({
  chainId: z.number().int().positive(),
  /** 部署的 `BatchSender` 合约地址（`packages/contracts/src/evm/BatchSender.sol`；由服务端/前端配置提供） */
  batchSenderAddress: z.string(),
  recipients: z.array(z.string()).min(1).max(EVM_BATCH_SENDER_MAX_RECIPIENTS),
  /** wei 十进制字符串 */
  amountsWei: z.array(z.string()).min(1).max(EVM_BATCH_SENDER_MAX_RECIPIENTS)
});

export type EvmBatchSendEthRequest = z.infer<
  typeof evmBatchSendEthRequestSchema
>;

export const evmBatchSendErc20RequestSchema = z.object({
  chainId: z.number().int().positive(),
  batchSenderAddress: z.string(),
  tokenAddress: z.string(),
  recipients: z.array(z.string()).min(1).max(EVM_BATCH_SENDER_MAX_RECIPIENTS),
  /** token 最小单位十进制字符串（未除 decimals） */
  amounts: z.array(z.string()).min(1).max(EVM_BATCH_SENDER_MAX_RECIPIENTS)
});

export type EvmBatchSendErc20Request = z.infer<
  typeof evmBatchSendErc20RequestSchema
>;

export type EvmBatchSenderBuildKind = 'eth' | 'erc20_transferFrom';

export const evmBatchSenderBuildRequestSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('eth'),
    chainId: z.number().int().positive(),
    recipients: z.array(z.string()).min(1).max(EVM_BATCH_SENDER_MAX_RECIPIENTS),
    amountsWei: z.array(z.string()).min(1).max(EVM_BATCH_SENDER_MAX_RECIPIENTS)
  }),
  z.object({
    kind: z.literal('erc20_transferFrom'),
    chainId: z.number().int().positive(),
    tokenAddress: z.string(),
    recipients: z.array(z.string()).min(1).max(EVM_BATCH_SENDER_MAX_RECIPIENTS),
    amounts: z.array(z.string()).min(1).max(EVM_BATCH_SENDER_MAX_RECIPIENTS)
  })
]);

export type EvmBatchSenderBuildRequest = z.infer<
  typeof evmBatchSenderBuildRequestSchema
>;
