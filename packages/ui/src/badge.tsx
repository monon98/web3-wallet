import type { UiBadgeProps, UiBadgeVariant } from './types';

const variantClass: Record<UiBadgeVariant, string> = {
  neutral:
    'border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]',
  success:
    'border-[var(--ui-success)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]',
  warning:
    'border-[var(--ui-warning)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]',
  danger:
    'border-[var(--ui-danger)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]',
  info: 'border-[var(--ui-info)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]'
};

/**
 * 小标签（状态、链名等），默认行内不换行截断由父级控制。
 */
export function UiBadge({
  children,
  variant = 'neutral',
  className = '',
  ...rest
}: UiBadgeProps) {
  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded border px-1.5 py-0.5 text-[10px] font-medium ${variantClass[variant]} ${className}`.trim()}
      {...rest}>
      {children}
    </span>
  );
}
