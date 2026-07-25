import type { TextAreaProps } from './types';

const areaClass =
  'w-full resize-y rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-2 font-mono text-sm text-[var(--ui-fg)] placeholder:text-[var(--ui-muted-fg)]';

export function TextArea({ className = '', ...rest }: TextAreaProps) {
  return <textarea className={`${areaClass} ${className}`.trim()} {...rest} />;
}
