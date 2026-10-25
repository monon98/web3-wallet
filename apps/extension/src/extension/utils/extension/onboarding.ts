/**
 * **首次安装 / 升级引导**：构造引导页 URL、解析展示上下文，并在扩展安装或版本变化时打开欢迎页。
 *
 * 调用方：
 * - `background/serviceWorker.ts` 的 `chrome.runtime.onInstalled`；
 * - `tabs/welcome.tsx` 读取 URL 参数并展示对应文案。
 *
 * 信任边界：本模块只读写版本号（`web3_wallet_onboarding_launch_v1`），不接触账户、助记词、私钥或口令。
 * 同一版本只在首次安装 / 升级时自动打开一次，避免开发态重载反复弹页。
 */

export const ONBOARDING_PAGE_PATH = 'tabs/welcome.html' as const;

/** 仅保存最近一次自动打开引导页的扩展版本，用于去重。 */
export const ONBOARDING_LAUNCH_STORAGE_KEY = 'web3_wallet_onboarding_launch_v1' as const;

export type OnboardingMode = 'install' | 'update' | 'manual';

export type OnboardingLaunchParams = {
  mode: Exclude<OnboardingMode, 'manual'>;
  version: string;
  previousVersion?: string;
};

export type OnboardingContext = {
  mode: OnboardingMode;
  version: string;
  /** 更新前版本；安装、手动打开或参数非法时为 `null`。 */
  previousVersion: string | null;
};

type OnboardingLaunchState = {
  lastVersion: string;
};

/** 版本号来自 manifest / URL；限制长度，避免异常查询串把页面撑坏。 */
function normalizeVersion(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const value = raw.trim();
  return value !== '' && value.length <= 32 ? value : null;
}

/** 从扩展页查询串解析安装 / 升级模式；无参数时按「手动查看指南」处理。 */
export function parseOnboardingContext(search: string, fallbackVersion: string): OnboardingContext {
  const params = new URLSearchParams(search);
  const rawMode = params.get('mode');
  const mode: OnboardingMode = rawMode === 'install' || rawMode === 'update' ? rawMode : 'manual';
  const version = normalizeVersion(params.get('version')) ?? normalizeVersion(fallbackVersion) ?? 'unknown';
  const previous = normalizeVersion(params.get('from'));

  return {
    mode,
    version,
    previousVersion: previous !== null && previous !== version ? previous : null
  };
}

/** 在完整扩展页 URL 上设置引导参数；`baseUrl` 由调用方传入，便于单测。 */
export function buildOnboardingUrl(baseUrl: string, params: OnboardingLaunchParams): string {
  const url = new URL(baseUrl);
  url.searchParams.set('mode', params.mode);
  url.searchParams.set('version', params.version);

  const previous = normalizeVersion(params.previousVersion);
  if (previous !== null) {
    url.searchParams.set('from', previous);
  }
  return url.toString();
}

async function readLastLaunchVersion(): Promise<string | null> {
  try {
    const bag = await chrome.storage.local.get(ONBOARDING_LAUNCH_STORAGE_KEY);
    const state = bag[ONBOARDING_LAUNCH_STORAGE_KEY] as Partial<OnboardingLaunchState> | undefined;
    return normalizeVersion(state?.lastVersion);
  } catch {
    return null;
  }
}

/**
 * 安装或升级后打开引导页。
 *
 * - 首次安装：前台打开，引导用户先阅读备份与安全须知；
 * - 版本升级：后台打开，避免打断用户当前页面；侧栏也保留常驻入口；
 * - 同一版本重复触发（如开发态重载）不重复打开。
 *
 * @returns 是否实际打开了一个新的引导页。
 */
export async function maybeOpenOnboardingTab(details: chrome.runtime.InstalledDetails): Promise<boolean> {
  const reason = details.reason;
  if (reason !== 'install' && reason !== 'update') {
    return false;
  }

  const version = normalizeVersion(chrome.runtime.getManifest().version) ?? 'unknown';
  if ((await readLastLaunchVersion()) === version) {
    return false;
  }

  const url = buildOnboardingUrl(chrome.runtime.getURL(ONBOARDING_PAGE_PATH), {
    mode: reason,
    version,
    previousVersion: details.previousVersion
  });

  await chrome.tabs.create({ url, active: reason === 'install' });

  try {
    await chrome.storage.local.set({
      [ONBOARDING_LAUNCH_STORAGE_KEY]: { lastVersion: version } satisfies OnboardingLaunchState
    });
  } catch {
    // 记录失败不影响已经打开的引导页；下次升级最多重复打开一次。
  }

  return true;
}
