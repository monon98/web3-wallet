import { CUSTOM_EVM_CHAINS_STORAGE_KEY } from '../customEvmChains';
import { SITE_AUTH_SETTINGS_STORAGE_KEY } from '../siteAuthSettings';
import { WALLET_UI_STATE_STORAGE_KEY } from '../walletUiState';

export { CUSTOM_EVM_CHAINS_STORAGE_KEY, SITE_AUTH_SETTINGS_STORAGE_KEY, WALLET_UI_STATE_STORAGE_KEY };

/** 扩展侧栏「全局偏好」涉及的 `chrome.storage.local` 键（链 / 自定义 RPC / 会话 / 交易提交方式 + 站点授权策略默认） */
export const WALLET_GLOBAL_SETTINGS_LOCAL_STORAGE_KEYS = [
  WALLET_UI_STATE_STORAGE_KEY,
  CUSTOM_EVM_CHAINS_STORAGE_KEY,
  SITE_AUTH_SETTINGS_STORAGE_KEY
] as const;
