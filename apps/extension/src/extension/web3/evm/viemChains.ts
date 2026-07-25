import { arbitrum, base, bsc, mainnet, optimism, polygon, sepolia } from 'viem/chains';

/**
 * EVM 三方库封装：统一收口 `viem/chains` 的链定义。
 * 仅导出扩展当前需要的内置链，避免业务模块直接 import 三方库。
 */

export { arbitrum, base, bsc, mainnet, optimism, polygon, sepolia };
