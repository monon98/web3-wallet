import { useCallback, useState } from 'react';

import { extLogDebug } from '~lib/extensionLog';
import { addTvmAccountFromPrivateKey, generateAndAddTvmAccount } from '~lib/vault/tvmRecord';

import type { PanelStatus } from './usePanelStatus';

type ShowStatus = (kind: PanelStatus['kind'], text: string) => void;

/**
 * **TVM 导入/生成表单**：私钥导入或生成新账户；依赖外部 `refreshVaultUi` 刷新列表。
 */
export function useTvmImportForm(showStatus: ShowStatus, refreshVaultUi: () => Promise<void>) {
  const [accountLabel, setAccountLabel] = useState('');
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  const validatePassword = () => {
    if (password.length < 8) {
      showStatus('err', '密码至少 8 位');
      return false;
    }
    if (password !== password2) {
      showStatus('err', '两次密码不一致');
      return false;
    }
    return true;
  };

  const handleImport = useCallback(async () => {
    if (!validatePassword()) {
      return;
    }
    const pk = privateKeyInput.trim();
    if (!pk) {
      showStatus('err', '请输入私钥');
      return;
    }
    try {
      await addTvmAccountFromPrivateKey(pk, password, accountLabel.trim() || undefined);
      setPrivateKeyInput('');
      setPassword('');
      setPassword2('');
      setAccountLabel('');
      showStatus('ok', '已添加 TVM 账户（私钥）');
      extLogDebug('panel_action', { action: 'tvm_import_private_key_ok' });
      await refreshVaultUi();
    } catch {
      showStatus('err', '保存失败，请重试');
    }
  }, [accountLabel, password, password2, privateKeyInput, refreshVaultUi, showStatus]);

  const handleGenerate = useCallback(async () => {
    if (!validatePassword()) {
      return;
    }
    try {
      await generateAndAddTvmAccount(password, accountLabel.trim() || undefined);
      setPrivateKeyInput('');
      setPassword('');
      setPassword2('');
      setAccountLabel('');
      showStatus('ok', '已生成并保存 TVM 账户');
      extLogDebug('panel_action', { action: 'tvm_generate_account_ok' });
      await refreshVaultUi();
    } catch {
      showStatus('err', '生成失败，请重试');
    }
  }, [accountLabel, password, password2, refreshVaultUi, showStatus]);

  return {
    accountLabel,
    setAccountLabel,
    privateKeyInput,
    setPrivateKeyInput,
    password,
    setPassword,
    password2,
    setPassword2,
    handleImport,
    handleGenerate
  };
}
