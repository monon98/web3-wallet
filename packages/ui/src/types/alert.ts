import type { ReactNode } from 'react';

export type UiAlertVariant = 'error' | 'success' | 'info' | 'neutral';

export type UiAlertProps = {
  /** 语义色与边框背景；`error` 时使用 `role="alert"` 便于读屏 */
  variant?: UiAlertVariant;
  className?: string;
  children?: ReactNode;
};
