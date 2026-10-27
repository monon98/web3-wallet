import { PanelSection } from '@plugin/ui';
import { useCallback, useEffect, useState } from 'react';

import { useStorageKeyRefresh } from '~/hooks/common/useStorageKeyRefresh';
import type { WalletInterfaceMode } from '~/types';
import {
  applyWalletInterfaceMode,
  DEFAULT_WALLET_INTERFACE_MODE,
  loadWalletInterfaceMode,
  saveWalletInterfaceMode,
  WALLET_INTERFACE_MODE_STORAGE_KEY
} from '~lib/walletUi/globalSettings';

/**
 * **工具栏打开方式**：在弹窗模式与侧边栏模式之间切换。
 *
 * 设置保存到 `chrome.storage.local`，并立即同步动态 action popup 与
 * `sidePanel.setPanelBehavior`；Service Worker 启动时也会重新应用，避免 Chrome
 * 持久化的旧行为覆盖用户选择。网页右键菜单「打开侧边栏」不受此设置影响。
 */

const STORAGE_KEYS = [WALLET_INTERFACE_MODE_STORAGE_KEY] as const;

const MODE_OPTIONS: readonly {
  value: WalletInterfaceMode;
  title: string;
  description: string;
}[] = [
  {
    value: 'popup',
    title: '弹窗模式（默认）',
    description: '点击工具栏图标打开弹窗；需要更大面板时，仍可从网页右键菜单打开侧边栏。'
  },
  {
    value: 'sidePanel',
    title: '侧边栏模式',
    description: '点击工具栏图标打开浏览器侧边栏；需要弹窗时，可随时在本页切回弹窗模式。'
  }
];

export function InterfaceModeSection() {
  const [mode, setMode] = useState<WalletInterfaceMode>(DEFAULT_WALLET_INTERFACE_MODE);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const next = await loadWalletInterfaceMode();
    setMode(next);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useStorageKeyRefresh(STORAGE_KEYS, refresh);

  const handleModeChange = useCallback(
    async (next: WalletInterfaceMode) => {
      if (busy || next === mode) {
        return;
      }
      setBusy(true);
      setNotice(null);
      try {
        await saveWalletInterfaceMode(next);
        const applied = await applyWalletInterfaceMode(next);
        setMode(next);
        setNotice(applied ? '已切换；下一次点击工具栏图标时生效。' : '设置已保存；若未立即生效，请重载扩展后再试。');
      } catch {
        setNotice('保存失败，请稍后重试。');
      } finally {
        setBusy(false);
      }
    },
    [busy, mode]
  );

  return (
    <PanelSection
      title='工具栏打开方式'
      description='选择点击浏览器工具栏钱包图标时的打开方式；切换会保存在本机，网页右键菜单「打开侧边栏」始终可用。'
      tone='muted'>
      <div className='mt-2 space-y-2 text-[11px]' role='radiogroup' aria-label='工具栏打开方式'>
        {MODE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className='flex cursor-pointer items-start gap-2 rounded border border-transparent px-1 py-1 hover:bg-[var(--ui-surface-1)]'>
            <input
              type='radio'
              name='wallet-interface-mode'
              className='mt-0.5'
              checked={mode === option.value}
              disabled={busy}
              onChange={() => void handleModeChange(option.value)}
            />
            <span>
              <span className='font-medium text-[var(--ui-fg)]'>{option.title}</span>
              <span className='mt-0.5 block leading-snug text-[var(--ui-muted-fg)]'>{option.description}</span>
            </span>
          </label>
        ))}
      </div>
      {notice ? <p className='mt-2 text-[11px] leading-snug text-[var(--ui-muted-fg)]'>{notice}</p> : null}
    </PanelSection>
  );
}
