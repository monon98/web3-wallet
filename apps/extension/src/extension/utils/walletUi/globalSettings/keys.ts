import { SITE_AUTH_SETTINGS_STORAGE_KEY } from '../siteAuthSettings';
import { WALLET_UI_STATE_STORAGE_KEY } from '../walletUiState';

export { SITE_AUTH_SETTINGS_STORAGE_KEY, WALLET_UI_STATE_STORAGE_KEY };

/** 扩展侧栏「全局偏好」涉及的 `chrome.storage.local` 键（链 / 会话 / 交易提交方式 + 站点授权策略默认） */
export const WALLET_GLOBAL_SETTINGS_LOCAL_STORAGE_KEYS = [
  WALLET_UI_STATE_STORAGE_KEY,
  SITE_AUTH_SETTINGS_STORAGE_KEY
] as const;
