import type { UiAlertProps, UiAlertVariant } from './types';

const variantClass: Record<UiAlertVariant, string> = {
  error:
    'border-[var(--ui-danger)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]',
  success:
    'border-[var(--ui-success)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]',
  info: 'border-[var(--ui-info)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]',
  neutral:
    'border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]'
};

/**
 * 块级提示（错误 / 成功 / 说明）；用于表单或面板内操作反馈，与行内的 {@link FieldHint} 区分。
 */
export function UiAlert({
  variant = 'neutral',
  className = '',
  children
}: UiAlertProps) {
  if (children === null || children === undefined) {
    return null;
  }
  if (typeof children === 'string' && !children.trim()) {
    return null;
  }

  return (
    <div
      className={`rounded-md border px-3 py-2 text-xs leading-snug ${variantClass[variant]} ${className}`.trim()}
      role={
        variant === 'error'
          ? 'alert'
          : variant === 'success'
            ? 'status'
            : undefined
      }>
      {children}
    </div>
  );
}
