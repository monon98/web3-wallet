import { ensureWalletInterfaceModeInitialized } from '../interfaceMode';
import { ensureSiteAuthSettingsInitialized } from '../siteAuthSettings';
import { ensureWalletUiStateInitialized } from '../walletUiState';

/** 安装 / 启动时并行确保默认存储存在（钱包 UI、界面模式与站点授权策略） */
export async function ensureWalletGlobalSettingsInitialized(): Promise<void> {
  await Promise.all([
    ensureWalletUiStateInitialized(),
    ensureSiteAuthSettingsInitialized(),
    ensureWalletInterfaceModeInitialized()
  ]);
}
