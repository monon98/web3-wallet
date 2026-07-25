import { useCallback } from 'react';

import { extLogDebug } from '~lib/extensionLog';
import { revokeAllSiteAuthSessions, revokeSiteSessionOrigin } from '~lib/walletUi/globalSettings';

import type { PanelStatus } from './usePanelStatus';

type ShowStatus = (kind: PanelStatus['kind'], text: string) => void;

/**
 * **已连接站点** 单站断开与全部断开。
 */
export function useWalletConnectedSitesActions(showStatus: ShowStatus, refreshVaultUi: () => Promise<void>) {
  const handleRevokeSiteOrigin = useCallback(
    async (origin: string) => {
      if (!confirm(`确定断开网站授权？\n${origin}`)) {
        return;
      }
      try {
        await revokeSiteSessionOrigin(origin);
        showStatus('ok', '已断开该网站');
        extLogDebug('panel_action', { action: 'revoke_site_origin', origin });
        await refreshVaultUi();
      } catch {
        showStatus('err', '断开失败');
      }
    },
    [refreshVaultUi, showStatus]
  );

  const handleRevokeAllSites = useCallback(async () => {
    if (!confirm('将断开所有已连接网站（不影响本地账户），是否继续？')) {
      return;
    }
    try {
      await revokeAllSiteAuthSessions();
      showStatus('ok', '已断开全部网站');
      extLogDebug('panel_action', { action: 'revoke_all_site_sessions' });
      await refreshVaultUi();
    } catch {
      showStatus('err', '操作失败');
    }
  }, [refreshVaultUi, showStatus]);

  return {
    handleRevokeSiteOrigin,
    handleRevokeAllSites
  };
}
