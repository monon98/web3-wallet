import type { WalletGlobalSettingsSnapshot } from '~/types/walletUi';

import { loadSiteAuthSettings } from '../siteAuthSettings';
import { loadWalletUiState } from '../walletUiState';

/** 并行读取钱包 UI 状态与站点授权策略默认（一次 `Promise.all`） */
export async function loadWalletGlobalSettingsSnapshot(): Promise<WalletGlobalSettingsSnapshot> {
  const [walletUi, siteAuth] = await Promise.all([loadWalletUiState(), loadSiteAuthSettings()]);
  return { walletUi, siteAuth };
}
