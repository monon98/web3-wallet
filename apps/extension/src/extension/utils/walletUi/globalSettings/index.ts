/**
 * **扩展全局偏好统一入口**：链 ID、自定义 RPC 链、已连接站点会话、`evmTxSubmitMode`、**工具栏打开方式**、站点授权策略默认，以及侧栏对会话的撤销/重置。
 * 底层由 `walletUiState.ts`、`customEvmChains.ts`、`interfaceMode.ts` 与 `siteAuthSettings.ts` 读写；此处聚合键名、初始化、快照读取与常用 API，供侧栏与扩展页（tabs）、`hooks/`、Service Worker 共用。
 */

export {
  WALLET_GLOBAL_SETTINGS_LOCAL_STORAGE_KEYS,
  CUSTOM_EVM_CHAINS_STORAGE_KEY,
  SITE_AUTH_SETTINGS_STORAGE_KEY,
  WALLET_INTERFACE_MODE_STORAGE_KEY,
  WALLET_UI_STATE_STORAGE_KEY
} from './keys';

export { loadWalletGlobalSettingsSnapshot } from './snapshot';
export { ensureWalletGlobalSettingsInitialized } from './ensure';

export {
  applyWalletInterfaceMode,
  DEFAULT_WALLET_INTERFACE_MODE,
  ensureWalletInterfaceModeInitialized,
  loadWalletInterfaceMode,
  saveWalletInterfaceMode
} from '../interfaceMode';

export { ensureSiteAuthSettingsInitialized, loadSiteAuthSettings, saveSiteAuthSettings } from '../siteAuthSettings';

export {
  ensureWalletUiStateInitialized,
  loadWalletUiState,
  normalizeChainIdHexInput,
  resetWalletUiStateToDefaults,
  revokeAllSiteAuthSessions,
  revokeSiteSessionOrigin,
  saveWalletUiState,
  setWalletChainIdHex,
  setWalletEvmTxSubmitMode
} from '../walletUiState';
