import {
  EVEXPLORER_MAX_ADDRESSES_PER_BATCH,
  TRONEXPLORER_MAX_ADDRESSES_PER_BATCH
} from '@plugin/shared';

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

export type TronStatus = {
  apiKeyConfigured: boolean;
  minIntervalMs: number;
};

export type TronAccountBalances = {
  address: string;
  balanceSun: string;
  trc20: Array<{ contractAddress: string; balanceRaw: string }>;
  error?: string;
};

export type TronAccountsResponse = {
  accounts: TronAccountBalances[];
};

export const DEFAULT_ADDRESSES = `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe`;

/** 示例地址：TRON 超级代表候选（账户数据量适中，便于演示） */
export const DEFAULT_TRON_ADDRESSES = `TN2W4cc7a4dsYyTLiLMWa9m7jVpdLjGvYs
TC6qGw3d6h25gjcM64KLuZn1cznNi5NR6t`;

export const CHAIN_OPTIONS: ReadonlyArray<{ id: number; label: string }> = [
  { id: 1, label: 'Ethereum 主网 (1)' },
  { id: 11155111, label: 'Sepolia (11155111)' },
  { id: 137, label: 'Polygon (137)' },
  { id: 42161, label: 'Arbitrum One (42161)' },
  { id: 8453, label: 'Base (8453)' },
  { id: 56, label: 'BSC (56)' }
];

/** TRC-20 列表预览上限（避免超大账户渲染上千行；完整数据见原始 JSON） */
export const TRC20_PREVIEW_LIMIT = 20;

function splitAddressLines(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseAddressLines(text: string): string[] {
  return splitAddressLines(text).slice(0, EVEXPLORER_MAX_ADDRESSES_PER_BATCH);
}

/** Tron 地址行解析；上限与服务端 `POST /api/v1/tron/explorer/accounts` 一致。 */
export function parseTronAddressLines(text: string): string[] {
  return splitAddressLines(text).slice(0, TRONEXPLORER_MAX_ADDRESSES_PER_BATCH);
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

/**
 * 从失败响应体中提取可读错误：Fastify 返回 JSON（message/error），
 * 上游（如 TronGrid）可能是纯文本；无法解析时回退原文或 HTTP 状态。
 */
export function apiErrorMessage(body: string, status: number): string {
  const trimmed = body.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as {
        message?: unknown;
        error?: unknown;
      };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message;
      }
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        return parsed.error;
      }
    } catch {
      // 非 JSON：按原文展示
    }
  }
  return trimmed || `HTTP ${status}`;
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
