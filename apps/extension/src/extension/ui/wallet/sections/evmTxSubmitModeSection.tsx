import { PanelSection } from '@plugin/ui';

import type { EvmTxSubmitModeSectionProps } from '~/types';

/**
 * **全局** `evmTxSubmitMode`：`eth_sendTransaction` 批准后仅签名或签名并广播。
 * 概览已不再内联本块内容，详见 `walletPanelRoot` 聚合子页。
 */
export function EvmTxSubmitModeSection({
  variant = 'panel',
  evmTxSubmitMode,
  onEvmTxSubmitModeChange
}: EvmTxSubmitModeSectionProps) {
  const fields = (
    <>
      <p className='mb-1 text-[11px] font-medium text-[var(--ui-fg)]'>选项</p>
      <div className='mt-2 space-y-2 text-[11px]' role='radiogroup' aria-label='交易提交方式'>
        <label className='flex cursor-pointer items-start gap-2 rounded border border-transparent px-1 py-1 hover:bg-[var(--ui-surface-2)]'>
          <input
            type='radio'
            name='evm-tx-submit'
            className='mt-0.5'
            checked={evmTxSubmitMode === 'signAndBroadcast'}
            onChange={() => void onEvmTxSubmitModeChange('signAndBroadcast')}
          />
          <span>
            <span className='font-medium text-[var(--ui-fg)]'>签名并广播</span>
            <span className='mt-0.5 block leading-snug text-[var(--ui-muted-fg)]'>默认；向页面返回链上交易哈希。</span>
          </span>
        </label>
        <label className='flex cursor-pointer items-start gap-2 rounded border border-transparent px-1 py-1 hover:bg-[var(--ui-surface-2)]'>
          <input
            type='radio'
            name='evm-tx-submit'
            className='mt-0.5'
            checked={evmTxSubmitMode === 'signOnly'}
            onChange={() => void onEvmTxSubmitModeChange('signOnly')}
          />
          <span>
            <span className='font-medium text-[var(--ui-fg)]'>仅签名（不广播）</span>
            <span className='mt-0.5 block leading-snug text-[var(--ui-muted-fg)]'>
              向页面返回已签名原始交易（RLP）；由 DApp / 自选节点发送。
            </span>
          </span>
        </label>
      </div>
    </>
  );

  if (variant === 'plain') {
    return (
      <div className='space-y-2'>
        <p className='text-[11px] leading-snug text-[var(--ui-muted-fg)]'>
          全局生效：`eth_sendTransaction` 批准后，仅返回已签名十六进制或由当前链 RPC
          广播并返回哈希。网页需与所选模式匹配（纯签名时请自行 `eth_sendRawTransaction`）。
        </p>
        {fields}
      </div>
    );
  }

  return (
    <PanelSection
      title='DApp 交易提交方式'
      description='全局生效：`eth_sendTransaction` 批准后，仅返回已签名十六进制或由当前链 RPC 广播并返回哈希。网页需与所选模式匹配（纯签名时请自行 eth_sendRawTransaction）。'
      tone='muted'>
      {fields}
    </PanelSection>
  );
}
