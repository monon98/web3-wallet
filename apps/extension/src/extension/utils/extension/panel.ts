/**
 * 占位/遗留 API，**勿**与当前侧栏 + `wallet-ui` / `vault` 流程混用；新功能勿依赖 `tools`。
 */
export const tools = {
  generateWallet: () => {
    return 'generateWallet';
  }
};

/*
 * 注意：不要在这里调用 `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`。
 * 它会把工具栏图标点击改为打开侧栏，并跳过 `action.default_popup`，导致弹窗模式无法打开。
 * 当前由 `background/serviceWorker.ts` 在安装 / 启动时显式设为 `false` 重置旧状态；
 * 侧栏入口统一走右键菜单「打开侧边栏」。
 */
