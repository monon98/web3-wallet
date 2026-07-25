import { useCallback, useEffect, useState } from 'react';

import type { TvmAccountSummary } from '~/types';
import { listTvmAccountSummaries, TVM_ACCOUNTS_BUNDLE_STORAGE_KEY } from '~lib/vault/tvmRecord';

import { useStorageKeyRefresh } from './common/useStorageKeyRefresh';

/**
 * **TVM Vault 列表同步**：初次拉取、`chrome.storage.local` 变更时刷新；供 TVM 管理页展示。
 */
export function useTvmVaultSync() {
  const [accounts, setAccounts] = useState<TvmAccountSummary[]>([]);

  const refreshVaultUi = useCallback(async () => {
    const list = await listTvmAccountSummaries();
    setAccounts(list);
  }, []);

  useEffect(() => {
    void refreshVaultUi();
  }, [refreshVaultUi]);

  useStorageKeyRefresh([TVM_ACCOUNTS_BUNDLE_STORAGE_KEY], refreshVaultUi);

  return { accounts, refreshVaultUi };
}
