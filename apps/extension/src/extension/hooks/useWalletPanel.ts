import type { EvmTxSubmitMode } from '~/types';
import { setWalletEvmTxSubmitMode } from '~lib/walletUi/globalSettings';

import { usePanelStatus } from './usePanelStatus';
import { usePendingSiteConnect } from './usePendingSiteConnect';
import { useSiteAuthSettings } from './useSiteAuthSettings';
import { useWalletAccountMutations } from './useWalletAccountMutations';
import { useWalletConnectedSitesActions } from './useWalletConnectedSitesActions';
import { useWalletImportForm } from './useWalletImportForm';
import { useWalletVaultSync } from './useWalletVaultSync';

/**
 * **侧栏钱包面板** 组合 hook：聚合下列子模块（同目录）——
 * {@link useWalletVaultSync}（账户与会话）、{@link useSiteAuthSettings}（授权策略）、
 * {@link usePendingSiteConnect}（挂起连接审批）、{@link useWalletImportForm}、
 * {@link useWalletAccountMutations}、{@link useWalletConnectedSitesActions}、{@link usePanelStatus}。
 *
 * 批准连接通过 `chrome.runtime.sendMessage` 与弹窗页一致；开发日志约定不变（见各子 hook / `extLog*`）。
 */
export function useWalletPanel() {
  const { status, showStatus } = usePanelStatus();
  const vault = useWalletVaultSync();
  const auth = useSiteAuthSettings(showStatus);
  const pending = usePendingSiteConnect(vault.approvalChoices, showStatus);
  const importForm = useWalletImportForm(showStatus, vault.refreshVaultUi);
  const accountMutations = useWalletAccountMutations(showStatus, vault.refreshVaultUi);
  const connectedSites = useWalletConnectedSitesActions(showStatus, vault.refreshVaultUi);

  const handleEvmTxSubmitModeChange = async (mode: EvmTxSubmitMode) => {
    await setWalletEvmTxSubmitMode(mode);
    await vault.refreshVaultUi();
    showStatus('ok', '交易提交方式已保存');
  };

  return {
    flowMode: importForm.flowMode,
    setFlowMode: importForm.setFlowMode,
    singleImportMode: importForm.singleImportMode,
    setSingleImportMode: importForm.setSingleImportMode,
    accountLabel: importForm.accountLabel,
    setAccountLabel: importForm.setAccountLabel,
    batchMnemonicInput: importForm.batchMnemonicInput,
    setBatchMnemonicInput: importForm.setBatchMnemonicInput,
    batchPresetId: importForm.batchPresetId,
    setBatchPresetId: importForm.setBatchPresetId,
    batchHdPathTemplate: importForm.batchHdPathTemplate,
    setBatchHdPathTemplate: importForm.setBatchHdPathTemplate,
    batchHdStartIndex: importForm.batchHdStartIndex,
    setBatchHdStartIndex: importForm.setBatchHdStartIndex,
    batchHdCount: importForm.batchHdCount,
    setBatchHdCount: importForm.setBatchHdCount,
    singleMnemonicInput: importForm.singleMnemonicInput,
    setSingleMnemonicInput: importForm.setSingleMnemonicInput,
    singlePathPresetId: importForm.singlePathPresetId,
    setSinglePathPresetId: importForm.setSinglePathPresetId,
    singleHdPath: importForm.singleHdPath,
    setSingleHdPath: importForm.setSingleHdPath,
    privateKeyInput: importForm.privateKeyInput,
    setPrivateKeyInput: importForm.setPrivateKeyInput,
    password: importForm.password,
    setPassword: importForm.setPassword,
    password2: importForm.password2,
    setPassword2: importForm.setPassword2,
    accounts: vault.accounts,
    tvmAccounts: vault.tvmAccounts,
    pendingSite: pending.pendingSite,
    selectedApprovalAddress: pending.selectedApprovalAddress,
    setSelectedApprovalAddress: pending.setSelectedApprovalAddress,
    approvalChoices: vault.approvalChoices,
    authPolicy: auth.authPolicy,
    setAuthPolicy: auth.setAuthPolicy,
    authTimedMinutes: auth.authTimedMinutes,
    setAuthTimedMinutes: auth.setAuthTimedMinutes,
    status,
    handleImport: importForm.handleImport,
    handleRemoveAccount: accountMutations.handleRemoveAccount,
    handleRenameCommit: accountMutations.handleRenameCommit,
    handleMoveAccountUp: accountMutations.handleMoveAccountUp,
    handleMoveAccountDown: accountMutations.handleMoveAccountDown,
    handleClearAllAccounts: accountMutations.handleClearAllAccounts,
    handleApproveSite: pending.handleApproveSite,
    handleRejectSite: pending.handleRejectSite,
    handleSaveAuthPolicy: auth.handleSaveAuthPolicy,
    authPolicySummary: auth.authPolicySummary,
    accountsSectionSummary: vault.accountsSectionSummary,
    siteSessions: vault.siteSessions,
    connectedSitesSummary: vault.connectedSitesSummary,
    handleRevokeSiteOrigin: connectedSites.handleRevokeSiteOrigin,
    handleRevokeAllSites: connectedSites.handleRevokeAllSites,
    evmTxSubmitMode: vault.evmTxSubmitMode,
    handleEvmTxSubmitModeChange
  };
}
