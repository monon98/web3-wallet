import {
  BALANCE_MAX_ADDRESSES_PER_CHAIN,
  type BalanceFamily,
  type BalanceQueryRequest,
  type BalanceQueryResponse
} from '@plugin/shared';
import { getAddress, isAddress } from 'viem';

/**
 * Web `/balances` 各链页面共用的余额查询客户端。
 *
 * 调用链：`app/balances/{evm,tron,btc}/page.tsx` → `components/balances/balancesFamilyPage.tsx`
 * → 本模块 → `POST /api/v1/balances/query`。每页只提交当前链的一个 group。
 * 只发送公开地址；可选携带 sessionStorage 中的 Bearer 会话以获得更高限额。
 * 地址在这里做基础格式校验与去重，服务端仍会做完整校验（Tron / BTC 含校验和）。
 */

export class BalancesApiError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
    readonly detail?: string,
    readonly retryAfterMs?: number
  ) {
    super(code);
    this.name = 'BalancesApiError';
  }
}

export type BalancesFormState = {
  evmChainId: string;
  evmAddresses: string;
  tronAddresses: string;
  btcAddresses: string;
  includeEvmTokens: boolean;
  includeTronTokens: boolean;
};

export type ParsedAddressInput = {
  addresses: string[];
  invalid: string[];
  duplicates: number;
};

export type BuiltBalanceQuery = {
  request: BalanceQueryRequest;
  families: BalanceFamily[];
  duplicates: number;
};

export const DEFAULT_EVM_ADDRESSES = `0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
0xde0B295669a9FD93d5F28D9Ec85E40f4cb697BAe`;

/** 示例地址：TRON 超级代表候选（账户数据量适中，便于演示） */
export const DEFAULT_TRON_ADDRESSES = `TN2W4cc7a4dsYyTLiLMWa9m7jVpdLjGvYs
TC6qGw3d6h25gjcM64KLuZn1cznNi5NR6t`;

/** 示例地址：创世 P2PKH、常见 P2SH、BIP-173 P2WPKH 示例（覆盖三种地址编码） */
export const DEFAULT_BTC_ADDRESSES = `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa
3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy
bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4`;

export const EVM_CHAIN_OPTIONS: ReadonlyArray<{ id: number; label: string }> = [
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
    .map((line) => line.trim())
    .filter(Boolean);
}

function uniqueWithCount(values: string[]): {
  addresses: string[];
  duplicates: number;
} {
  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const value of values) {
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    addresses.push(value);
  }
  return { addresses, duplicates: values.length - addresses.length };
}

/** EVM 地址：viem 校验 + checksum 化 + 大小写不敏感去重。 */
export function parseEvmAddressInput(text: string): ParsedAddressInput {
  const invalid: string[] = [];
  const normalized: string[] = [];
  for (const value of parseAddressLines(text)) {
    if (!isAddress(value)) {
      invalid.push(value);
      continue;
    }
    normalized.push(getAddress(value));
  }
  const unique = uniqueWithCount(
    normalized.map((address) => address.toLowerCase())
  );
  const checksummed = unique.addresses.map((address) => getAddress(address));
  return {
    addresses: checksummed,
    invalid,
    duplicates: unique.duplicates
  };
}

/** Tron base58 基础格式；完整 base58check 校验由服务端完成。 */
export function parseTronAddressInput(text: string): ParsedAddressInput {
  const invalid: string[] = [];
  const valid: string[] = [];
  for (const value of parseAddressLines(text)) {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value)) {
      invalid.push(value);
      continue;
    }
    valid.push(value);
  }
  const unique = uniqueWithCount(valid);
  return { ...unique, invalid };
}

/** BTC 主网地址基础格式；完整 base58check / bech32 校验由服务端完成。 */
export function parseBtcAddressInput(text: string): ParsedAddressInput {
  const invalid: string[] = [];
  const valid: string[] = [];
  for (const value of parseAddressLines(text)) {
    const base58 = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/.test(value);
    const lower = value.toLowerCase();
    const bech32 =
      lower.startsWith('bc1') &&
      (value === lower || value === value.toUpperCase()) &&
      /^bc1[02-9ac-hj-np-z]{11,71}$/.test(lower);
    if (!base58 && !bech32) {
      invalid.push(value);
      continue;
    }
    valid.push(value);
  }
  const unique = uniqueWithCount(valid);
  return { ...unique, invalid };
}

function assertAddresses(label: string, parsed: ParsedAddressInput): void {
  if (parsed.invalid.length > 0) {
    const preview = parsed.invalid.slice(0, 3).join('、');
    const suffix =
      parsed.invalid.length > 3 ? ` 等 ${parsed.invalid.length} 个` : '';
    throw new Error(`${label}地址格式无效：${preview}${suffix}`);
  }
  if (parsed.addresses.length > BALANCE_MAX_ADDRESSES_PER_CHAIN) {
    throw new Error(
      `${label}地址最多 ${BALANCE_MAX_ADDRESSES_PER_CHAIN} 个（当前 ${parsed.addresses.length} 个）`
    );
  }
}

/**
 * 把表单转换为统一查询请求；空链不参与请求。
 * 校验失败抛普通 `Error`，由页面直接展示中文提示。
 */
export function buildBalanceQueryRequest(
  form: BalancesFormState
): BuiltBalanceQuery {
  const families: BalanceFamily[] = [];
  let duplicates = 0;

  const evm = parseEvmAddressInput(form.evmAddresses);
  const tron = parseTronAddressInput(form.tronAddresses);
  const btc = parseBtcAddressInput(form.btcAddresses);

  assertAddresses('EVM ', evm);
  assertAddresses('Tron ', tron);
  assertAddresses('BTC ', btc);

  duplicates += evm.duplicates + tron.duplicates + btc.duplicates;

  const chainId = Number.parseInt(form.evmChainId, 10);
  if (
    evm.addresses.length > 0 &&
    (!Number.isSafeInteger(chainId) || chainId <= 0)
  ) {
    throw new Error('请选择有效的 EVM 链。');
  }

  const request: BalanceQueryRequest = {};
  if (evm.addresses.length > 0) {
    families.push('evm');
    request.evm = {
      chainId,
      addresses: evm.addresses,
      includeTokens: form.includeEvmTokens
    };
  }
  if (tron.addresses.length > 0) {
    families.push('tron');
    request.tron = {
      addresses: tron.addresses,
      includeTokens: form.includeTronTokens
    };
  }
  if (btc.addresses.length > 0) {
    families.push('btc');
    request.btc = { addresses: btc.addresses };
  }

  if (families.length === 0) {
    throw new Error('请填写地址。');
  }

  return { request, families, duplicates };
}

type ErrorBody = {
  error?: unknown;
  detail?: unknown;
  retryAfterMs?: unknown;
};

function parseErrorBody(text: string): ErrorBody | null {
  if (!text.trim().startsWith('{')) {
    return null;
  }
  try {
    return JSON.parse(text) as ErrorBody;
  } catch {
    return null;
  }
}

/** 调用统一余额接口；非 2xx 时抛出带错误码的 `BalancesApiError`。 */
export async function queryBalances(
  apiBase: string,
  request: BalanceQueryRequest,
  token: string | null,
  signal?: AbortSignal
): Promise<BalanceQueryResponse> {
  if (!apiBase) {
    throw new BalancesApiError('api_base_missing', 0);
  }

  const headers: Record<string, string> = {
    'content-type': 'application/json'
  };
  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${apiBase}/api/v1/balances/query`, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
    signal
  });
  const text = await res.text();
  const body = parseErrorBody(text);

  if (!res.ok) {
    const code =
      typeof body?.error === 'string' ? body.error : `http_${res.status}`;
    const detail = typeof body?.detail === 'string' ? body.detail : undefined;
    const retryAfterMs =
      typeof body?.retryAfterMs === 'number' ? body.retryAfterMs : undefined;
    throw new BalancesApiError(code, res.status, detail, retryAfterMs);
  }

  if (!text.trim().startsWith('{')) {
    throw new BalancesApiError('invalid_response', res.status);
  }
  try {
    return JSON.parse(text) as BalanceQueryResponse;
  } catch {
    throw new BalancesApiError('invalid_response', res.status);
  }
}

export function describeBalancesError(error: unknown): string {
  if (error instanceof BalancesApiError) {
    switch (error.code) {
      case 'api_base_missing':
        return '未配置 NEXT_PUBLIC_API_URL，无法连接服务端。';
      case 'unauthorized':
        return '登录会话已失效，请重新登录或使用匿名查询。';
      case 'rate_limited':
        return `查询过于频繁，请 ${Math.max(
          1,
          Math.ceil((error.retryAfterMs ?? 60_000) / 1000)
        )} 秒后重试。`;
      case 'invalid_body':
        return '请求参数无效，请检查地址数量与格式。';
      case 'invalid_evm_address':
      case 'invalid_tron_address':
      case 'invalid_btc_address':
        return `地址校验失败${error.detail ? `：${error.detail}` : ''}。`;
      default:
        return `查询失败（${error.code}，HTTP ${error.statusCode}）。`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return '查询失败，请稍后重试。';
}

/** 行内上游错误码 → 可操作中文提示（用于表格状态列）。 */
export function upstreamErrorMessage(
  code: string,
  retryAfterMs?: number
): string {
  switch (code) {
    case 'etherscan_unreachable':
      return retryAfterMs
        ? `Etherscan 不可达，ERC-20 持仓暂未更新；约 ${Math.ceil(
            retryAfterMs / 1000
          )} 秒后可重试。`
        : 'Etherscan 不可达，ERC-20 持仓暂未更新；可检查网络 / 代理后重试。';
    case 'etherscan_not_configured':
      return '服务端未配置 ETHERSCAN_API_KEY，无法查询 ERC-20 持仓；原生余额不受影响。';
    case 'etherscan_rate_limited':
      return 'Etherscan 限流，ERC-20 持仓暂未更新；请稍后重试或降低查询频率。';
    case 'rpc_chain_mismatch':
      return '服务端 RPC 与所选链不一致；请切换链，或调整 SERVER_RPC_URL。';
    case 'rpc_unreachable':
      return '服务端 RPC 不可达；请检查 SERVER_RPC_URL。';
    case 'rpc_not_configured':
      return '服务端未配置 SERVER_RPC_URL，无法使用 RPC 兜底。';
    case 'tron_grid_unreachable':
      return 'TronGrid 不可达；请检查网络或 SERVER_TRON_API_URL。';
    case 'tron_grid_http_429':
      return 'TronGrid 限流；请稍后重试或配置 SERVER_TRON_API_KEY。';
    case 'esplora_unreachable':
      return 'Esplora 不可达；请检查网络或 SERVER_BTC_API_URL。';
    case 'esplora_http_429':
      return 'Esplora 限流；请稍后重试或调大 SERVER_BTC_MIN_INTERVAL_MS。';
    default:
      return code;
  }
}
