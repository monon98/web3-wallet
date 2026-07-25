import type { UiButtonProps, UiButtonVariant } from './types';

/** 实心底统一用足够深的色阶，保证 `text-white` 对比度；浅底仅用 `text-neutral-900` 等深色字。 */
const variantClass: Record<UiButtonVariant, string> = {
  primary:
    'bg-[var(--ui-primary)] text-[var(--ui-on-primary)] hover:bg-[var(--ui-primary-hover)] active:bg-[var(--ui-primary-active)]',
  secondary:
    'bg-[var(--ui-surface-2)] text-[var(--ui-fg)] hover:opacity-90 active:opacity-85',
  neutral:
    'bg-[var(--ui-surface-2)] text-[var(--ui-fg)] hover:opacity-90 active:opacity-85',
  danger:
    'bg-[var(--ui-danger)] text-[var(--ui-on-danger)] hover:bg-[var(--ui-danger-hover)] active:bg-[var(--ui-danger-active)]',
  outline:
    'border border-[var(--ui-border)] bg-[var(--ui-surface-1)] text-[var(--ui-fg)] hover:bg-[var(--ui-surface-2)]',
  outlineActive:
    'border border-[color:var(--ui-info)] bg-[color:var(--ui-info)] text-white hover:opacity-90 active:opacity-85',
  linkDanger:
    'text-[var(--ui-danger)] underline decoration-[var(--ui-danger)]/60 hover:opacity-80'
};

const sizeClass = {
  xs: 'rounded px-1.5 py-0.5 text-[10px] font-medium',
  sm: 'rounded-md px-2 py-1 text-xs',
  md: 'rounded-md px-2.5 py-1 text-xs font-medium',
  lg: 'rounded-md px-3 py-1.5 text-xs font-medium'
} as const;

export function UiButton({
  variant,
  size = 'md',
  className = '',
  children,
  disabled,
  ...rest
}: UiButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50';
  return (
    <button
      type="button"
      className={`${base} ${variantClass[variant]} ${sizeClass[size]} ${className}`.trim()}
      disabled={disabled}
      {...rest}>
      {children}
    </button>
  );
}
