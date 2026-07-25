import { useState } from 'react';

import { useWalletPanel } from '~/hooks/useWalletPanel';
import type { WalletPanelView } from '~/types';

import { WalletPageHeader } from './layout/pageHeader';
import { WalletHomeOverview } from './overview/homeOverview';
import { PendingConnectSection } from './sections/pendingConnectSection';
import { StatusBanner } from './sections/statusBanner';
import { WalletViewGlobalSettings } from './views/globalSettingsView';

const SUB_PAGE_TITLES: Record<Exclude<WalletPanelView, 'overview'>, string> = {
  settings: 'DApp 全局设置'
};

/**
 * 侧栏 **钱包主界面**：顶栏（概览 / 子页 + 返回）→ 挂起连接（若有）→ 状态条 → **概览** 或 **全局设置子页**。
 * 逻辑在 {@link useWalletPanel}（`~/hooks/useWalletPanel`）。
 */
export function WalletPanelComposed() {
  const w = useWalletPanel();
  const [view, setView] = useState<WalletPanelView>('overview');

  const headerTitle = view === 'overview' ? 'Web3 wallet' : SUB_PAGE_TITLES[view];
  const handleBack = () => {
    setView('overview');
  };

  return (
    <div className='box-border mx-auto w-full min-w-0 max-w-[min(32rem,100%)] px-3 py-3 text-left text-sm text-[var(--ui-fg)] sm:px-5 sm:py-4'>
      <WalletPageHeader title={headerTitle} onBack={view === 'overview' ? undefined : handleBack} />

      {w.pendingSite ? (
        <PendingConnectSection
          pending={w.pendingSite}
          choices={w.approvalChoices}
          selectedAddress={w.selectedApprovalAddress}
          onSelectAddress={w.setSelectedApprovalAddress}
          onApprove={w.handleApproveSite}
          onReject={w.handleRejectSite}
        />
      ) : null}

      <StatusBanner kind={w.status.kind} text={w.status.text} />

      {view === 'overview' ? (
        <WalletHomeOverview
          hasEvmAccounts={w.accounts.length > 0}
          accountsSectionSummary={w.accountsSectionSummary}
          connectedSitesSummary={w.connectedSitesSummary}
          authPolicySummary={w.authPolicySummary}
          evmTxSubmitMode={w.evmTxSubmitMode}
          onNavigate={(v) => setView(v)}
        />
      ) : null}

      {view === 'settings' ? (
        <WalletViewGlobalSettings
          evmDefaultAccount={w.accounts[0] ?? null}
          tvmDefaultAccount={w.tvmAccounts[0] ?? null}
          evmTxSubmitMode={w.evmTxSubmitMode}
          onEvmTxSubmitModeChange={(m) => void w.handleEvmTxSubmitModeChange(m)}
          sessions={w.siteSessions}
          onRevokeOrigin={(origin) => void w.handleRevokeSiteOrigin(origin)}
          onRevokeAll={() => void w.handleRevokeAllSites()}
          authPolicy={w.authPolicy}
          onPolicyChange={w.setAuthPolicy}
          authTimedMinutes={w.authTimedMinutes}
          onTimedMinutesChange={w.setAuthTimedMinutes}
          onSave={w.handleSaveAuthPolicy}
        />
      ) : null}
    </div>
  );
}
