import { FieldHint, FieldLabel, SelectField, TextArea, TextInput, UiButton } from '@plugin/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { MnemonicGeneratorPopup } from '~/components/wallet/components/mnemonicGeneratorPopup';
import type { ImportAccountSectionProps } from '~/types';

import { FormModuleFrame } from '../layout/formModuleFrame';

const BATCH_CONFIG_HINT = "批量导入仅支持助记词派生；模板支持 `{index}` 占位符（如 m/44'/60'/0'/0/{index}）。";
const SINGLE_PATH_HINT = '导入一个：助记词可选择派生路径（如 .../0）。';

const BATCH_PRESETS: Array<{ id: string; label: string; template: string; start: string; count: string }> = [
  {
    id: 'default_1',
    label: "默认（m/44'/60'/0'/0/{index}，1 个）",
    template: "m/44'/60'/0'/0/{index}",
    start: '0',
    count: '1'
  },
  {
    id: 'default_5',
    label: "默认（m/44'/60'/0'/0/{index}，5 个）",
    template: "m/44'/60'/0'/0/{index}",
    start: '0',
    count: '5'
  },
  {
    id: 'ledger_like_5',
    label: "常见（m/44'/60'/0'/{index}，5 个）",
    template: "m/44'/60'/0'/{index}",
    start: '0',
    count: '5'
  },
  { id: 'custom', label: '自定义…', template: "m/44'/60'/0'/0/{index}", start: '0', count: '1' }
];

const SINGLE_PATH_PRESETS: Array<{ id: string; label: string; path: string }> = [
  { id: 'default0', label: "默认 m/44'/60'/0'/0/0", path: "m/44'/60'/0'/0/0" },
  { id: 'default1', label: "默认 m/44'/60'/0'/0/1", path: "m/44'/60'/0'/0/1" },
  { id: 'custom', label: '自定义…', path: "m/44'/60'/0'/0/0" }
];

function ImportModuleHeading({ children }: { children: ReactNode }) {
  return <h3 className='mb-3 text-sm font-semibold tracking-tight text-[var(--ui-fg)]'>{children}</h3>;
}

/** EVM：助记词或私钥 + 加密口令导入；与 `useWalletImportForm` / 新标签页布局绑定。 */
export function ImportAccountSection({
  variant = 'panel',
  flowMode,
  onFlowModeChange,
  singleImportMode,
  onSingleImportModeChange,
  accountLabel,
  onAccountLabelChange,
  batchMnemonicInput,
  onBatchMnemonicChange,
  batchPresetId,
  onBatchPresetIdChange,
  batchHdPathTemplate,
  onBatchHdPathTemplateChange,
  batchHdStartIndex,
  onBatchHdStartIndexChange,
  batchHdCount,
  onBatchHdCountChange,
  singleMnemonicInput,
  onSingleMnemonicChange,
  singlePathPresetId,
  onSinglePathPresetIdChange,
  singleHdPath,
  onSingleHdPathChange,
  privateKeyInput,
  onPrivateKeyChange,
  password,
  onPasswordChange,
  password2,
  onPassword2Change,
  onSubmit
}: ImportAccountSectionProps) {
  const [mnemonicPopupOpen, setMnemonicPopupOpen] = useState(false);

  const handleBatchPresetSelect = (id: string) => {
    onBatchPresetIdChange(id);
    const hit = BATCH_PRESETS.find((p) => p.id === id);
    if (!hit) {
      return;
    }
    if (id !== 'custom') {
      onBatchHdPathTemplateChange(hit.template);
      onBatchHdStartIndexChange(hit.start);
      onBatchHdCountChange(hit.count);
    }
  };

  const handleSinglePathPresetSelect = (id: string) => {
    onSinglePathPresetIdChange(id);
    const hit = SINGLE_PATH_PRESETS.find((p) => p.id === id);
    if (!hit) {
      return;
    }
    if (id !== 'custom') {
      onSingleHdPathChange(hit.path);
    }
  };

  const handleUseGeneratedMnemonic = (m: string) => {
    if (flowMode === 'batch') {
      onBatchMnemonicChange(m);
      return;
    }
    if (singleImportMode === 'mnemonic') {
      onSingleMnemonicChange(m);
    }
  };

  const batchFields = (
    <>
      <div className='mb-3'>
        <UiButton variant='outline' size='sm' className='w-full sm:w-auto' onClick={() => setMnemonicPopupOpen(true)}>
          生成助记词（弹窗）
        </UiButton>
        <FieldHint className='mt-1.5'>可先随机生成再填下方配置，或粘贴已有助记词。</FieldHint>
      </div>

      <FieldLabel htmlFor='wallet-batch-preset'>批量导入配置</FieldLabel>
      <SelectField
        id='wallet-batch-preset'
        value={batchPresetId}
        onChange={(e) => handleBatchPresetSelect(e.target.value)}>
        {BATCH_PRESETS.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </SelectField>
      <FieldHint className='mb-2'>{BATCH_CONFIG_HINT}</FieldHint>

      <FieldLabel htmlFor='wallet-batch-mnemonic'>助记词（空格分隔）</FieldLabel>
      <TextArea
        id='wallet-batch-mnemonic'
        rows={3}
        placeholder='word1 word2 ...'
        value={batchMnemonicInput}
        onChange={(e) => onBatchMnemonicChange(e.target.value)}
        autoComplete='off'
        spellCheck={false}
        className='mb-2'
      />

      <FieldLabel htmlFor='wallet-batch-template'>派生路径（模板）</FieldLabel>
      <TextInput
        id='wallet-batch-template'
        type='text'
        placeholder="m/44'/60'/0'/0/{index}"
        value={batchHdPathTemplate}
        onChange={(e) => onBatchHdPathTemplateChange(e.target.value)}
        autoComplete='off'
        disabled={batchPresetId !== 'custom'}
        className='mb-1'
      />
      <FieldHint className='mb-2'>
        建议使用 <code>{'{index}'}</code> 占位符；若不含占位符，则需以数字结尾（会递增最后一段）。
      </FieldHint>

      <div className='mb-2 grid grid-cols-2 gap-2'>
        <div>
          <FieldLabel htmlFor='wallet-batch-start'>起始 index</FieldLabel>
          <TextInput
            id='wallet-batch-start'
            type='number'
            inputMode='numeric'
            min={0}
            value={batchHdStartIndex}
            onChange={(e) => onBatchHdStartIndexChange(e.target.value)}
            autoComplete='off'
            disabled={batchPresetId !== 'custom'}
          />
        </div>
        <div>
          <FieldLabel htmlFor='wallet-batch-count'>导入数量</FieldLabel>
          <TextInput
            id='wallet-batch-count'
            type='number'
            inputMode='numeric'
            min={1}
            max={50}
            value={batchHdCount}
            onChange={(e) => onBatchHdCountChange(e.target.value)}
            autoComplete='off'
            disabled={batchPresetId !== 'custom'}
          />
        </div>
      </div>
    </>
  );

  const singleFields = (
    <>
      <div className='mb-3 flex flex-wrap gap-2'>
        <UiButton
          variant={singleImportMode === 'mnemonic' ? 'outlineActive' : 'outline'}
          size='sm'
          onClick={() => onSingleImportModeChange('mnemonic')}>
          助记词
        </UiButton>
        <UiButton
          variant={singleImportMode === 'privateKey' ? 'outlineActive' : 'outline'}
          size='sm'
          onClick={() => onSingleImportModeChange('privateKey')}>
          私钥
        </UiButton>
      </div>

      {singleImportMode === 'mnemonic' ? (
        <>
          <div className='mb-3'>
            <UiButton
              variant='outline'
              size='sm'
              className='w-full sm:w-auto'
              onClick={() => setMnemonicPopupOpen(true)}>
              生成助记词（弹窗）
            </UiButton>
            <FieldHint className='mt-1.5'>可先随机生成再填写助记词框，或粘贴已有助记词。</FieldHint>
          </div>

          <FieldLabel htmlFor='wallet-single-mnemonic'>助记词（空格分隔）</FieldLabel>
          <TextArea
            id='wallet-single-mnemonic'
            rows={3}
            placeholder='word1 word2 ...'
            value={singleMnemonicInput}
            onChange={(e) => onSingleMnemonicChange(e.target.value)}
            autoComplete='off'
            spellCheck={false}
            className='mb-2'
          />

          <FieldLabel htmlFor='wallet-single-path-preset'>派生路径</FieldLabel>
          <SelectField
            id='wallet-single-path-preset'
            value={singlePathPresetId}
            onChange={(e) => handleSinglePathPresetSelect(e.target.value)}>
            {SINGLE_PATH_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </SelectField>
          <FieldHint className='mb-2'>{SINGLE_PATH_HINT}</FieldHint>

          <TextInput
            id='wallet-single-path'
            type='text'
            placeholder="m/44'/60'/0'/0/0"
            value={singleHdPath}
            onChange={(e) => onSingleHdPathChange(e.target.value)}
            autoComplete='off'
            disabled={singlePathPresetId !== 'custom'}
            className='mb-0'
          />
        </>
      ) : (
        <>
          <FieldLabel htmlFor='wallet-pk'>私钥（64 位十六进制，可带 0x）</FieldLabel>
          <TextArea
            id='wallet-pk'
            rows={2}
            placeholder='0x…'
            value={privateKeyInput}
            onChange={(e) => onPrivateKeyChange(e.target.value)}
            autoComplete='off'
            spellCheck={false}
          />
        </>
      )}
    </>
  );

  const titleWithTip = (
    <span className='inline-flex items-center gap-1'>{variant === 'plain' ? '导入 EVM 账户' : '添加 EVM 账户'}</span>
  );

  const modularForm = (
    <>
      <div className='flex flex-col gap-6'>
        <FormModuleFrame>
          <ImportModuleHeading>账户名称与导入方式</ImportModuleHeading>
          <FieldLabel htmlFor='wallet-acc-label'>
            {flowMode === 'batch' ? '账户显示名前缀（可选）' : '新账户显示名（可选）'}
          </FieldLabel>
          <TextInput
            id='wallet-acc-label'
            type='text'
            placeholder={
              flowMode === 'batch' ? '例如：主钱包（将保存为主钱包 1、主钱包 2…）' : '留空则使用默认：账户 1、账户 2…'
            }
            value={accountLabel}
            onChange={(e) => onAccountLabelChange(e.target.value)}
            autoComplete='off'
            className='mb-1'
          />
          {flowMode === 'batch' ? (
            <FieldHint className='mb-3'>
              批量导入时，显示名为<strong>前缀</strong>加批内序号（空格分隔），如「主钱包 1」「主钱包
              2」。留空则各条使用默认「账户 N」。
            </FieldHint>
          ) : (
            <FieldHint className='mb-3'>
              导入一个时，此处为<strong>整条</strong>账户显示名；留空则使用默认命名。
            </FieldHint>
          )}
          <div className='flex flex-wrap gap-2'>
            <UiButton
              variant={flowMode === 'batch' ? 'outlineActive' : 'outline'}
              size='sm'
              onClick={() => onFlowModeChange('batch')}>
              批量导入
            </UiButton>
            <UiButton
              variant={flowMode === 'single' ? 'outlineActive' : 'outline'}
              size='sm'
              onClick={() => onFlowModeChange('single')}>
              导入一个
            </UiButton>
          </div>
        </FormModuleFrame>

        <FormModuleFrame>
          <ImportModuleHeading>
            {flowMode === 'batch' ? '批量：助记词与派生路径' : '单个：助记词或私钥'}
          </ImportModuleHeading>
          {flowMode === 'batch' ? batchFields : singleFields}
        </FormModuleFrame>

        <FormModuleFrame>
          <ImportModuleHeading>加密口令与提交</ImportModuleHeading>
          <FieldLabel htmlFor='wallet-pw1'>加密密码</FieldLabel>
          <TextInput
            id='wallet-pw1'
            type='password'
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            autoComplete='new-password'
            className='mb-2'
          />
          <FieldLabel htmlFor='wallet-pw2'>确认密码</FieldLabel>
          <TextInput
            id='wallet-pw2'
            type='password'
            value={password2}
            onChange={(e) => onPassword2Change(e.target.value)}
            autoComplete='new-password'
            className='mb-0'
          />
          <div className='mt-4 border-t border-[var(--ui-border)] pt-4'>
            <UiButton variant='primary' size='lg' className='w-full' onClick={() => void onSubmit()}>
              添加加密账户
            </UiButton>
          </div>
        </FormModuleFrame>
      </div>

      {mnemonicPopupOpen ? (
        <MnemonicGeneratorPopup
          onClose={() => setMnemonicPopupOpen(false)}
          onUseMnemonic={handleUseGeneratedMnemonic}
        />
      ) : null}
    </>
  );

  if (variant === 'plain') {
    return (
      <div className='flex flex-col gap-4 border-t border-[var(--ui-border)] pt-4'>
        <h3 className='text-[11px] font-semibold text-[var(--ui-fg)]'>{titleWithTip}</h3>
        {modularForm}
      </div>
    );
  }

  return modularForm;
}
