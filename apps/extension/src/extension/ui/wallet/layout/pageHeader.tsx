import { UiButton } from '@plugin/ui';

import type { WalletPageHeaderProps } from '~/types';

/**
 * 侧栏 / 弹窗 **顶栏**：概览为单标题；子页带「返回」回到概览。
 * 在侧栏等纵向滚动容器内使用 **`sticky top-0`**，向下滚动时标题栏留在视口顶部。
 */
export function WalletPageHeader({ title = 'Web3 wallet', onBack }: WalletPageHeaderProps) {
  return (
    <header className='sticky top-0 z-10 mb-3 min-w-0 border-b border-[var(--ui-border)] bg-[var(--ui-bg)] pb-2 shadow-[var(--ui-shadow-sm)]'>
      <div className='flex min-w-0 items-center gap-2'>
        {onBack ? (
          <UiButton variant='outline' size='sm' className='shrink-0' onClick={onBack} aria-label='返回概览'>
            ←
          </UiButton>
        ) : null}
        <h1 className='min-w-0 flex-1 truncate text-base font-semibold text-[var(--ui-fg)]'>{title}</h1>
      </div>
    </header>
  );
}
