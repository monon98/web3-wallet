import {
  clearAllTvmAccounts,
  moveTvmAccountDown,
  moveTvmAccountUp,
  removeTvmAccount,
  renameTvmAccount
} from '~lib/vault/tvmRecord';

import { createAccountMutations } from './common/createAccountMutations';
import type { PanelStatus } from './usePanelStatus';

type ShowStatus = (kind: PanelStatus['kind'], text: string) => void;

/**
 * **TVM 账户列表** 重命名、删除、排序与清空（不含导入表单）。
 */
export function useTvmAccountMutations(showStatus: ShowStatus, refreshVaultUi: () => Promise<void>) {
  return createAccountMutations(showStatus, refreshVaultUi, {
    confirmRemoveText: '确定删除此 TVM 账户？',
    confirmClearAllText: '将删除所有本地 TVM 账户，是否继续？',
    remove: removeTvmAccount,
    rename: renameTvmAccount,
    moveUp: moveTvmAccountUp,
    moveDown: moveTvmAccountDown,
    clearAll: clearAllTvmAccounts,
    afterRemove: async () => ({ okText: '已删除该账户', logAction: 'tvm_remove_account' }),
    afterRename: async () => ({ okText: '已重命名', logAction: 'tvm_rename_account' }),
    afterMoveUp: async () => ({ okText: '已调整顺序', logAction: 'tvm_move_account_up' }),
    afterMoveDown: async () => ({ okText: '已调整顺序', logAction: 'tvm_move_account_down' }),
    afterClearAll: async () => ({ okText: '已清空 TVM 账户', logAction: 'tvm_clear_all_accounts' })
  });
}
