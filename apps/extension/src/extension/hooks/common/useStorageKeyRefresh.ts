import { useEffect } from 'react';

/**
 * 监听 `chrome.storage.onChanged`：当指定 key 发生变化时触发 `refresh`。
 * 用于 vault bundle / UI state 变更时同步 React 状态。
 */
export function useStorageKeyRefresh(keys: readonly string[], refresh: () => void | Promise<void>) {
  useEffect(() => {
    const onLocal = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area !== 'local') {
        return;
      }
      if (keys.some((k) => k in changes)) {
        void refresh();
      }
    };
    chrome.storage.onChanged.addListener(onLocal);
    return () => chrome.storage.onChanged.removeListener(onLocal);
  }, [keys, refresh]);
}
