import { formatEther, formatUnits } from 'viem';

/** `/balances` 页的展示格式化与 CSV 导出（纯函数，便于本地调试）。 */

export const ADDRESS_PAGE_SIZE = 10;
export const TOKEN_PREVIEW_LIMIT = 20;

export function shortAddress(address: string): string {
  if (address.length < 14) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** wei → 原生币（18 位精度）。 */
export function formatEvmAmount(wei: string): string {
  try {
    return formatEther(BigInt(wei));
  } catch {
    return wei;
  }
}

/** sun → TRX（6 位精度）。 */
export function formatTronAmount(sun: string): string {
  try {
    return formatUnits(BigInt(sun), 6);
  } catch {
    return sun;
  }
}

/** sat → BTC（8 位精度；负数表示内存池净流出）。 */
export function formatBtcAmount(sat: string): string {
  try {
    const negative = sat.startsWith('-');
    const value = formatUnits(BigInt(negative ? sat.slice(1) : sat), 8);
    return negative ? `-${value}` : value;
  } catch {
    return sat;
  }
}

/** quantity / divisor → 可读十进制（最多 6 位小数；极大数可能不精确）。 */
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

export function formatCacheAge(ageMs: number | undefined): string {
  if (ageMs === undefined || ageMs < 0) {
    return '刚刚';
  }
  if (ageMs < 2_000) {
    return '刚刚';
  }
  if (ageMs < 60_000) {
    return `${Math.floor(ageMs / 1_000)} 秒前`;
  }
  if (ageMs < 3_600_000) {
    return `${Math.floor(ageMs / 60_000)} 分钟前`;
  }
  return `${Math.floor(ageMs / 3_600_000)} 小时前`;
}

export function formatDuration(ms: number): string {
  if (ms < 1_000) {
    return `${ms} ms`;
  }
  return `${(ms / 1_000).toFixed(ms < 10_000 ? 1 : 0)} s`;
}

/** ISO 时间 → 稳定可读字符串（UTC，避免渲染期读取本地时区 / 当前时间）。 */
export function formatIsoTimestamp(iso: string): string {
  const normalized = iso.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
  return normalized.endsWith('Z')
    ? `${normalized.slice(0, -1)} UTC`
    : normalized;
}

function escapeCsvCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows]
    .map((row) => row.map((cell) => escapeCsvCell(cell)).join(','))
    .join('\r\n');
}

function fileStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(
    now.getDate()
  )}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

/** 触发浏览器下载 CSV（带 UTF-8 BOM，Excel 打开中文不乱码）。 */
export function downloadCsv(
  prefix: string,
  headers: string[],
  rows: string[][]
): void {
  const csv = buildCsv(headers, rows);
  const blob = new Blob([`\uFEFF${csv}`], {
    type: 'text/csv;charset=utf-8;'
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${prefix}-${fileStamp()}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
