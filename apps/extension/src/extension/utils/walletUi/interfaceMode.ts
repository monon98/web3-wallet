import type { WalletInterfaceMode } from '~/types/walletUi';
import { extLogDebug, extLogWarn } from '~lib/extensionLog';

/**
 * **工具栏打开方式**（`chrome.storage.local`）：用户可选择点击扩展图标时打开
 * **弹窗**（默认，`popup.html`）或 **侧边栏**（`sidePanel`）。
 *
 * 调用方：
 * - `background/serviceWorker.ts` 在启动 / 安装 / 升级时读取并应用；
 * - `ui/wallet/sections/interfaceModeSection.tsx` 在侧栏或弹窗内保存设置。
 *
 * 浏览器会持久化 `sidePanel.setPanelBehavior` 与动态 action popup，因此不能像旧版
 * 那样硬编码 `openPanelOnActionClick: false`；必须始终以本模块保存的用户选择为准。
 * 只保存界面偏好，不接触账户、助记词、私钥或口令。
 */

/** 用户选择存储键；侧栏、弹窗与 Service Worker 变更监听需与此一致。 */
export const WALLET_INTERFACE_MODE_STORAGE_KEY = 'web3_wallet_interface_mode_v1' as const;

export const DEFAULT_WALLET_INTERFACE_MODE: WalletInterfaceMode = 'popup';

/** Plasmo 弹窗入口；侧边栏模式需用空字符串清空，弹窗模式再恢复。 */
const WALLET_ACTION_POPUP_PATH = 'popup.html' as const;

type StoredWalletInterfaceMode = {
  mode: WalletInterfaceMode;
};

/** 兼容缺省、损坏或旧格式值；无法识别时回退到弹窗模式。 */
function coerceWalletInterfaceMode(raw: unknown): WalletInterfaceMode {
  if (raw && typeof raw === 'object') {
    const mode = (raw as Record<string, unknown>).mode;
    if (mode === 'popup' || mode === 'sidePanel') {
      return mode;
    }
  }
  return DEFAULT_WALLET_INTERFACE_MODE;
}

/** 读取用户选择；存储不可用时回退默认弹窗，不阻断扩展启动。 */
export async function loadWalletInterfaceMode(): Promise<WalletInterfaceMode> {
  try {
    const bag = await chrome.storage.local.get(WALLET_INTERFACE_MODE_STORAGE_KEY);
    return coerceWalletInterfaceMode(bag[WALLET_INTERFACE_MODE_STORAGE_KEY]);
  } catch {
    extLogWarn('wallet_interface_mode', { action: 'load', result: 'failed' });
    return DEFAULT_WALLET_INTERFACE_MODE;
  }
}

/**
 * 将模式应用到浏览器工具栏。
 *
 * `action.default_popup` 存在时 Chrome 会优先打开弹窗，单靠
 * `openPanelOnActionClick: true` 不会让工具栏图标打开侧栏。因此侧边栏模式必须
 * 同时清空动态 action popup；切回弹窗模式时恢复 `popup.html`。
 * 返回是否两处 API 都调用成功，供设置页提示使用。
 */
export async function applyWalletInterfaceMode(mode: WalletInterfaceMode): Promise<boolean> {
  const action = chrome.action;
  const sidePanel = chrome.sidePanel;
  if (!action?.setPopup || !sidePanel?.setPanelBehavior) {
    return false;
  }
  try {
    await Promise.all([
      action.setPopup({ popup: mode === 'sidePanel' ? '' : WALLET_ACTION_POPUP_PATH }),
      sidePanel.setPanelBehavior({ openPanelOnActionClick: mode === 'sidePanel' })
    ]);
    return true;
  } catch {
    extLogWarn('wallet_interface_mode', { action: 'apply', mode, result: 'failed' });
    return false;
  }
}

/** 保存用户选择。实际应用由调用方或 background 的存储变更监听完成。 */
export async function saveWalletInterfaceMode(mode: WalletInterfaceMode): Promise<void> {
  const next: StoredWalletInterfaceMode = { mode };
  await chrome.storage.local.set({ [WALLET_INTERFACE_MODE_STORAGE_KEY]: next });
  extLogDebug('wallet_interface_mode', { action: 'save', mode });
}

/** 首次安装或尚无该键时写入默认弹窗模式。 */
export async function ensureWalletInterfaceModeInitialized(): Promise<void> {
  const bag = await chrome.storage.local.get(WALLET_INTERFACE_MODE_STORAGE_KEY);
  if (bag[WALLET_INTERFACE_MODE_STORAGE_KEY] === undefined) {
    await saveWalletInterfaceMode(DEFAULT_WALLET_INTERFACE_MODE);
  }
}
