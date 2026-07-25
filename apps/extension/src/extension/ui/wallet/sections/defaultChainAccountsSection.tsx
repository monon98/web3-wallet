import { PanelSection, UiButton } from '@plugin/ui';

import type { DefaultChainAccountsSectionProps } from '~/types';
import { openTab } from '~lib/extension';

/**
 * **默认链上账户**：EVM / TVM 各取 vault 列表**首项**（与待批准连接默认选中、侧栏摘要一致）；调整顺序见各管理页「上移」。
 */
export function DefaultChainAccountsSection({
  evmDefaultAccount,
  tvmDefaultAccount
}: DefaultChainAccountsSectionProps) {
  return (
    <PanelSection
      title='默认选中的账户'
      description='EVM 与 TVM 各自取本地列表的第一项：侧栏挂起连接审批的默认地址、以及部分摘要文案均与此一致。在「EVM / TVM 账户列表」管理页使用「上移」可将常用账户排到首位。'
      tone='default'>
      <div className='space-y-3 text-[11px]'>
        <div className='rounded border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-2.5'>
          <p className='font-medium text-[var(--ui-fg)]'>EVM（默认）</p>
          {evmDefaultAccount ? (
            <>
              <p className='mt-1 text-[var(--ui-muted-fg)]'>
                显示名：<span className='text-[var(--ui-fg)]'>{evmDefaultAccount.label}</span>
              </p>
              <code
                className='mt-1 block break-all font-mono text-[10px] leading-snug text-[var(--ui-fg)]'
                title={evmDefaultAccount.address}>
                {evmDefaultAccount.address}
              </code>
            </>
          ) : (
            <p className='mt-1 text-[var(--ui-muted-fg)]'>暂无已保存 EVM 账户。</p>
          )}
          <UiButton variant='secondary' size='xs' className='mt-2' onClick={() => openTab('tabs/evmAccounts.html')}>
            打开 EVM 账户列表
          </UiButton>
        </div>

        <div className='rounded border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-2.5'>
          <p className='font-medium text-[var(--ui-fg)]'>TVM / Tron（默认）</p>
          {tvmDefaultAccount ? (
            <>
              <p className='mt-1 text-[var(--ui-muted-fg)]'>
                显示名：<span className='text-[var(--ui-fg)]'>{tvmDefaultAccount.label}</span>
              </p>
              <code
                className='mt-1 block break-all font-mono text-[10px] leading-snug text-[var(--ui-fg)]'
                title={tvmDefaultAccount.addressBase58}>
                {tvmDefaultAccount.addressBase58}
              </code>
            </>
          ) : (
            <p className='mt-1 text-[var(--ui-muted-fg)]'>暂无已保存 TVM 账户。</p>
          )}
          <UiButton variant='secondary' size='xs' className='mt-2' onClick={() => openTab('tabs/tvmAccounts.html')}>
            打开 TVM 账户列表
          </UiButton>
        </div>
      </div>
    </PanelSection>
  );
}
