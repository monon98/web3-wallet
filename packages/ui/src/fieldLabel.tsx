import type { FieldLabelProps } from './types';

export function FieldLabel({
  children,
  className = '',
  ...rest
}: FieldLabelProps) {
  return (
    <label
      className={`mb-1 block text-sm text-[var(--ui-fg)] opacity-90 ${className}`.trim()}
      {...rest}>
      {children}
    </label>
  );
}
