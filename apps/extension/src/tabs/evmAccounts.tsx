import '~/assets/style.css';

import { NewtabAccountsLayout } from '~/components/common/wallet/newtabAccountsLayout';
import { AccountsListSection } from '~/components/wallet/sections/accountsListSection';
import { ImportAccountSection } from '~/components/wallet/sections/importAccountSection';
import { usePanelStatus } from '~/hooks/usePanelStatus';
import { useWalletAccountMutations } from '~/hooks/useWalletAccountMutations';
import { useWalletImportForm } from '~/hooks/useWalletImportForm';
import { useWalletVaultSync } from '~/hooks/useWalletVaultSync';

/**
 * 扩展内 **新标签页**：EVM 账户管理（列表 + 助记词/私钥导入）。
 * 侧边栏首页只保留入口；账户加密存储与桥接授权逻辑保持不变。
 */
function Newtab() {
  const { status, showStatus } = usePanelStatus();
  const vault = useWalletVaultSync();
  const importForm = useWalletImportForm(showStatus, vault.refreshVaultUi);
  const mutations = useWalletAccountMutations(showStatus, vault.refreshVaultUi);

  return (
    <NewtabAccountsLayout
      accountsTitle='EVM 账户列表（新标签页）'
      addTitle='添加 EVM 账户（新标签页）'
      addButtonLabel='添加 EVM 账户'
      statusKind={status.kind}
      statusText={status.text}
      renderAccounts={() => (
        <AccountsListSection
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
        <ImportAccountSection
          variant='panel'
          flowMode={importForm.flowMode}
          onFlowModeChange={importForm.setFlowMode}
          singleImportMode={importForm.singleImportMode}
          onSingleImportModeChange={importForm.setSingleImportMode}
          accountLabel={importForm.accountLabel}
          onAccountLabelChange={importForm.setAccountLabel}
          batchMnemonicInput={importForm.batchMnemonicInput}
          onBatchMnemonicChange={importForm.setBatchMnemonicInput}
          batchPresetId={importForm.batchPresetId}
          onBatchPresetIdChange={importForm.setBatchPresetId}
          batchHdPathTemplate={importForm.batchHdPathTemplate}
          onBatchHdPathTemplateChange={importForm.setBatchHdPathTemplate}
          batchHdStartIndex={importForm.batchHdStartIndex}
          onBatchHdStartIndexChange={importForm.setBatchHdStartIndex}
          batchHdCount={importForm.batchHdCount}
          onBatchHdCountChange={importForm.setBatchHdCount}
          singleMnemonicInput={importForm.singleMnemonicInput}
          onSingleMnemonicChange={importForm.setSingleMnemonicInput}
          singlePathPresetId={importForm.singlePathPresetId}
          onSinglePathPresetIdChange={importForm.setSinglePathPresetId}
          singleHdPath={importForm.singleHdPath}
          onSingleHdPathChange={importForm.setSingleHdPath}
          privateKeyInput={importForm.privateKeyInput}
          onPrivateKeyChange={importForm.setPrivateKeyInput}
          password={importForm.password}
          onPasswordChange={importForm.setPassword}
          password2={importForm.password2}
          onPassword2Change={importForm.setPassword2}
          onSubmit={() => void importForm.handleImport()}
        />
      )}
    />
  );
}

export default Newtab;
