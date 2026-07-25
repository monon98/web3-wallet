import { FeedbackBanner, UiButton } from '@plugin/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';

type View = 'accounts' | 'addAccount';

export type NewtabAccountsLayoutProps = {
  accountsTitle: string;
  addTitle: string;
  addButtonLabel: string;
  statusKind: 'idle' | 'ok' | 'err';
  statusText: string;
  renderAccounts: () => ReactNode;
  renderAddAccount: () => ReactNode;
};

/**
 * 扩展内新标签页通用布局：标题、返回/新增按钮、反馈条与两页切换。
 * 顶栏在页面纵向滚动时 **吸顶**（`sticky`），与侧栏钱包顶栏行为一致。
 */
export function NewtabAccountsLayout({
  accountsTitle,
  addTitle,
  addButtonLabel,
  statusKind,
  statusText,
  renderAccounts,
  renderAddAccount
}: NewtabAccountsLayoutProps) {
  const [view, setView] = useState<View>('accounts');
  const title = view === 'accounts' ? accountsTitle : addTitle;
  const variant = statusKind === 'err' ? 'error' : statusKind === 'ok' ? 'success' : 'neutral';

  return (
    <div className='box-border w-full min-w-0 px-3 py-3 text-left text-sm text-[var(--ui-fg)] sm:px-5 sm:py-4'>
      <div className='sticky top-0 z-10 -mx-3 mb-3 border-b border-[var(--ui-border)] bg-[var(--ui-bg)] px-3 pb-2 pt-0 shadow-[var(--ui-shadow-sm)] sm:-mx-5 sm:px-5'>
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <div className='min-w-0 flex-1 text-base font-semibold text-[var(--ui-fg)]'>{title}</div>
          <div className='flex shrink-0 flex-wrap gap-2'>
            {view === 'addAccount' ? (
              <UiButton variant='outline' size='sm' onClick={() => setView('accounts')}>
                返回列表
              </UiButton>
            ) : (
              <UiButton variant='primary' size='sm' onClick={() => setView('addAccount')}>
                {addButtonLabel}
              </UiButton>
            )}
          </div>
        </div>
      </div>

      <FeedbackBanner variant={variant} text={statusText} />

      <div className='mt-1'>{view === 'accounts' ? renderAccounts() : renderAddAccount()}</div>
    </div>
  );
}
