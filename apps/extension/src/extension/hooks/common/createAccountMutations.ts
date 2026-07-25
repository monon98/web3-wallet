import { useCallback } from 'react';

import { extLogDebug } from '~lib/extensionLog';

import type { PanelStatus } from '../usePanelStatus';

type ShowStatus = (kind: PanelStatus['kind'], text: string) => void;

export type CreateAccountMutationsConfig = {
  confirmRemoveText: string;
  confirmClearAllText: string;
  remove: (id: string) => Promise<void>;
  rename: (id: string, label: string) => Promise<void>;
  moveUp: (id: string) => Promise<void>;
  moveDown: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;

  afterRemove: (id: string) => Promise<{ okText: string; logAction: string }>;
  afterRename?: (id: string, label: string) => Promise<{ okText: string; logAction: string }>;
  afterMoveUp?: (id: string) => Promise<{ okText: string; logAction: string }>;
  afterMoveDown?: (id: string) => Promise<{ okText: string; logAction: string }>;
  afterClearAll: () => Promise<{ okText: string; logAction: string }>;
};

/**
 * 钱包域通用 mutations：确认弹窗 + record 操作 + 反馈 + 刷新。
 * 差异通过 `after*` 钩子注入（例如：删除最后一个 EVM 账户需要顺便清空站点授权）。
 */
export function createAccountMutations(
  showStatus: ShowStatus,
  refreshVaultUi: () => Promise<void>,
  cfg: CreateAccountMutationsConfig
) {
  const handleRemoveAccount = useCallback(
    async (id: string) => {
      if (!confirm(cfg.confirmRemoveText)) {
        return;
      }
      await cfg.remove(id);
      const { okText, logAction } = await cfg.afterRemove(id);
      showStatus('ok', okText);
      extLogDebug('panel_action', { action: logAction });
      await refreshVaultUi();
    },
    [cfg, refreshVaultUi, showStatus]
  );

  const handleRenameCommit = useCallback(
    async (id: string, label: string) => {
      await cfg.rename(id, label);
      const { okText, logAction } = cfg.afterRename
        ? await cfg.afterRename(id, label)
        : { okText: '已重命名', logAction: 'rename_account' };
      showStatus('ok', okText);
      extLogDebug('panel_action', { action: logAction });
      await refreshVaultUi();
    },
    [cfg, refreshVaultUi, showStatus]
  );

  const handleMoveAccountUp = useCallback(
    async (id: string) => {
      await cfg.moveUp(id);
      const { okText, logAction } = cfg.afterMoveUp
        ? await cfg.afterMoveUp(id)
        : { okText: '已调整顺序', logAction: 'move_account_up' };
      showStatus('ok', okText);
      extLogDebug('panel_action', { action: logAction });
      await refreshVaultUi();
    },
    [cfg, refreshVaultUi, showStatus]
  );

  const handleMoveAccountDown = useCallback(
    async (id: string) => {
      await cfg.moveDown(id);
      const { okText, logAction } = cfg.afterMoveDown
        ? await cfg.afterMoveDown(id)
        : { okText: '已调整顺序', logAction: 'move_account_down' };
      showStatus('ok', okText);
      extLogDebug('panel_action', { action: logAction });
      await refreshVaultUi();
    },
    [cfg, refreshVaultUi, showStatus]
  );

  const handleClearAllAccounts = useCallback(async () => {
    if (!confirm(cfg.confirmClearAllText)) {
      return;
    }
    await cfg.clearAll();
    const { okText, logAction } = await cfg.afterClearAll();
    showStatus('ok', okText);
    extLogDebug('panel_action', { action: logAction });
    await refreshVaultUi();
  }, [cfg, refreshVaultUi, showStatus]);

  return {
    handleRemoveAccount,
    handleRenameCommit,
    handleMoveAccountUp,
    handleMoveAccountDown,
    handleClearAllAccounts
  };
}
