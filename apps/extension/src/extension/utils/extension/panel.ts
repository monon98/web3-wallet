/**
 * 占位/遗留 API，**勿**与当前侧栏 + `wallet-ui` / `vault` 流程混用；新功能勿依赖 `tools`。
 */
export const tools = {
  generateWallet: () => {
    return 'generateWallet';
  }
};

/*
 * 注意：工具栏打开方式不要在这里硬编码。用户可在侧栏「DApp 全局设置 → 工具栏打开方式」
 * 在弹窗与侧边栏之间切换；`background/serviceWorker.ts` 会读取
 * `web3_wallet_interface_mode_v1`，同步动态 action popup 与
 * `sidePanel.setPanelBehavior` 应用设置。网页右键菜单「打开侧边栏」始终可用。
 */
