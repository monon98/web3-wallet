import type { EvmTxSubmitMode, SiteAuthSession, SiteAuthSettings, WalletUiStateV1 } from '~/types/walletUi';
import { extLogDebug, extLogInfo } from '~lib/extensionLog';
import { listWalletAccountSummaries } from '~lib/vault/record';
import { loadSiteAuthSettings } from '~lib/walletUi/siteAuthSettings';
import { getAddress } from '~web3/evm/viem';

/**
 * **钱包 UI 持久�?*（`chrome.storage.local`）：当前�?ID（`chainIdHex`）与 **站点会话**列表�?
 * 会话�?**origin** 绑定，并可按策略绑定 **tab** 或过期时间（�?`siteAuthSettings` + `authorizeSiteSession`）�?
 * `loadWalletUiState` 会修剪过期会话、剔�?vault 中已删除账户对应的会话�?
 *
 * 侧栏 React 应监�?{@link WALLET_UI_STATE_STORAGE_KEY} 以刷新「已连接站点」等 UI�?
 *
 * 开发日志：`site_session`（授�?撤销）、`wallet_chain_set`（切换网络）、`wallet_ui_pruned`（读状态时自动修剪写回）；可记 **origin**�?*policy**，勿记录口令或私钥�?
 */

/** 当前 `chrome.storage.local` 键；侧栏监听变更时需与此一�?*/
export const WALLET_UI_STATE_STORAGE_KEY = 'web3_wallet_ui_v1' as const;

const DEFAULT_WALLET_UI_STATE: WalletUiStateV1 = {
  chainIdHex: '0x1',
  siteAuthSessions: [],
  evmTxSubmitMode: 'signAndBroadcast'
};

function coerceWalletUiState(raw: unknown): WalletUiStateV1 {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WALLET_UI_STATE };
  }
  const o = raw as Record<string, unknown>;
  const chainIdHex =
    typeof o.chainIdHex === 'string' && o.chainIdHex.startsWith('0x')
      ? o.chainIdHex
      : DEFAULT_WALLET_UI_STATE.chainIdHex;

  const evmTxSubmitMode: EvmTxSubmitMode = o.evmTxSubmitMode === 'signOnly' ? 'signOnly' : 'signAndBroadcast';

  const sessionsRaw = o.siteAuthSessions;
  if (!Array.isArray(sessionsRaw)) {
    return { chainIdHex, siteAuthSessions: [], evmTxSubmitMode };
  }

  const siteAuthSessions: SiteAuthSession[] = [];
  for (const item of sessionsRaw) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const s = item as Record<string, unknown>;
    if (typeof s.origin !== 'string') {
      continue;
    }
    const tabId = s.tabId === null || s.tabId === undefined ? null : typeof s.tabId === 'number' ? s.tabId : null;
    const expiresAt =
      s.expiresAt === null || s.expiresAt === undefined ? null : typeof s.expiresAt === 'number' ? s.expiresAt : null;
    if (typeof s.address !== 'string') {
      continue;
    }
    try {
      const address = getAddress(s.address as `0x${string}`);
      siteAuthSessions.push({ origin: s.origin, tabId, expiresAt, address });
    } catch {
      continue;
    }
  }
  return { chainIdHex, siteAuthSessions, evmTxSubmitMode };
}

async function pruneExpiredSessions(state: WalletUiStateV1): Promise<WalletUiStateV1> {
  const now = Date.now();
  const next = state.siteAuthSessions.filter((sess) => sess.expiresAt === null || sess.expiresAt > now);
  if (next.length !== state.siteAuthSessions.length) {
    const removedCount = state.siteAuthSessions.length - next.length;
    const updated = { ...state, siteAuthSessions: next };
    await saveWalletUiState(updated);
    extLogDebug('wallet_ui_pruned', { reason: 'expired_sessions', removedCount });
    return updated;
  }
  return state;
}

/** 无本地账户时清空站点会话；有账户时去掉已删除账户对应的会�?*/
async function pruneSessionsAgainstVault(state: WalletUiStateV1): Promise<WalletUiStateV1> {
  const metas = await listWalletAccountSummaries();
  if (metas.length === 0) {
    if (state.siteAuthSessions.length === 0) {
      return state;
    }
    const removedCount = state.siteAuthSessions.length;
    const next = { ...state, siteAuthSessions: [] };
    await saveWalletUiState(next);
    extLogDebug('wallet_ui_pruned', { reason: 'no_vault_accounts', removedCount });
    return next;
  }
  const allowed = new Set(metas.map((m) => m.address.toLowerCase()));
  const nextSessions = state.siteAuthSessions.filter((sess) => allowed.has(sess.address.toLowerCase()));
  if (nextSessions.length === state.siteAuthSessions.length) {
    return state;
  }
  const removedCount = state.siteAuthSessions.length - nextSessions.length;
  const next = { ...state, siteAuthSessions: nextSessions };
  await saveWalletUiState(next);
  extLogDebug('wallet_ui_pruned', { reason: 'session_address_not_in_vault', removedCount });
  return next;
}

/** 读取并合并修剪：过期时间、`listWalletAccountSummaries` 对齐�?*/
export async function loadWalletUiState(): Promise<WalletUiStateV1> {
  const bag = await chrome.storage.local.get(WALLET_UI_STATE_STORAGE_KEY);
  const base = coerceWalletUiState(bag[WALLET_UI_STATE_STORAGE_KEY]);
  const prunedTime = await pruneExpiredSessions(base);
  return pruneSessionsAgainstVault(prunedTime);
}

/** 全量覆盖写入（调用方需基于 `loadWalletUiState` 合并后再改字段）�?*/
export async function saveWalletUiState(state: WalletUiStateV1): Promise<void> {
  await chrome.storage.local.set({ [WALLET_UI_STATE_STORAGE_KEY]: state });
}

/** 规范�?chainId �?EIP-155 十六进制字符串（�?0x1）�?*/
export function normalizeChainIdHexInput(raw: string): `0x${string}` | null {
  if (typeof raw !== 'string' || !raw.startsWith('0x')) {
    return null;
  }
  try {
    const n = BigInt(raw);
    if (n <= 0n) {
      return null;
    }
    return `0x${n.toString(16)}` as `0x${string}`;
  } catch {
    return null;
  }
}

/** 更新当前钱包网络（持久化）；用于 EIP-3326 / EIP-3085�?*/
export async function setWalletChainIdHex(chainIdHex: `0x${string}`): Promise<WalletUiStateV1> {
  const s = await loadWalletUiState();
  const next = { ...s, chainIdHex };
  await saveWalletUiState(next);
  extLogDebug('wallet_chain_set', { chainIdHex });
  return next;
}

/** 全局：`eth_sendTransaction` 仅返回已签名 RLP，或签名后由内置 RPC 广播。 */
export async function setWalletEvmTxSubmitMode(mode: EvmTxSubmitMode): Promise<WalletUiStateV1> {
  const s = await loadWalletUiState();
  const next = { ...s, evmTxSubmitMode: mode };
  await saveWalletUiState(next);
  extLogDebug('wallet_evm_tx_submit_mode_set', { mode });
  return next;
}

/** 首次安装或尚无该键时写入默认状�?*/
export async function ensureWalletUiStateInitialized(): Promise<void> {
  const bag = await chrome.storage.local.get(WALLET_UI_STATE_STORAGE_KEY);
  if (bag[WALLET_UI_STATE_STORAGE_KEY] === undefined) {
    await saveWalletUiState({ ...DEFAULT_WALLET_UI_STATE });
  }
}

function sessionMatchesTab(sess: SiteAuthSession, tabId: number): boolean {
  if (sess.tabId === null) {
    return true;
  }
  return sess.tabId === tabId;
}

export function isOriginAuthorizedInState(state: WalletUiStateV1, origin: string, tabId: number): boolean {
  const now = Date.now();
  return state.siteAuthSessions.some((sess) => {
    if (sess.origin !== origin) {
      return false;
    }
    if (sess.expiresAt !== null && sess.expiresAt <= now) {
      return false;
    }
    return sessionMatchesTab(sess, tabId);
  });
}

/** 是否存在未过期且对当�?`tabId` 有效的会话（`tabId` 策略�?`SiteAuthSession.tabId`）�?*/
export async function isSiteOriginAuthorized(origin: string, tabId: number): Promise<boolean> {
  const s = await loadWalletUiState();
  return isOriginAuthorizedInState(s, origin, tabId);
}

function findMatchingSession(state: WalletUiStateV1, origin: string, tabId: number): SiteAuthSession | undefined {
  const now = Date.now();
  return state.siteAuthSessions.find((sess) => {
    if (sess.origin !== origin) {
      return false;
    }
    if (sess.expiresAt !== null && sess.expiresAt <= now) {
      return false;
    }
    return sessionMatchesTab(sess, tabId);
  });
}

/**
 * 按当前「站点授权策略」写入一条授权（会替换同 origin 的已有条目）�?
 */
export async function authorizeSiteSession(
  origin: string,
  tabId: number,
  settings: SiteAuthSettings | undefined,
  authorizedAddress: `0x${string}`
): Promise<WalletUiStateV1> {
  const cfg = settings ?? (await loadSiteAuthSettings());
  const s = await loadWalletUiState();
  const now = Date.now();
  let sessionTabId: number | null;
  let expiresAt: number | null;

  if (cfg.policy === 'persistent') {
    sessionTabId = null;
    expiresAt = null;
  } else if (cfg.policy === 'timed') {
    sessionTabId = null;
    expiresAt = now + cfg.timedMinutes * 60_000;
  } else {
    sessionTabId = tabId;
    expiresAt = null;
  }

  const addr = getAddress(authorizedAddress);
  const rest = s.siteAuthSessions.filter((x) => x.origin !== origin);
  rest.push({ origin, tabId: sessionTabId, expiresAt, address: addr });
  const next = { ...s, siteAuthSessions: rest };
  await saveWalletUiState(next);
  extLogInfo('site_session', { action: 'authorize', origin, policy: cfg.policy });
  return next;
}

export async function revokeSiteSessionOrigin(origin: string): Promise<WalletUiStateV1> {
  const s = await loadWalletUiState();
  const next = {
    ...s,
    siteAuthSessions: s.siteAuthSessions.filter((x) => x.origin !== origin)
  };
  await saveWalletUiState(next);
  extLogInfo('site_session', { action: 'revoke_origin', origin });
  return next;
}

/** 撤销所有站点连接（不影响本地加密账户）�?*/
export async function revokeAllSiteAuthSessions(): Promise<WalletUiStateV1> {
  const s = await loadWalletUiState();
  const next: WalletUiStateV1 = { ...s, siteAuthSessions: [] };
  await saveWalletUiState(next);
  extLogInfo('site_session', { action: 'revoke_all' });
  return next;
}

/** 标签页关闭或刷新导致：移除绑定到�?tab 的会�?*/
export async function revokeSiteAuthSessionsForTab(tabId: number): Promise<void> {
  const s = await loadWalletUiState();
  const next = {
    ...s,
    siteAuthSessions: s.siteAuthSessions.filter((sess) => sess.tabId !== tabId)
  };
  if (next.siteAuthSessions.length !== s.siteAuthSessions.length) {
    const removedCount = s.siteAuthSessions.length - next.siteAuthSessions.length;
    extLogDebug('site_session', { action: 'revoke_tab', tabId, removedCount });
    await saveWalletUiState(next);
  }
}

/** 已连接时返回单元素地址数组（本实现�?origin 仅保留一�?active 地址）；未连接返�?`[]`�?*/
export async function getSiteSessionAccountsForOrigin(origin: string, tabId: number): Promise<readonly string[]> {
  const s = await loadWalletUiState();
  const sess = findMatchingSession(s, origin, tabId);
  if (!sess) {
    return [];
  }
  return [sess.address];
}

/** 清空站点授权并保留当前链 ID（删除全部本地账户后调用�?*/
export async function resetWalletUiStateToDefaults(): Promise<void> {
  const s = await loadWalletUiState();
  await saveWalletUiState({
    ...s,
    siteAuthSessions: []
  });
  extLogInfo('site_session', { action: 'reset_sessions_keep_chain' });
}
