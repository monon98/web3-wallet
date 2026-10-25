/**
 * 浏览器扩展内置 EVM 链清单：扩展内绑定 viem 公共 RPC，供切链、
 * 只读 `eth_getBalance` / `eth_blockNumber` 与交易广播使用。
 * 扩展还支持用户在侧栏添加本地自定义 RPC 链，但不会覆盖这里的内置链。
 * Web 钱包联调页应与此表对齐，避免下拉与扩展默认能力不一致。
 */
export const WALLET_BUILTIN_EVM_CHAINS = [
  { id: 1, name: 'Ethereum', nativeSymbol: 'ETH', nativeDecimals: 18 },
  { id: 11155111, name: 'Sepolia', nativeSymbol: 'ETH', nativeDecimals: 18 },
  { id: 42161, name: 'Arbitrum One', nativeSymbol: 'ETH', nativeDecimals: 18 },
  { id: 10, name: 'Optimism', nativeSymbol: 'ETH', nativeDecimals: 18 },
  { id: 8453, name: 'Base', nativeSymbol: 'ETH', nativeDecimals: 18 },
  { id: 137, name: 'Polygon', nativeSymbol: 'POL', nativeDecimals: 18 },
  { id: 56, name: 'BNB Smart Chain', nativeSymbol: 'BNB', nativeDecimals: 18 }
] as const;

export type WalletBuiltinEvmChainMeta =
  (typeof WALLET_BUILTIN_EVM_CHAINS)[number];

export type WalletBuiltinEvmChainId = WalletBuiltinEvmChainMeta['id'];

const ID_SET: ReadonlySet<number> = new Set(
  WALLET_BUILTIN_EVM_CHAINS.map((c) => c.id)
);

/** 是否为扩展内置链 ID（自定义 RPC 链不在此集合中）。 */
export function isWalletBuiltinEvmChainId(id: number): boolean {
  return ID_SET.has(id);
}

/**
 * 解析 `0x` 链 ID 后判断是否在支持列表内（大小写不敏感）。
 */
export function isWalletBuiltinEvmChainIdHex(chainIdHex: string): boolean {
  if (typeof chainIdHex !== 'string' || !chainIdHex.startsWith('0x')) {
    return false;
  }
  const id = Number.parseInt(chainIdHex, 16);
  if (!Number.isFinite(id) || id <= 0) {
    return false;
  }
  return isWalletBuiltinEvmChainId(id);
}

export function getWalletBuiltinEvmChainMeta(
  chainId: number
): WalletBuiltinEvmChainMeta | undefined {
  return WALLET_BUILTIN_EVM_CHAINS.find((c) => c.id === chainId);
}

/** 由 `eth_chainId` 的十六进制字符串解析元数据；无效时返回 `undefined`。 */
export function getWalletBuiltinEvmChainMetaFromHex(
  chainIdHex: string | null | undefined
): WalletBuiltinEvmChainMeta | undefined {
  if (chainIdHex == null || chainIdHex === '' || !chainIdHex.startsWith('0x')) {
    return undefined;
  }
  const id = Number.parseInt(chainIdHex, 16);
  if (!Number.isFinite(id) || id <= 0) {
    return undefined;
  }
  return getWalletBuiltinEvmChainMeta(id);
}
