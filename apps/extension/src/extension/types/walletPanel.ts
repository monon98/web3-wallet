/**
 * 钱包 **面板业务枚举**（导入方式、连接选项）；与 `useWalletPanel` 状态字段对应，不含持久化 JSON 形状。
 */

/** EVM 导入页模式：批量导入（仅助记词）或导入一个（助记词/私钥） */
export type WalletImportFlowMode = 'batch' | 'single';

/** 单条导入的来源类型 */
export type WalletImportMode = 'mnemonic' | 'privateKey';

export type WalletConnectChoice = { key: string; label: string; address: string };

/** 钱包面板一级路由：概览首页与功能子页（`settings`：交易提交方式 + 已连接站点 + 站点授权策略） */
export type WalletPanelView = 'overview' | 'settings';
