import type { PendingSiteConnect } from './bridge';
import type { TvmAccountSummary, WalletAccountSummary } from './vault';
import type { WalletConnectChoice, WalletImportFlowMode, WalletImportMode, WalletPanelView } from './walletPanel';
import type { EvmTxSubmitMode, SiteAuthPolicy, SiteAuthSession } from './walletUi';

/** `sections/evmTxSubmitModeSection`：与站点策略区一致的 `panel` | `plain` */
export type EvmTxSubmitModeSectionProps = {
  variant?: 'panel' | 'plain';
  evmTxSubmitMode: EvmTxSubmitMode;
  onEvmTxSubmitModeChange: (mode: EvmTxSubmitMode) => void | Promise<void>;
};

/**
 * 钱包侧栏 / 弹窗 **各区块组件的 props**；UI 实现在 `ui/wallet/`，状态机在 `hooks/useWalletPanel` 等。
 */

export type WalletPageHeaderProps = {
  title?: string;
  /** 传入时在标题左侧显示返回（子页 → 概览） */
  onBack?: () => void;
};

/** 概览首页：进入各子页与工具页的入口（默认 EVM/TVM 账户见「DApp 全局设置」） */
export type WalletHomeOverviewProps = {
  hasEvmAccounts: boolean;
  accountsSectionSummary: string;
  connectedSitesSummary: string;
  authPolicySummary: string;
  evmTxSubmitMode: EvmTxSubmitMode;
  onNavigate: (view: Exclude<WalletPanelView, 'overview'>) => void;
};

/** `sections/defaultChainAccountsSection`：vault 列表首项作为默认 */
export type DefaultChainAccountsSectionProps = {
  evmDefaultAccount: WalletAccountSummary | null;
  tvmDefaultAccount: TvmAccountSummary | null;
};

export type StatusBannerProps = {
  kind: 'idle' | 'ok' | 'err';
  text: string;
};

export type SiteAuthPolicySectionProps = {
  /** plain：用于折叠区内，去掉外层 Panel 与长说明 */
  variant?: 'panel' | 'plain';
  authPolicy: SiteAuthPolicy;
  onPolicyChange: (p: SiteAuthPolicy) => void;
  authTimedMinutes: string;
  onTimedMinutesChange: (v: string) => void;
  onSave: () => void;
};

export type AccountsListSectionProps = {
  variant?: 'panel' | 'plain';
  accounts: WalletAccountSummary[];
  /** 保存新显示名（由列表内联编辑提交） */
  onRenameCommit: (id: string, label: string) => void | Promise<void>;
  onMoveUp: (id: string) => void | Promise<void>;
  onMoveDown: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void;
  onClearAll: () => void;
};

export type ImportAccountSectionProps = {
  variant?: 'panel' | 'plain';
  flowMode: WalletImportFlowMode;
  onFlowModeChange: (m: WalletImportFlowMode) => void;
  /** 导入一个：助记词 / 私钥 */
  singleImportMode: WalletImportMode;
  onSingleImportModeChange: (m: WalletImportMode) => void;
  accountLabel: string;
  onAccountLabelChange: (v: string) => void;
  /** 批量导入：助记词输入 */
  batchMnemonicInput: string;
  onBatchMnemonicChange: (v: string) => void;
  /** 批量导入：配置选择（预置/自定义） */
  batchPresetId: string;
  onBatchPresetIdChange: (v: string) => void;
  /** 批量导入：HD 路径模板（支持 `{index}`），选择“自定义”时可编辑 */
  batchHdPathTemplate: string;
  onBatchHdPathTemplateChange: (v: string) => void;
  batchHdStartIndex: string;
  onBatchHdStartIndexChange: (v: string) => void;
  batchHdCount: string;
  onBatchHdCountChange: (v: string) => void;
  /** 导入一个：助记词输入 + 可选派生路径 */
  singleMnemonicInput: string;
  onSingleMnemonicChange: (v: string) => void;
  singlePathPresetId: string;
  onSinglePathPresetIdChange: (v: string) => void;
  singleHdPath: string;
  onSingleHdPathChange: (v: string) => void;
  privateKeyInput: string;
  onPrivateKeyChange: (v: string) => void;
  password: string;
  onPasswordChange: (v: string) => void;
  password2: string;
  onPassword2Change: (v: string) => void;
  onSubmit: () => void;
};

export type PendingConnectSectionProps = {
  pending: PendingSiteConnect;
  choices: WalletConnectChoice[];
  selectedAddress: string;
  onSelectAddress: (address: string) => void;
  onApprove: () => void;
  onReject: () => void;
};

export type ConnectedSitesSectionProps = {
  variant?: 'panel' | 'plain';
  sessions: readonly SiteAuthSession[];
  onRevokeOrigin: (origin: string) => void;
  onRevokeAll: () => void;
};

/** 单页聚合：默认 EVM/TVM 账户、全局交易提交方式、已连接网站、站点授权策略 */
export type WalletViewGlobalSettingsProps = DefaultChainAccountsSectionProps &
  EvmTxSubmitModeSectionProps &
  Omit<ConnectedSitesSectionProps, 'variant'> &
  Omit<SiteAuthPolicySectionProps, 'variant'>;
