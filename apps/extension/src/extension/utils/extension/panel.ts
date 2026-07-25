/**
 * 占位/遗留 API，**勿**与当前侧栏 + `wallet-ui` / `vault` 流程混用；新功能勿依赖 `tools`。
 */
export const tools = {
  generateWallet: () => {
    return 'generateWallet';
  }
};

/**
 * 确保点击工具栏图标时打开侧栏（与 `background` 内 `setPanelBehavior` 语义一致，可重复调用）。
 */
export const switchSidePanel = (_tabId: number) => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {
    void chrome.runtime.lastError;
  });
};
