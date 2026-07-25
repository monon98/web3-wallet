import type { SiteAuthPolicy, SiteAuthSettings } from '~/types/walletUi';

/**
 * **站点授权策略**（`chrome.storage.local`）：`persistent` / 限时 / **每标签刷新**（默认）。
 * 影响 `authorizeSiteSession` 写入的 `tabId` 与 `expiresAt` 形状。
 *
 * 本模块仅读写设置；策略生效时的开发日志见 `walletUiState`（`site_session`）。
 */

/** `chrome.storage.local` 键（聚合列表见 `walletUi/globalSettings` 的 `WALLET_GLOBAL_SETTINGS_LOCAL_STORAGE_KEYS`） */
export const SITE_AUTH_SETTINGS_STORAGE_KEY = 'web3_wallet_site_auth_settings_v1' as const;

const DEFAULT_SETTINGS: SiteAuthSettings = {
  policy: 'per_reload',
  timedMinutes: 60
};

function clampMinutes(n: number): number {
  if (!Number.isFinite(n)) {
    return DEFAULT_SETTINGS.timedMinutes;
  }
  return Math.min(10080, Math.max(1, Math.floor(n)));
}

function coerceSettings(raw: unknown): SiteAuthSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
  const o = raw as Record<string, unknown>;
  const p = o.policy;
  const policy: SiteAuthPolicy =
    p === 'persistent' || p === 'timed' || p === 'per_reload' ? p : DEFAULT_SETTINGS.policy;
  const timedMinutes = clampMinutes(
    typeof o.timedMinutes === 'number' ? o.timedMinutes : DEFAULT_SETTINGS.timedMinutes
  );
  return { policy, timedMinutes };
}

export async function loadSiteAuthSettings(): Promise<SiteAuthSettings> {
  const bag = await chrome.storage.local.get(SITE_AUTH_SETTINGS_STORAGE_KEY);
  return coerceSettings(bag[SITE_AUTH_SETTINGS_STORAGE_KEY]);
}

export async function saveSiteAuthSettings(settings: SiteAuthSettings): Promise<void> {
  const next: SiteAuthSettings = {
    policy: settings.policy,
    timedMinutes: clampMinutes(settings.timedMinutes)
  };
  await chrome.storage.local.set({ [SITE_AUTH_SETTINGS_STORAGE_KEY]: next });
}

export async function ensureSiteAuthSettingsInitialized(): Promise<void> {
  const bag = await chrome.storage.local.get(SITE_AUTH_SETTINGS_STORAGE_KEY);
  if (bag[SITE_AUTH_SETTINGS_STORAGE_KEY] === undefined) {
    await saveSiteAuthSettings(DEFAULT_SETTINGS);
  }
}
