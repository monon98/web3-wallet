import { FieldHint, FieldLabel, TextArea, TextInput, UiButton, UiTipBubble } from '@plugin/ui';
import type { ReactNode } from 'react';

import { FormModuleFrame } from '../layout/formModuleFrame';

export type TvmImportAccountSectionProps = {
  variant?: 'panel' | 'plain';
  accountLabel: string;
  onAccountLabelChange: (v: string) => void;
  privateKeyInput: string;
  onPrivateKeyChange: (v: string) => void;
  password: string;
  onPasswordChange: (v: string) => void;
  password2: string;
  onPassword2Change: (v: string) => void;
  onGenerate: () => void;
  onSubmit: () => void;
};

const PRIVATE_KEY_HINT = '私钥会在本地加密后存入 chrome.storage.local；请勿在不可信环境粘贴。';
const GENERATE_HINT = '生成账户会在内存中短暂出现明文私钥；保存后仅存加密密文。';

function TvmImportModuleHeading({ children }: { children: ReactNode }) {
  return <h3 className='mb-3 text-sm font-semibold tracking-tight text-[var(--ui-fg)]'>{children}</h3>;
}

/** TVM：私钥导入 + 本地加密保存；支持在当前页生成新账户。 */
export function TvmImportAccountSection({
  variant = 'panel',
  accountLabel,
  onAccountLabelChange,
  privateKeyInput,
  onPrivateKeyChange,
  password,
  onPasswordChange,
  password2,
  onPassword2Change,
  onGenerate,
  onSubmit
}: TvmImportAccountSectionProps) {
  const titleWithTip = (
    <span className='inline-flex items-center gap-1'>
      <span>{variant === 'plain' ? '导入 TVM 账户' : '添加 TVM 账户'}</span>
      <UiTipBubble content={GENERATE_HINT} placement='bottom' ariaLabel='生成账户说明' />
    </span>
  );

  const modularForm = (
    <div className='flex flex-col gap-6'>
      <FormModuleFrame>
        <TvmImportModuleHeading>账户名称</TvmImportModuleHeading>
        <FieldLabel htmlFor='tvm-acc-label'>新账户显示名（可选）</FieldLabel>
        <TextInput
          id='tvm-acc-label'
          type='text'
          placeholder='默认：Tron 账户 1、Tron 账户 2…'
          value={accountLabel}
          onChange={(e) => onAccountLabelChange(e.target.value)}
          autoComplete='off'
        />
      </FormModuleFrame>

      <FormModuleFrame>
        <TvmImportModuleHeading>私钥材料</TvmImportModuleHeading>
        <FieldLabel htmlFor='tvm-pk'>私钥（64 位十六进制，可带 0x）</FieldLabel>
        <TextArea
          id='tvm-pk'
          rows={2}
          placeholder='0x…'
          value={privateKeyInput}
          onChange={(e) => onPrivateKeyChange(e.target.value)}
          autoComplete='off'
          spellCheck={false}
          className='mb-1'
        />
        <FieldHint>{PRIVATE_KEY_HINT}</FieldHint>
      </FormModuleFrame>

      <FormModuleFrame>
        <TvmImportModuleHeading>加密口令与操作</TvmImportModuleHeading>
        <FieldLabel htmlFor='tvm-pw1'>加密密码</FieldLabel>
        <TextInput
          id='tvm-pw1'
          type='password'
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          autoComplete='new-password'
          className='mb-2'
        />
        <FieldLabel htmlFor='tvm-pw2'>确认密码</FieldLabel>
        <TextInput
          id='tvm-pw2'
          type='password'
          value={password2}
          onChange={(e) => onPassword2Change(e.target.value)}
          autoComplete='new-password'
          className='mb-0'
        />
        <div className='mt-4 flex flex-col gap-2 border-t border-[var(--ui-border)] pt-4 sm:flex-row sm:flex-wrap'>
          <UiButton
            variant='primary'
            size='lg'
            className='w-full sm:min-w-[10rem] sm:flex-1'
            onClick={() => void onSubmit()}>
            导入并保存
          </UiButton>
          <UiButton
            variant='outline'
            size='lg'
            className='w-full sm:min-w-[10rem] sm:flex-1'
            onClick={() => void onGenerate()}>
            生成并保存
          </UiButton>
        </div>
      </FormModuleFrame>
    </div>
  );

  if (variant === 'plain') {
    return (
      <div className='flex flex-col gap-4 border-t border-[var(--ui-border)] pt-4'>
        <h3 className='flex flex-wrap items-center gap-1 text-[11px] font-semibold text-[var(--ui-fg)]'>
          {titleWithTip}
        </h3>
        {modularForm}
      </div>
    );
  }

  return modularForm;
}
