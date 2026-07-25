import '~/assets/style.css';

import { NewtabAccountsLayout } from '~/components/common/wallet/newtabAccountsLayout';
import { TvmAccountsListSection } from '~/components/wallet/sections/tvmAccountsListSection';
import { TvmImportAccountSection } from '~/components/wallet/sections/tvmImportAccountSection';
import { usePanelStatus } from '~/hooks/usePanelStatus';
import { useTvmAccountMutations } from '~/hooks/useTvmAccountMutations';
import { useTvmImportForm } from '~/hooks/useTvmImportForm';
import { useTvmVaultSync } from '~/hooks/useTvmVaultSync';

/**
 * 扩展内 **新标签页**：TVM(Tron) 账户管理（列表 + 私钥导入 + 生成）。
 * 交互与 EVM 管理页对齐；不接入 EIP-1193，也不做签名/广播。
 */
function Newtab() {
  const { status, showStatus } = usePanelStatus();
  const vault = useTvmVaultSync();
  const importForm = useTvmImportForm(showStatus, vault.refreshVaultUi);
  const mutations = useTvmAccountMutations(showStatus, vault.refreshVaultUi);

  return (
    <NewtabAccountsLayout
      accountsTitle='TVM(Tron) 账户列表（新标签页）'
      addTitle='添加 TVM(Tron) 账户（新标签页）'
      addButtonLabel='添加 TVM 账户'
      statusKind={status.kind}
      statusText={status.text}
      renderAccounts={() => (
        <TvmAccountsListSection
          variant='panel'
          accounts={vault.accounts}
          onRenameCommit={mutations.handleRenameCommit}
          onMoveUp={mutations.handleMoveAccountUp}
          onMoveDown={mutations.handleMoveAccountDown}
          onRemove={mutations.handleRemoveAccount}
          onClearAll={mutations.handleClearAllAccounts}
        />
      )}
      renderAddAccount={() => (
        <TvmImportAccountSection
          variant='panel'
          accountLabel={importForm.accountLabel}
          onAccountLabelChange={importForm.setAccountLabel}
          privateKeyInput={importForm.privateKeyInput}
          onPrivateKeyChange={importForm.setPrivateKeyInput}
          password={importForm.password}
          onPasswordChange={importForm.setPassword}
          password2={importForm.password2}
          onPassword2Change={importForm.setPassword2}
          onGenerate={() => void importForm.handleGenerate()}
          onSubmit={() => void importForm.handleImport()}
        />
      )}
    />
  );
}

export default Newtab;
