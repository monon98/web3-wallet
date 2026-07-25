import { useCallback, useState } from 'react';

import type { WalletImportFlowMode, WalletImportMode } from '~/types';
import { extLogDebug } from '~lib/extensionLog';
import { addWalletAccountFromMnemonic, addWalletAccountFromPrivateKey } from '~lib/vault/record';
import { validateMnemonic } from '~web3';
import {
  coerceEvmHdPath,
  DEFAULT_HD_PATH,
  deriveEvmAddressFromMnemonic,
  deriveEvmAddressFromPrivateKey,
  normalizePrivateKeyInput
} from '~web3/base/hd/derive';
import { generateEvmAddressBatchFromMnemonic } from '~web3/evm/addressGenerator';

import type { PanelStatus } from './usePanelStatus';

type ShowStatus = (kind: PanelStatus['kind'], text: string) => void;

/**
 * **导入表单** 受控状态与提交（助记词 / 私钥），依赖外部 `refreshVaultUi` 刷新列表。
 */
export function useWalletImportForm(showStatus: ShowStatus, refreshVaultUi: () => Promise<void>) {
  const [flowMode, setFlowMode] = useState<WalletImportFlowMode>('batch');
  const [singleImportMode, setSingleImportMode] = useState<WalletImportMode>('mnemonic');
  const [accountLabel, setAccountLabel] = useState('');
  const [batchMnemonicInput, setBatchMnemonicInput] = useState('');
  const [batchPresetId, setBatchPresetId] = useState('default_1');
  const [batchHdPathTemplate, setBatchHdPathTemplate] = useState<string>("m/44'/60'/0'/0/{index}");
  const [batchHdStartIndex, setBatchHdStartIndex] = useState('0');
  const [batchHdCount, setBatchHdCount] = useState('1');

  const [singleMnemonicInput, setSingleMnemonicInput] = useState('');
  const [singlePathPresetId, setSinglePathPresetId] = useState('default0');
  const [singleHdPath, setSingleHdPath] = useState<string>(DEFAULT_HD_PATH);
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  const handleImport = useCallback(async () => {
    if (password.length < 8) {
      showStatus('err', '密码至少 8 位');
      return;
    }
    if (password !== password2) {
      showStatus('err', '两次密码不一致');
      return;
    }

    try {
      if (flowMode === 'batch') {
        const phrase = batchMnemonicInput.trim();
        if (!phrase) {
          showStatus('err', '请输入助记词');
          return;
        }
        if (!validateMnemonic(phrase)) {
          showStatus('err', '助记词无效');
          return;
        }

        const start = Number(batchHdStartIndex);
        const count = Number(batchHdCount);
        const template = batchHdPathTemplate.trim() || "m/44'/60'/0'/0/{index}";
        const batch = generateEvmAddressBatchFromMnemonic({
          mnemonic: phrase,
          pathTemplate: template,
          startIndex: start,
          count
        });
        if (batch.ok === false) {
          showStatus('err', batch.error);
          return;
        }

        for (let i = 0; i < batch.rows.length; i += 1) {
          const { path, address } = batch.rows[i];
          const baseLabel = accountLabel.trim();
          /** 批量导入：显示名一律为「前缀 + 空格 + 批内序号」（与表单文案「前缀」一致） */
          const label = baseLabel.length > 0 ? `${baseLabel} ${i + 1}` : undefined;
          await addWalletAccountFromMnemonic(phrase, password, address, path, label);
        }
        setBatchMnemonicInput('');
        setPassword('');
        setPassword2('');
        setAccountLabel('');
        showStatus(
          'ok',
          count === 1 ? `已添加账户（助记词）。路径 ${batch.rows[0].path}` : `已添加 ${count} 个账户（助记词）。`
        );
        extLogDebug('panel_action', { action: 'import_mnemonic_batch_ok', preset: batchPresetId });
      } else if (singleImportMode === 'mnemonic') {
        const phrase = singleMnemonicInput.trim();
        if (!phrase) {
          showStatus('err', '请输入助记词');
          return;
        }
        if (!validateMnemonic(phrase)) {
          showStatus('err', '助记词无效');
          return;
        }
        const path = coerceEvmHdPath(singleHdPath.trim() || DEFAULT_HD_PATH);
        if (!path) {
          showStatus('err', "派生路径无效（需以 m/44'/60'/ 开头）");
          return;
        }
        const address = deriveEvmAddressFromMnemonic(phrase, path);
        await addWalletAccountFromMnemonic(phrase, password, address, path, accountLabel.trim() || undefined);
        setSingleMnemonicInput('');
        setPassword('');
        setPassword2('');
        setAccountLabel('');
        showStatus('ok', `已添加账户（助记词）。路径 ${path}`);
        extLogDebug('panel_action', { action: 'import_mnemonic_single_ok', pathPreset: singlePathPresetId });
      } else {
        const pk = normalizePrivateKeyInput(privateKeyInput);
        if (!pk) {
          showStatus('err', '私钥格式无效（需 32 字节十六进制，可带 0x）');
          return;
        }
        const address = deriveEvmAddressFromPrivateKey(pk);
        await addWalletAccountFromPrivateKey(pk, password, address, accountLabel.trim() || undefined);
        setPrivateKeyInput('');
        setPassword('');
        setPassword2('');
        setAccountLabel('');
        showStatus('ok', '已添加账户（私钥）');
        extLogDebug('panel_action', { action: 'import_private_key_single_ok' });
      }
      await refreshVaultUi();
    } catch {
      showStatus('err', '保存失败，请重试');
    }
  }, [
    password,
    password2,
    flowMode,
    batchMnemonicInput,
    batchHdStartIndex,
    batchHdCount,
    batchHdPathTemplate,
    batchPresetId,
    singleImportMode,
    singleMnemonicInput,
    singleHdPath,
    singlePathPresetId,
    privateKeyInput,
    accountLabel,
    refreshVaultUi,
    showStatus
  ]);

  return {
    flowMode,
    setFlowMode,
    singleImportMode,
    setSingleImportMode,
    accountLabel,
    setAccountLabel,
    batchMnemonicInput,
    setBatchMnemonicInput,
    batchPresetId,
    setBatchPresetId,
    batchHdPathTemplate,
    setBatchHdPathTemplate,
    batchHdStartIndex,
    setBatchHdStartIndex,
    batchHdCount,
    setBatchHdCount,
    singleMnemonicInput,
    setSingleMnemonicInput,
    singlePathPresetId,
    setSinglePathPresetId,
    singleHdPath,
    setSingleHdPath,
    privateKeyInput,
    setPrivateKeyInput,
    password,
    setPassword,
    password2,
    setPassword2,
    handleImport
  };
}
