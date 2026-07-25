import type { SelectFieldProps } from './types';

const selectClass =
  'mb-2 w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-2 text-sm text-[var(--ui-fg)]';

export function SelectField({ className = '', ...rest }: SelectFieldProps) {
  return <select className={`${selectClass} ${className}`.trim()} {...rest} />;
}
