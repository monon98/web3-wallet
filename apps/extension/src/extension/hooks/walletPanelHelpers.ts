import type { EvmTxSubmitMode, SiteAuthPolicy, WalletAccountSummary, WalletConnectChoice } from '~/types';

/**
 * **纯函数**：侧栏摘要文案与连接审批下拉选项，供 vault 同步 hook 的 `useMemo` 使用（无 React 依赖）。
 */
export function buildApprovalChoices(accounts: WalletAccountSummary[]): WalletConnectChoice[] {
  if (accounts.length === 0) {
    return [];
  }
  return accounts.map((a) => ({
    key: a.id,
    label: `${a.label} · ${a.address.slice(0, 6)}…${a.address.slice(-4)}`,
    address: a.address
  }));
}

export function accountsSectionSummaryText(accounts: WalletAccountSummary[]): string {
  const n = accounts.length;
  if (n === 0) {
    return '未添加账户';
  }
  const primary = accounts[0].address;
  const short = `${primary.slice(0, 6)}…${primary.slice(-4)}`;
  return `${n} 个账户 · ${short}`;
}

export function connectedSitesSummaryText(siteSessionsLength: number): string {
  if (siteSessionsLength === 0) {
    return '无已连接网站';
  }
  return `${siteSessionsLength} 个站点`;
}

/** 概览单行摘要：交易提交方式 */
export function evmTxSubmitSummaryText(mode: EvmTxSubmitMode): string {
  return mode === 'signOnly' ? '交易：仅签名' : '交易：签名并广播';
}

export function authPolicySummaryText(authPolicy: SiteAuthPolicy, authTimedMinutes: string): string {
  if (authPolicy === 'per_reload') {
    return '当前标签：刷新或关标签后需重连';
  }
  if (authPolicy === 'timed') {
    return `定时：${authTimedMinutes} 分钟后过期`;
  }
  return '持久：点「断开」前一直有效';
}
