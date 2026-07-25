import type { TextInputProps } from './types';

const inputClass =
  'w-full rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-2 text-sm text-[var(--ui-fg)] placeholder:text-[var(--ui-muted-fg)]';

export function TextInput({ className = '', ...rest }: TextInputProps) {
  return <input className={`${inputClass} ${className}`.trim()} {...rest} />;
}
