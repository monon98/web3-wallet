import { getTronApiKey, getTronApiUrl } from '../config/chain.js';
import { isTronBase58Address } from './tronAddress.js';

export class TronGridError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'TronGridError';
  }
}

export type TronTrc20Balance = {
  /** TRC-20 合约地址（base58，`T...`） */
  contractAddress: string;
  /** 原始余额（未除 `decimals`，十进制字符串） */
  balanceRaw: string;
};

export type TronAccountBalancesResult = {
  address: string;
  /** TRX 余额（sun，十进制字符串；账户不存在时 `0`） */
  balanceSun: string;
  trc20: TronTrc20Balance[];
  /** 上游单地址查询失败时的人类可读原因（批量接口用；不含密钥） */
  error?: string;
};

type TronGridAccountEntry = {
  balance?: number | string;
  trc20?: Array<Record<string, unknown>>;
};

type TronGridEnvelope = {
  success?: boolean;
  error?: string;
  data?: unknown[];
};

/**
 * 批量地址查询的串行间隔（毫秒）。
 * TronGrid 未带 API Key 时公共额度很低（易触发 429）；默认 `250`（约 4 请求 / 秒），
 * 无 Key 或仍被限流时可调大该值。
 */
export function getTronMinIntervalMs(): number {
  const raw = process.env.SERVER_TRON_MIN_INTERVAL_MS?.trim();
  if (raw === undefined || raw === '') {
    return 250;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 0 ? n : 250;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toUnsignedDecimalString(value: unknown, fallback: string): string {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return String(Math.trunc(value));
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return value.trim();
  }
  return fallback;
}

async function tronGridGet(path: string): Promise<TronGridEnvelope> {
  const base = getTronApiUrl().replace(/\/+$/, '');
  const headers: Record<string, string> = { accept: 'application/json' };
  const apiKey = getTronApiKey();
  if (apiKey) {
    headers['TRON-PRO-API-KEY'] = apiKey;
  }

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30_000)
    });
  } catch {
    throw new TronGridError('tron_grid_unreachable', 502);
  }

  if (!res.ok) {
    throw new TronGridError(
      `tron_grid_http_${res.status}`,
      res.status === 429 ? 429 : 502
    );
  }

  let raw: unknown;
  try {
    raw = await res.json();
  } catch {
    throw new TronGridError('tron_grid_invalid_response', 502);
  }
  if (typeof raw !== 'object' || raw === null) {
    throw new TronGridError('tron_grid_invalid_response', 502);
  }
  return raw as TronGridEnvelope;
}

function parseAccountEntry(
  address: string,
  entry: TronGridAccountEntry | undefined
): TronAccountBalancesResult {
  if (!entry) {
    return { address, balanceSun: '0', trc20: [] };
  }

  const trc20: TronTrc20Balance[] = [];
  if (Array.isArray(entry.trc20)) {
    for (const item of entry.trc20) {
      if (typeof item !== 'object' || item === null) {
        continue;
      }
      for (const [contractAddress, raw] of Object.entries(item)) {
        const balanceRaw = toUnsignedDecimalString(raw, '');
        if (balanceRaw !== '') {
          trc20.push({ contractAddress, balanceRaw });
        }
      }
    }
  }

  return {
    address,
    balanceSun: toUnsignedDecimalString(entry.balance, '0'),
    trc20
  };
}

/**
 * 单地址账户余额：TRX（`balance`，sun）与 TRC-20 持仓（`trc20`，原始数量）。
 * @see https://developers.tron.network/reference/getaccount
 */
export async function getTronAccountBalances(
  address: string
): Promise<TronAccountBalancesResult> {
  if (!isTronBase58Address(address)) {
    throw new TronGridError('invalid_address', 400);
  }

  const envelope = await tronGridGet(
    `/v1/accounts/${encodeURIComponent(address)}`
  );

  if (envelope.success === false) {
    const detail =
      typeof envelope.error === 'string' && envelope.error !== ''
        ? envelope.error
        : 'tron_grid_error';
    throw new TronGridError(`tron_grid_error: ${detail}`, 502);
  }

  const first = Array.isArray(envelope.data) ? envelope.data[0] : undefined;
  const entry =
    typeof first === 'object' && first !== null
      ? (first as TronGridAccountEntry)
      : undefined;

  return parseAccountEntry(address, entry);
}

/**
 * 多地址账户余额：按地址**串行**请求并以 `SERVER_TRON_MIN_INTERVAL_MS` 节流；
 * 单地址失败（含上游限流）以条目内 `error` 返回，不中断整批。
 */
export async function getTronAccountBalancesBatch(
  addresses: string[]
): Promise<TronAccountBalancesResult[]> {
  if (addresses.length === 0) {
    throw new TronGridError('addresses_empty', 400);
  }

  for (const address of addresses) {
    if (!isTronBase58Address(address)) {
      throw new TronGridError('invalid_address', 400);
    }
  }

  const interval = getTronMinIntervalMs();
  const out: TronAccountBalancesResult[] = [];

  for (let i = 0; i < addresses.length; i += 1) {
    if (i > 0 && interval > 0) {
      await sleep(interval);
    }
    const address = addresses[i]!;
    try {
      out.push(await getTronAccountBalances(address));
    } catch (e) {
      if (e instanceof TronGridError) {
        out.push({ address, balanceSun: '0', trc20: [], error: e.message });
      } else {
        throw e;
      }
    }
  }

  return out;
}
