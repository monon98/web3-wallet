import type { FieldHintProps, FieldHintVariant } from './types';

const variantClass: Record<FieldHintVariant, string> = {
  neutral: 'text-[var(--ui-muted-fg)]',
  error: 'text-[var(--ui-danger)]',
  success: 'text-[var(--ui-success)]'
};

/**
 * 表单项下方的说明或校验结果；与 FieldLabel、TextInput 等搭配。
 */
export function FieldHint({
  children,
  variant = 'neutral',
  className = '',
  id
}: FieldHintProps) {
  return (
    <p
      id={id}
      className={`mt-1 text-xs leading-snug ${variantClass[variant]} ${className}`.trim()}
      role={variant === 'error' ? 'alert' : undefined}>
      {children}
    </p>
  );
}
