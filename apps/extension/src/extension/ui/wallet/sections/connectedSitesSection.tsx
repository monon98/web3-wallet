import { PanelSection, UiButton } from '@plugin/ui';

import type { ConnectedSitesSectionProps, SiteAuthSession } from '~/types';

/** 将 `SiteAuthSession` 的 tab/过期/持久策略译成可读文案。 */
function formatSessionScope(sess: SiteAuthSession): string {
  if (sess.tabId !== null) {
    return `当前策略：仅标签页 #${sess.tabId}（刷新或关闭该标签后失效）`;
  }
  if (sess.expiresAt !== null) {
    const d = new Date(sess.expiresAt);
    const left = Math.max(0, sess.expiresAt - Date.now());
    const mins = Math.max(0, Math.ceil(left / 60_000));
    return `当前策略：定时 · ${d.toLocaleString()} 前有效（约 ${mins} 分钟）`;
  }
  return '当前策略：持久（在下方手动断开前对该站有效）';
}

function shortAddress(addr: string): string {
  if (addr.length < 12) {
    return addr;
  }
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** 列出全局偏好持久态（`~lib/walletUi/globalSettings` → `loadWalletUiState`）中的站点会话，支持按 origin 断开或全部断开。 */
export function ConnectedSitesSection({
  variant = 'panel',
  sessions,
  onRevokeOrigin,
  onRevokeAll
}: ConnectedSitesSectionProps) {
  const uniqueAddresses = new Set(sessions.map((s) => s.address.toLowerCase()));

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
      {sessions.length === 0 ? (
        <p className='text-[11px] opacity-70'>暂无已连接网站。</p>
      ) : (
        <ul className='space-y-2'>
          {sessions.map((sess) => (
            <li key={sess.origin} className='rounded border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-2'>
              <div className='break-all font-mono text-[11px] font-medium text-[var(--ui-fg)]'>{sess.origin}</div>
              <div className='mt-1 text-[10px] text-[var(--ui-muted-fg)]'>
                暴露地址：<code className='text-[10px]'>{sess.address}</code>{' '}
                <span className='opacity-70'>({shortAddress(sess.address)})</span>
              </div>
              <p className='mt-1 text-[10px] leading-snug text-[var(--ui-muted-fg)]'>{formatSessionScope(sess)}</p>
              <UiButton variant='danger' size='xs' className='mt-2' onClick={() => onRevokeOrigin(sess.origin)}>
                断开此网站
              </UiButton>
            </li>
          ))}
        </ul>
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
