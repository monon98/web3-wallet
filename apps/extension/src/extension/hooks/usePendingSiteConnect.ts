import { useCallback, useEffect, useState } from 'react';

import type { WalletConnectChoice } from '~/types';
import { RUNTIME_MSG_APPROVE_SITE_CONNECT, RUNTIME_MSG_REJECT_SITE_CONNECT } from '~lib/bridge/constants';
import { getPendingSiteConnect } from '~lib/bridge/siteConnect/pendingSiteConnect';
import { extLogInfo } from '~lib/extensionLog';

import type { PanelStatus } from './usePanelStatus';

type ShowStatus = (kind: PanelStatus['kind'], text: string) => void;

/**
 * **挂起站点连接** 会话存储同步、审批地址选择与 runtime 批准/拒绝。
 * `approvalChoices` 与 {@link useWalletVaultSync} 中由账户派生的选项一致。
 */
export function usePendingSiteConnect(approvalChoices: WalletConnectChoice[], showStatus: ShowStatus) {
  const [pendingSite, setPendingSite] = useState<Awaited<ReturnType<typeof getPendingSiteConnect>> | null>(null);
  const [selectedApprovalAddress, setSelectedApprovalAddress] = useState('');

  const refreshPendingSite = useCallback(async () => {
    const p = await getPendingSiteConnect();
    setPendingSite(p);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const p = await getPendingSiteConnect();
      if (!cancelled) {
        setPendingSite(p);
      }
    };
    void sync();
    const onStorage = (_changes: unknown, areaName: string) => {
      if (areaName === 'session') {
        void sync();
      }
    };
    chrome.storage.onChanged.addListener(onStorage);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onStorage);
    };
  }, []);

  useEffect(() => {
    if (!pendingSite || approvalChoices.length === 0) {
      return;
    }
    setSelectedApprovalAddress((prev) => {
      if (prev && approvalChoices.some((c) => c.address.toLowerCase() === prev.toLowerCase())) {
        return prev;
      }
      return approvalChoices[0].address;
    });
  }, [pendingSite, approvalChoices]);

  const handleApproveSite = useCallback(() => {
    if (!selectedApprovalAddress) {
      showStatus('err', '请先导入至少一个账户，再批准连接');
      return;
    }
    extLogInfo('panel_approve_site_connect', { source: 'side_panel_or_popup' });
    void chrome.runtime.sendMessage(
      { type: RUNTIME_MSG_APPROVE_SITE_CONNECT, selectedAddress: selectedApprovalAddress },
      () => {
        void chrome.runtime.lastError;
        void refreshPendingSite();
      }
    );
  }, [selectedApprovalAddress, refreshPendingSite, showStatus]);

  const handleRejectSite = useCallback(() => {
    extLogInfo('panel_reject_site_connect', { source: 'side_panel_or_popup' });
    void chrome.runtime.sendMessage({ type: RUNTIME_MSG_REJECT_SITE_CONNECT }, () => {
      void chrome.runtime.lastError;
      void refreshPendingSite();
    });
  }, [refreshPendingSite]);

  return {
    pendingSite,
    selectedApprovalAddress,
    setSelectedApprovalAddress,
    handleApproveSite,
    handleRejectSite
  };
}
