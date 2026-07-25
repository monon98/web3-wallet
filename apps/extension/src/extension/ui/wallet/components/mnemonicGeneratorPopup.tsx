import { TextArea, UiButton } from '@plugin/ui';
import { useEffect, useMemo, useState } from 'react';

import { generateMnemonic, validateMnemonic } from '~web3';

type MnemonicGeneratorPopupProps = {
  onClose: () => void;
  /** 将生成的助记词回填到调用方（例如导入表单） */
  onUseMnemonic: (mnemonic: string) => void;
};

function normalizeMnemonic(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/**
 * 扩展内轻量弹窗：生成 BIP39 助记词（可复制，并可一键回填到导入表单）。
 * 注意：助记词属于敏感信息；本组件不写日志、不持久化。
 */
export function MnemonicGeneratorPopup({ onClose, onUseMnemonic }: MnemonicGeneratorPopupProps) {
  const [mnemonic, setMnemonic] = useState(() => generateMnemonic());
  const [copyStatus, setCopyStatus] = useState<'idle' | 'ok' | 'err'>('idle');

  const canUse = useMemo(() => {
    const m = normalizeMnemonic(mnemonic);
    return m.length > 0 && validateMnemonic(m);
  }, [mnemonic]);

  const handleGenerate = () => {
    setCopyStatus('idle');
    setMnemonic(generateMnemonic());
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(normalizeMnemonic(mnemonic));
      setCopyStatus('ok');
    } catch {
      setCopyStatus('err');
    }
  };

  const handleUse = () => {
    const m = normalizeMnemonic(mnemonic);
    if (!validateMnemonic(m)) {
      return;
    }
    onUseMnemonic(m);
    onClose();
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4' role='dialog' aria-modal='true'>
      <button
        type='button'
        className='absolute inset-0 cursor-default bg-black/40'
        aria-label='关闭'
        onClick={onClose}
      />
      <div className='relative w-full max-w-[36rem] rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-3 text-[var(--ui-fg)] shadow-lg'>
        <div className='flex items-start justify-between gap-2'>
          <div className='min-w-0'>
            <div className='text-sm font-semibold'>生成助记词</div>
            <div className='mt-0.5 text-[10px] leading-snug text-[var(--ui-muted-fg)]'>
              请离线保存；任何人获得助记词即可完全控制资产。
            </div>
          </div>
          <UiButton variant='outline' size='xs' onClick={onClose}>
            关闭
          </UiButton>
        </div>

        <div className='mt-3 space-y-2'>
          <TextArea
            rows={3}
            value={mnemonic}
            onChange={(e) => {
              setCopyStatus('idle');
              setMnemonic(e.target.value);
            }}
            spellCheck={false}
            autoComplete='off'
          />

          <div className='flex flex-wrap gap-2'>
            <UiButton variant='secondary' size='sm' onClick={handleGenerate}>
              重新生成
            </UiButton>
            <UiButton variant='outline' size='sm' disabled={!canUse} onClick={() => void handleCopy()}>
              复制
            </UiButton>
            <UiButton variant='primary' size='sm' disabled={!canUse} onClick={handleUse}>
              使用并回填
            </UiButton>
            {copyStatus === 'ok' ? (
              <span className='self-center text-[11px] text-[var(--ui-success)]'>已复制</span>
            ) : null}
            {copyStatus === 'err' ? (
              <span className='self-center text-[11px] text-[var(--ui-danger)]'>复制失败</span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
