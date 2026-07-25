import { UiAlert } from './alert';
import type { FeedbackBannerProps } from './types';

/**
 * 通用反馈条（跨端）：对齐扩展内 `StatusBanner`，但不依赖业务类型。
 * 传入 `text` 为空时不渲染，避免布局抖动。
 */
export function FeedbackBanner({
  variant = 'neutral',
  text,
  className = ''
}: FeedbackBannerProps) {
  if (!text.trim()) {
    return null;
  }
  return (
    <UiAlert variant={variant} className={`mb-2 ${className}`.trim()}>
      {text}
    </UiAlert>
  );
}
