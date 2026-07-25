/**
 * **钱包 UI 持久态**（`walletUiState.ts` / `siteAuthSettings.ts`）：当前链、站点会话与授权策略。
 * `SiteAuthSession` 与 DApp **origin** 及可选 **tabId** / **expiresAt** 绑定。
 */

/** 持久：手动断开前有效 | 定时：到期失效 | 刷新：仅当前标签页，刷新或关闭标签后失效 */
export type SiteAuthPolicy = 'persistent' | 'timed' | 'per_reload';

export type SiteAuthSettings = {
  policy: SiteAuthPolicy;
  /** policy 为 timed 时生效，单位：分钟，范围 1–10080（7 天） */
  timedMinutes: number;
};

/** 单条站点授权：含该站点暴露的地址；tabId 非空表示仅该标签；expiresAt 非空表示定时过期 */
export type SiteAuthSession = {
  origin: string;
  tabId: number | null;
  expiresAt: number | null;
  address: `0x${string}`;
};

/** DApp `eth_sendTransaction` 批准后的提交方式（全局，存于钱包 UI 状态） */
export type EvmTxSubmitMode = 'signOnly' | 'signAndBroadcast';

/** 链 ID + 站点会话 + EVM 交易提交偏好 */
export type WalletUiStateV1 = {
  chainIdHex: string;
  siteAuthSessions: SiteAuthSession[];
  /** 缺省 `signAndBroadcast`，与旧版无此字段的存储兼容 */
  evmTxSubmitMode: EvmTxSubmitMode;
};

/** 侧栏全局偏好一次读取：`walletUi`（链 / 已连接站点 / 交易提交方式）与默认站点授权策略 */
export type WalletGlobalSettingsSnapshot = {
  walletUi: WalletUiStateV1;
  siteAuth: SiteAuthSettings;
};
