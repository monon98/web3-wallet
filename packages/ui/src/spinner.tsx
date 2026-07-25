import type { UiSpinnerProps, UiSpinnerSize } from './types';

const sizeClass: Record<UiSpinnerSize, string> = {
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-5 w-5 border-2'
};

/**
 * 内联加载指示器；依赖 UnoCSS / Tailwind 兼容预设中的 `animate-spin`。
 */
export function UiSpinner({
  size = 'md',
  className = '',
  label,
  ...rest
}: UiSpinnerProps) {
  const ring =
    'inline-block shrink-0 rounded-full border-neutral-200 border-t-emerald-600 animate-spin';
  return (
    <span
      className={`inline-flex items-center ${className}`.trim()}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      {...rest}>
      <span
        className={`${ring} ${sizeClass[size]}`.trim()}
        aria-hidden={label ? true : undefined}
      />
    </span>
  );
}
