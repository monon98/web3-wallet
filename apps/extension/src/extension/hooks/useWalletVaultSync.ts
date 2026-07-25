import { useCallback, useEffect, useMemo, useState } from 'react';

import type { EvmTxSubmitMode, SiteAuthSession, TvmAccountSummary, WalletAccountSummary } from '~/types';
import { listWalletAccountSummaries, WALLET_ACCOUNTS_BUNDLE_STORAGE_KEY } from '~lib/vault/record';
import { listTvmAccountSummaries, TVM_ACCOUNTS_BUNDLE_STORAGE_KEY } from '~lib/vault/tvmRecord';
import { loadWalletUiState, WALLET_UI_STATE_STORAGE_KEY } from '~lib/walletUi/globalSettings';

import { useStorageKeyRefresh } from './common/useStorageKeyRefresh';
import { accountsSectionSummaryText, buildApprovalChoices, connectedSitesSummaryText } from './walletPanelHelpers';

/**
 * **Vault + 钱包 UI 会话** 列表同步：初次拉取、`chrome.storage.local` 变更时刷新；供摘要与审批选项�?
 */
export function useWalletVaultSync() {
  const [accounts, setAccounts] = useState<WalletAccountSummary[]>([]);
  const [tvmAccounts, setTvmAccounts] = useState<TvmAccountSummary[]>([]);
  const [siteSessions, setSiteSessions] = useState<SiteAuthSession[]>([]);
  const [evmTxSubmitMode, setEvmTxSubmitMode] = useState<EvmTxSubmitMode>('signAndBroadcast');

  const refreshVaultUi = useCallback(async () => {
    const [list, tvmList] = await Promise.all([listWalletAccountSummaries(), listTvmAccountSummaries()]);
    setAccounts(list);
    setTvmAccounts(tvmList);
    const s = await loadWalletUiState();
    setSiteSessions([...s.siteAuthSessions]);
    setEvmTxSubmitMode(s.evmTxSubmitMode);
  }, []);

  const approvalChoices = useMemo(() => buildApprovalChoices(accounts), [accounts]);

  const accountsSectionSummary = useMemo(() => accountsSectionSummaryText(accounts), [accounts]);

  const connectedSitesSummary = useMemo(() => connectedSitesSummaryText(siteSessions.length), [siteSessions.length]);

  useEffect(() => {
    void refreshVaultUi();
  }, [refreshVaultUi]);

  useStorageKeyRefresh(
    [WALLET_ACCOUNTS_BUNDLE_STORAGE_KEY, TVM_ACCOUNTS_BUNDLE_STORAGE_KEY, WALLET_UI_STATE_STORAGE_KEY],
    refreshVaultUi
  );

  return {
    accounts,
    tvmAccounts,
    siteSessions,
    evmTxSubmitMode,
    refreshVaultUi,
    approvalChoices,
    accountsSectionSummary,
    connectedSitesSummary
  };
}
