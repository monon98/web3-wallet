import { FieldLabel, PanelSection, SelectField, TextInput, UiButton } from '@plugin/ui';
import { useMemo, useState } from 'react';

import type { ConnectedSitesGroupBy, ConnectedSitesSectionProps, SiteAuthSession } from '~/types';
import {
  exportConnectedSitesCsv,
  filterConnectedSiteSessions,
  formatConnectedSiteScope,
  groupConnectedSiteSessions
} from '~lib/walletUi/connectedSitesView';

function shortAddress(addr: string): string {
  if (addr.length < 12) {
    return addr;
  }
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function sessionKey(sess: SiteAuthSession): string {
  return `${sess.origin}:${sess.address}:${sess.tabId ?? 'all'}:${sess.expiresAt ?? 'forever'}`;
}

/**
 * 列出全局偏好持久态（`~lib/walletUi/globalSettings` → `loadWalletUiState`）中的站点会话。
 *
 * P2-6：支持按 origin / 地址搜索、按暴露地址或授权范围分组，并导出当前筛选结果。
 * 导出仅包含公开站点元数据，不读取或输出任何密钥材料。
 */
export function ConnectedSitesSection({
  variant = 'panel',
  sessions,
  onRevokeOrigin,
  onRevokeAll
}: ConnectedSitesSectionProps) {
  const [query, setQuery] = useState('');
  const [groupBy, setGroupBy] = useState<ConnectedSitesGroupBy>('none');
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const uniqueAddresses = new Set(sessions.map((s) => s.address.toLowerCase()));
  const visibleSessions = useMemo(() => filterConnectedSiteSessions(sessions, query), [sessions, query]);
  const groups = useMemo(() => groupConnectedSiteSessions(visibleSessions, groupBy), [visibleSessions, groupBy]);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setExportNotice(null);
  };

  const handleGroupByChange = (value: ConnectedSitesGroupBy) => {
    setGroupBy(value);
    setExportNotice(null);
  };

  const handleExport = () => {
    if (visibleSessions.length === 0) {
      return;
    }
    try {
      exportConnectedSitesCsv(visibleSessions);
      setExportNotice(`已导出 ${visibleSessions.length} 条站点授权（仅公开元数据）。`);
    } catch {
      setExportNotice('导出失败，请稍后重试。');
    }
  };

  const renderSession = (sess: SiteAuthSession) => (
    <li key={sessionKey(sess)} className='rounded border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-2'>
      <div className='break-all font-mono text-[11px] font-medium text-[var(--ui-fg)]'>{sess.origin}</div>
      <div className='mt-1 text-[10px] text-[var(--ui-muted-fg)]'>
        暴露地址：<code className='text-[10px]'>{sess.address}</code>{' '}
        <span className='opacity-70'>({shortAddress(sess.address)})</span>
      </div>
      <p className='mt-1 text-[10px] leading-snug text-[var(--ui-muted-fg)]'>
        当前策略：{formatConnectedSiteScope(sess)}
      </p>
      <UiButton variant='danger' size='xs' className='mt-2' onClick={() => onRevokeOrigin(sess.origin)}>
        断开此网站
      </UiButton>
    </li>
  );

  const list = (
    <>
      <p className='mb-2 text-[11px] leading-snug text-[var(--ui-muted-fg)]'>
        本地加密账户在「账户列表」中管理。此处列出<strong>已允许连接</strong>的网站及对各站暴露的地址。
        {sessions.length > 0 ? (
          <>
            {' '}
            当前共 {uniqueAddresses.size} 个不同暴露地址、{sessions.length} 条站点授权。
          </>
        ) : null}
      </p>

      {sessions.length > 0 ? (
        <div className='mb-3 space-y-2 rounded border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-2'>
          <div>
            <FieldLabel
              htmlFor='wallet-connected-sites-search'
              className='text-[10px] text-[var(--ui-muted-fg)] opacity-100'>
              搜索站点
            </FieldLabel>
            <TextInput
              id='wallet-connected-sites-search'
              type='search'
              value={query}
              placeholder='按 origin、地址或空格分隔的组合词筛选'
              onChange={(e) => handleQueryChange(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel
              htmlFor='wallet-connected-sites-group'
              className='text-[10px] text-[var(--ui-muted-fg)] opacity-100'>
              分组方式
            </FieldLabel>
            <SelectField
              id='wallet-connected-sites-group'
              value={groupBy}
              className='!mb-0'
              onChange={(e) => handleGroupByChange(e.target.value as ConnectedSitesGroupBy)}>
              <option value='none'>不分组（按站点）</option>
              <option value='address'>按暴露地址</option>
              <option value='scope'>按授权范围</option>
            </SelectField>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-2'>
            <p className='text-[10px] text-[var(--ui-muted-fg)]'>
              显示 {visibleSessions.length} / {sessions.length} 条授权
            </p>
            <UiButton variant='secondary' size='xs' disabled={visibleSessions.length === 0} onClick={handleExport}>
              导出筛选结果（CSV）
            </UiButton>
          </div>
          <p className='text-[10px] leading-snug text-[var(--ui-muted-fg)]'>
            导出仅含站点来源、公开地址与授权范围 / 时间，不含私钥、助记词或 RPC 配置。
          </p>
          {exportNotice ? <p className='text-[10px] leading-snug text-[var(--ui-muted-fg)]'>{exportNotice}</p> : null}
        </div>
      ) : null}

      {sessions.length === 0 ? (
        <p className='text-[11px] opacity-70'>暂无已连接网站。</p>
      ) : visibleSessions.length === 0 ? (
        <div className='flex flex-wrap items-center gap-2'>
          <p className='text-[11px] opacity-70'>没有匹配的站点。</p>
          <UiButton variant='secondary' size='xs' onClick={() => handleQueryChange('')}>
            清除搜索
          </UiButton>
        </div>
      ) : groupBy === 'none' ? (
        <ul className='space-y-2'>{(groups[0]?.sessions ?? []).map(renderSession)}</ul>
      ) : (
        <div className='space-y-3'>
          {groups.map((group) => (
            <section key={group.key} className='space-y-2'>
              <div className='flex items-baseline justify-between gap-2'>
                <p className='min-w-0 break-all text-[10px] font-medium text-[var(--ui-fg)]'>
                  {groupBy === 'address' ? (
                    <>
                      暴露地址 <code className='font-mono'>{group.label}</code>
                    </>
                  ) : (
                    group.label
                  )}
                </p>
                <span className='shrink-0 text-[10px] text-[var(--ui-muted-fg)]'>{group.sessions.length} 个站点</span>
              </div>
              <ul className='space-y-2'>{group.sessions.map(renderSession)}</ul>
            </section>
          ))}
        </div>
      )}

      {sessions.length > 0 ? (
        <UiButton variant='linkDanger' size='xs' className='mt-2 !px-0 !py-0' onClick={() => onRevokeAll()}>
          断开全部网站
        </UiButton>
      ) : null}
    </>
  );

  if (variant === 'plain') {
    return (
      <div className='space-y-2'>
        <h3 className='text-[11px] font-semibold text-[var(--ui-fg)]'>已连接网站（{sessions.length}）</h3>
        {list}
      </div>
    );
  }

  return (
    <PanelSection title={`已连接网站（${sessions.length}）`} tone='muted'>
      {list}
    </PanelSection>
  );
}
