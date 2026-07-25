/**
 * 新开 **普通标签**打开扩展内页面；`path` 可为 `tabs/foo.html` 或已是 `chrome-extension://` 完整 URL。
 * 未包装 `tabs.create` 的 Promise/回调，创建失败时无内置日志，需在 `chrome://extensions` 查看错误。
 */
export const openTab = (path: string) => {
  const url = path.includes('://') ? path : chrome.runtime.getURL(path.replace(/^\//, ''));
  chrome.tabs.create({ url });
};
