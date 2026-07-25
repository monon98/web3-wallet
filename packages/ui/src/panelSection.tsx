import type { PanelSectionProps, PanelSectionTone } from './types';

const toneWrap: Record<PanelSectionTone, string> = {
  default:
    'border-[var(--ui-border)] bg-[var(--ui-surface-1)] text-[var(--ui-fg)]',
  amber:
    'border-[color:var(--ui-warning)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]',
  muted:
    'border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[var(--ui-fg)]'
};

const titleClass: Record<PanelSectionTone, string> = {
  default: 'text-[var(--ui-fg)]',
  amber: 'text-[var(--ui-fg)]',
  muted: 'text-[var(--ui-fg)]'
};

export function PanelSection({
  title,
  description,
  tone = 'default',
  className = '',
  children
}: PanelSectionProps) {
  return (
    <section
      className={`mb-3 rounded-lg border p-4 text-sm ${toneWrap[tone]} ${className}`.trim()}>
      {title ? (
        <h2
          className={`mb-2 text-base font-semibold ${titleClass[tone]}`.trim()}>
          {title}
        </h2>
      ) : null}
      {description ? (
        <p className="mb-2 leading-snug text-[var(--ui-muted-fg)]">
          {description}
        </p>
      ) : null}
      {children}
    </section>
  );
}
