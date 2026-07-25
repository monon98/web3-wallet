import { EVEXPLORER_MAX_ADDRESSES_PER_BATCH } from '@plugin/shared';

export type EvmStatus = { rpc: boolean; etherscan: boolean };

export type ApiMeta = {
  service: string;
  rpcConfigured: boolean;
  etherscanConfigured: boolean;
  bridgeMethods: readonly string[];
};

export type NativeBalancesResponse = {
  chainId: number;
  balances: Array<{
    chainId: number;
    address: `0x${string}`;
    balanceWei: string;
  }>;
};

export type TokenBalancesResponse = {
  chainId: number;
  page: number;
  offset: number;
  items: Array<{
    chainId: number;
    address: `0x${string}`;
    tokens: Array<{
      tokenAddress: string;
      tokenName: string;
      tokenSymbol: string;
      tokenQuantity: string;
      tokenDivisor: string;
      tokenPriceUsd?: string;
    }>;
    error?: string;
  }>;
};

export const DEFAULT_ADDRESSES = `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
0xde0b295669a9FD93d5f28d9ec85e40f4CB697BAe`;

export const CHAIN_OPTIONS: ReadonlyArray<{ id: number; label: string }> = [
  { id: 1, label: 'Ethereum 主网 (1)' },
  { id: 11155111, label: 'Sepolia (11155111)' },
  { id: 137, label: 'Polygon (137)' },
  { id: 42161, label: 'Arbitrum One (42161)' },
  { id: 8453, label: 'Base (8453)' },
  { id: 56, label: 'BSC (56)' }
];

export function parseAddressLines(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, EVEXPLORER_MAX_ADDRESSES_PER_BATCH);
}

export function shortAddress(addr: string): string {
  if (addr.length < 14) {
    return addr;
  }
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export async function readJson<T>(res: Response): Promise<T> {
  return (await res.json()) as T;
}

/** 演示用：将 quantity/divisor 转为可读十进制（极大数可能不精确）。 */
export function tokenAmountDisplay(quantity: string, divisor: string): string {
  try {
    const q = BigInt(quantity);
    const d = BigInt(divisor);
    if (d <= BigInt(0)) {
      return quantity;
    }
    const whole = q / d;
    const rem = q % d;
    if (rem === BigInt(0)) {
      return whole.toString();
    }
    const fracDigits = 6;
    const scale = BigInt(10) ** BigInt(fracDigits);
    const frac = (rem * scale) / d;
    const fracStr = frac
      .toString()
      .padStart(fracDigits, '0')
      .replace(/0+$/, '');
    return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
  } catch {
    return `${quantity} / ${divisor}`;
  }
}
