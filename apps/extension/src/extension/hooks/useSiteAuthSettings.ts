import { useCallback, useEffect, useMemo, useState } from 'react';

import type { SiteAuthPolicy } from '~/types';
import { extLogDebug } from '~lib/extensionLog';
import {
  loadSiteAuthSettings,
  saveSiteAuthSettings,
  SITE_AUTH_SETTINGS_STORAGE_KEY
} from '~lib/walletUi/globalSettings';

import { useStorageKeyRefresh } from './common/useStorageKeyRefresh';
import type { PanelStatus } from './usePanelStatus';
import { authPolicySummaryText } from './walletPanelHelpers';

type ShowStatus = (kind: PanelStatus['kind'], text: string) => void;

/**
 * **站点授权策略** 表单状态、持久化设置与保存回调。
 */
export function useSiteAuthSettings(showStatus: ShowStatus) {
  const [authPolicy, setAuthPolicy] = useState<SiteAuthPolicy>('per_reload');
  const [authTimedMinutes, setAuthTimedMinutes] = useState('60');

  const authPolicySummary = useMemo(
    () => authPolicySummaryText(authPolicy, authTimedMinutes),
    [authPolicy, authTimedMinutes]
  );

  const refreshAuthFromStorage = useCallback(async () => {
    const s = await loadSiteAuthSettings();
    setAuthPolicy(s.policy);
    setAuthTimedMinutes(String(s.timedMinutes));
  }, []);

  useEffect(() => {
    void refreshAuthFromStorage();
  }, [refreshAuthFromStorage]);

  useStorageKeyRefresh([SITE_AUTH_SETTINGS_STORAGE_KEY], refreshAuthFromStorage);

  const handleSaveAuthPolicy = useCallback(async () => {
    const mins = Number.parseInt(authTimedMinutes, 10);
    if (!Number.isFinite(mins) || mins < 1) {
      showStatus('err', '定时分钟数须为 ≥1 的整数');
      return;
    }
    try {
      await saveSiteAuthSettings({ policy: authPolicy, timedMinutes: mins });
      showStatus('ok', '站点授权策略已保存（下次批准连接时生效）');
      extLogDebug('panel_action', { action: 'save_site_auth_policy', policy: authPolicy });
    } catch {
      showStatus('err', '保存失败');
    }
  }, [authTimedMinutes, authPolicy, showStatus]);

  return {
    authPolicy,
    setAuthPolicy,
    authTimedMinutes,
    setAuthTimedMinutes,
    authPolicySummary,
    handleSaveAuthPolicy
  };
}
