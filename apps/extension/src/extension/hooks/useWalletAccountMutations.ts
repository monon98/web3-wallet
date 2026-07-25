import {
  clearAllWalletAccounts,
  listWalletAccountSummaries,
  moveWalletAccountDown,
  moveWalletAccountUp,
  removeWalletAccount,
  renameWalletAccount
} from '~lib/vault/record';
import { resetWalletUiStateToDefaults } from '~lib/walletUi/globalSettings';

import { createAccountMutations } from './common/createAccountMutations';
import type { PanelStatus } from './usePanelStatus';

type ShowStatus = (kind: PanelStatus['kind'], text: string) => void;

/**
 * **账户列表** 重命名、删除、排序与清空（不含导入表单）。
 */
export function useWalletAccountMutations(showStatus: ShowStatus, refreshVaultUi: () => Promise<void>) {
  return createAccountMutations(showStatus, refreshVaultUi, {
    confirmRemoveText: '确定删除此账户？',
    confirmClearAllText: '将删除所有本地账户并清除站点授权，是否继续？',
    remove: removeWalletAccount,
    rename: renameWalletAccount,
    moveUp: moveWalletAccountUp,
    moveDown: moveWalletAccountDown,
    clearAll: clearAllWalletAccounts,
    afterRemove: async () => {
      const next = await listWalletAccountSummaries();
      if (next.length === 0) {
        await resetWalletUiStateToDefaults();
        return { okText: '已删除全部账户，站点连接已清空', logAction: 'remove_last_account' };
      }
      return { okText: '已删除该账户', logAction: 'remove_account' };
    },
    afterRename: async () => ({ okText: '已重命名', logAction: 'rename_account' }),
    afterMoveUp: async () => ({ okText: '已调整顺序', logAction: 'move_account_up' }),
    afterMoveDown: async () => ({ okText: '已调整顺序', logAction: 'move_account_down' }),
    afterClearAll: async () => {
      await resetWalletUiStateToDefaults();
      return { okText: '已清空账户', logAction: 'clear_all_accounts' };
    }
  });
}
