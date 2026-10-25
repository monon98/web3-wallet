import { getBtcApiUrl } from '../config/chain.js';
import { withUpstreamMetrics } from '../observability/metrics.js';
import { isBtcMainnetAddress } from './btcAddress.js';

/**
 * Esplora HTTP 客户端（BTC 只读网关）。
 *
 * 上游：`GET /address/:address`（默认 Blockstream 公共实例，可用 `SERVER_BTC_API_URL` 指向自建 / 其它实例）。
 * 批量按地址**串行**并以 `SERVER_BTC_MIN_INTERVAL_MS` 节流；单地址失败以条目内 `error` 返回、不中断整批。
 * 本模块只返回余额数字（sat），不接触私钥或待签名交易。
 *
 * 接口参考：https://github.com/Blockstream/esplora/blob/master/API.md
 */

export class EsploraError extends Error {
  constructor(
    message: string,
    readonly statusCode: number
  ) {
    super(message);
    this.name = 'EsploraError';
  }
}

export type BtcAddressBalance = {
  address: string;
  /** 已确认余额（sat，十进制字符串） */
  balanceSat: string;
  /** 内存池未确认净变化（sat，可能为负，十进制字符串） */
  mempoolBalanceSat: string;
  /** 已确认交易数 */
  txCount: number;
  /** 上游单地址查询失败时的人类可读原因（批量接口用；不含密钥） */
  error?: string;
};

type EsploraAddressStats = {
  funded_txo_sum?: number | string;
  spent_txo_sum?: number | string;
  tx_count?: number | string;
};

type EsploraAddressInfo = {
  chain_stats?: EsploraAddressStats;
  mempool_stats?: EsploraAddressStats;
};

/**
 * 批量地址查询的串行间隔（毫秒）。
 * 默认 `250`（约 4 请求 / 秒）；公共 Esplora 实例限流或自建节点较慢时可调大。
 */
export function getBtcMinIntervalMs(): number {
  const raw = process.env.SERVER_BTC_MIN_INTERVAL_MS?.trim();
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

function toNonNegativeInt(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number.parseInt(value.trim(), 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

async function esploraGet(path: string): Promise<unknown> {
  const base = getBtcApiUrl().replace(/\/+$/, '');

  return withUpstreamMetrics('esplora', async () => {
    let res: Response;
    try {
      res = await fetch(`${base}${path}`, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(30_000)
      });
    } catch {
      throw new EsploraError('esplora_unreachable', 502);
    }

    if (!res.ok) {
      throw new EsploraError(
        `esplora_http_${res.status}`,
        res.status === 429 ? 429 : 502
      );
    }

    try {
      return await res.json();
    } catch {
      throw new EsploraError('esplora_invalid_response', 502);
    }
  });
}

function parseAddressBalance(address: string, raw: unknown): BtcAddressBalance {
  const info = (
    typeof raw === 'object' && raw !== null ? raw : {}
  ) as EsploraAddressInfo;
  const chain = info.chain_stats ?? {};
  const mempool = info.mempool_stats ?? {};

  const confirmedFunded = toNonNegativeInt(chain.funded_txo_sum);
  const confirmedSpent = toNonNegativeInt(chain.spent_txo_sum);
  const mempoolFunded = toNonNegativeInt(mempool.funded_txo_sum);
  const mempoolSpent = toNonNegativeInt(mempool.spent_txo_sum);

  return {
    address,
    balanceSat: String(Math.max(0, confirmedFunded - confirmedSpent)),
    mempoolBalanceSat: String(mempoolFunded - mempoolSpent),
    txCount: toNonNegativeInt(chain.tx_count)
  };
}

/**
 * 单地址余额：已确认余额、内存池净变化与已确认交易数。
 * 未使用地址由 Esplora 返回全零统计（不是错误）。
 */
export async function getBtcAddressBalance(
  address: string
): Promise<BtcAddressBalance> {
  if (!isBtcMainnetAddress(address)) {
    throw new EsploraError('invalid_address', 400);
  }

  const raw = await esploraGet(`/address/${encodeURIComponent(address)}`);
  return parseAddressBalance(address, raw);
}

/**
 * 多地址余额：按地址**串行**请求并以 `SERVER_BTC_MIN_INTERVAL_MS` 节流；
 * 单地址失败（含上游限流）以条目内 `error` 返回，不中断整批。
 */
export async function getBtcAddressBalancesBatch(
  addresses: string[]
): Promise<BtcAddressBalance[]> {
  if (addresses.length === 0) {
    throw new EsploraError('addresses_empty', 400);
  }

  for (const address of addresses) {
    if (!isBtcMainnetAddress(address)) {
      throw new EsploraError('invalid_address', 400);
    }
  }

  const interval = getBtcMinIntervalMs();
  const out: BtcAddressBalance[] = [];

  for (let i = 0; i < addresses.length; i += 1) {
    if (i > 0 && interval > 0) {
      await sleep(interval);
    }
    const address = addresses[i]!;
    try {
      out.push(await getBtcAddressBalance(address));
    } catch (e) {
      if (e instanceof EsploraError) {
        out.push({
          address,
          balanceSat: '0',
          mempoolBalanceSat: '0',
          txCount: 0,
          error: e.message
        });
      } else {
        throw e;
      }
    }
  }

  return out;
}
