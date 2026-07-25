import { UiAlert } from '@plugin/ui';

import type { StatusBannerProps } from '~/types';

/**
 * 侧栏 / 弹窗 **操作反馈**：用 {@link UiAlert} 展示，与纯文本区分层级。
 */
export function StatusBanner({ kind, text }: StatusBannerProps) {
  if (!text.trim()) {
    return null;
  }
  const variant = kind === 'err' ? 'error' : kind === 'ok' ? 'success' : 'neutral';
  return (
    <UiAlert variant={variant} className='mb-2'>
      {text}
    </UiAlert>
  );
}
