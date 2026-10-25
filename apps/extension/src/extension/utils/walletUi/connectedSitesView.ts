import type { ConnectedSiteScopeKind, ConnectedSitesGroup, ConnectedSitesGroupBy, SiteAuthSession } from '~/types';
import { escapeCsvCell, prefixUtf8Bom } from '~lib/common/csvEscape';
import { downloadTextFile } from '~lib/common/downloadTextFile';

/**
 * **已连接站点视图辅助**（P2-6）：搜索、分组与 CSV 导出。
 *
 * 数据源仅为 `walletUiState` 的 `siteAuthSessions`（origin、公开 EVM 地址、tabId、expiresAt），
 * 不读取 vault、口令或密钥材料；导出内容同样限定在这些公开字段内。
 * 上游：`ui/wallet/sections/connectedSitesSection.tsx`。
 */

const SCOPE_ORDER: readonly ConnectedSiteScopeKind[] = ['persistent', 'timed', 'tab'];

const SCOPE_LABELS: Record<ConnectedSiteScopeKind, string> = {
  persistent: '持久授权',
  timed: '定时授权',
  tab: '仅当前标签'
};

/** 由会话字段推导授权范围；同时存在 tab / 到期时间时以标签页为准（与授权写入逻辑一致）。 */
export function getConnectedSiteScopeKind(sess: SiteAuthSession): ConnectedSiteScopeKind {
  if (sess.tabId !== null) {
    return 'tab';
  }
  if (sess.expiresAt !== null) {
    return 'timed';
  }
  return 'persistent';
}

/** 授权范围的分组标题文案。 */
export function connectedSiteScopeLabel(kind: ConnectedSiteScopeKind): string {
  return SCOPE_LABELS[kind];
}

/** 单条站点的可读授权说明；时间按传入的 `now` 计算，便于测试与统一渲染。 */
export function formatConnectedSiteScope(sess: SiteAuthSession, now: number = Date.now()): string {
  const kind = getConnectedSiteScopeKind(sess);
  if (kind === 'tab') {
    return `仅标签页 #${sess.tabId}（刷新或关闭该标签后失效）`;
  }
  if (kind === 'persistent') {
    return '持久（在下方手动断开前对该站有效）';
  }

  if (sess.expiresAt === null || !Number.isFinite(sess.expiresAt)) {
    return '定时 · 过期时间未知（建议断开后重新授权）';
  }
  const date = new Date(sess.expiresAt);
  if (Number.isNaN(date.getTime())) {
    return '定时 · 过期时间无效（建议断开后重新授权）';
  }
  const left = Math.max(0, sess.expiresAt - now);
  if (left <= 0) {
    return `定时 · ${date.toLocaleString()} 已过期（等待清理）`;
  }
  const mins = Math.max(0, Math.ceil(left / 60_000));
  return `定时 · ${date.toLocaleString()} 前有效（约 ${mins} 分钟）`;
}

/**
 * 按空白拆分搜索词，每个词都须命中 origin 或地址（不区分大小写）。
 * 例如 `uniswap 0xabc` 可同时缩小站点与暴露地址范围。
 */
export function filterConnectedSiteSessions(sessions: readonly SiteAuthSession[], query: string): SiteAuthSession[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return [...sessions];
  }
  return sessions.filter((sess) => {
    const haystack = `${sess.origin}\n${sess.address}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

function compareSessions(a: SiteAuthSession, b: SiteAuthSession): number {
  return a.origin.localeCompare(b.origin) || a.address.localeCompare(b.address);
}

function sortedSessions(sessions: readonly SiteAuthSession[]): SiteAuthSession[] {
  return [...sessions].sort(compareSessions);
}

/**
 * 将筛选后的会话整理为分组视图。
 * - `address`：按暴露地址聚合，站点数多的组优先；
 * - `scope`：按持久 / 定时 / 当前标签固定顺序；
 * - `none`：返回单一无名分组，供 UI 直接平铺。
 */
export function groupConnectedSiteSessions(
  sessions: readonly SiteAuthSession[],
  groupBy: ConnectedSitesGroupBy
): ConnectedSitesGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: null, sessions: sortedSessions(sessions) }];
  }

  if (groupBy === 'address') {
    const byAddress = new Map<string, { label: string; sessions: SiteAuthSession[] }>();
    for (const sess of sessions) {
      const key = sess.address.toLowerCase();
      const bucket = byAddress.get(key);
      if (bucket) {
        bucket.sessions.push(sess);
      } else {
        byAddress.set(key, { label: sess.address, sessions: [sess] });
      }
    }
    return [...byAddress.entries()]
      .map(([key, bucket]) => ({
        key: `address:${key}`,
        label: bucket.label,
        sessions: sortedSessions(bucket.sessions)
      }))
      .sort((a, b) => b.sessions.length - a.sessions.length || (a.label ?? '').localeCompare(b.label ?? ''));
  }

  return SCOPE_ORDER.flatMap((kind) => {
    const groupSessions = sessions.filter((sess) => getConnectedSiteScopeKind(sess) === kind);
    if (groupSessions.length === 0) {
      return [];
    }
    return [
      {
        key: `scope:${kind}`,
        label: SCOPE_LABELS[kind],
        sessions: sortedSessions(groupSessions)
      }
    ];
  });
}

function safeCsvCell(value: string): string {
  // 防止站点来源等文本被 Excel 当作公式执行；导出字段均来自浏览器 origin 或公开地址。
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return escapeCsvCell(guarded);
}

function expiresAtIso(expiresAt: number | null): string {
  if (expiresAt === null) {
    return '';
  }
  const date = new Date(expiresAt);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

/** 生成带 UTF-8 BOM 的 CSV；只包含公开站点元数据，不含私钥、助记词或 RPC 配置。 */
export function buildConnectedSitesCsv(sessions: readonly SiteAuthSession[]): string {
  const headers = ['站点来源', '暴露地址', '授权范围', '标签页 ID', '过期时间（ISO）'];
  const rows = sortedSessions(sessions).map((sess) => [
    safeCsvCell(sess.origin),
    safeCsvCell(sess.address),
    safeCsvCell(connectedSiteScopeLabel(getConnectedSiteScopeKind(sess))),
    sess.tabId === null ? '' : String(sess.tabId),
    expiresAtIso(sess.expiresAt)
  ]);
  const body = [headers.map(safeCsvCell), ...rows].map((row) => row.join(',')).join('\r\n');
  return prefixUtf8Bom(`${body}\r\n`);
}

/** 触发浏览器下载；文件名使用 UTC 时间戳，避免覆盖历史导出。 */
export function exportConnectedSitesCsv(sessions: readonly SiteAuthSession[]): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadTextFile(`connected-sites-${stamp}.csv`, buildConnectedSitesCsv(sessions), 'text/csv;charset=utf-8');
}
