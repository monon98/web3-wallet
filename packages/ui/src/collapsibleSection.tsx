'use client';

import { useCallback, useState } from 'react';

import type { CollapsibleSectionProps } from './types';

export function CollapsibleSection({
  title,
  summary,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  children,
  className = ''
}: CollapsibleSectionProps) {
  const [uncontrolled, setUncontrolled] = useState(defaultOpen);
  const open = controlledOpen ?? uncontrolled;

  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      if (controlledOpen === undefined) {
        setUncontrolled(next);
      }
    },
    [controlledOpen, onOpenChange]
  );

  const toggle = useCallback(() => setOpen(!open), [open, setOpen]);

  return (
    <div
      className={`mb-3 overflow-hidden rounded-lg border border-neutral-200 bg-white text-xs ${className}`.trim()}>
      <button
        type="button"
        className="flex w-full items-start gap-2 border-b border-neutral-100 bg-neutral-50/80 px-3 py-2 text-left transition-colors hover:bg-neutral-100/80"
        onClick={toggle}
        aria-expanded={open}>
        <span className="mt-0.5 shrink-0 font-mono text-[10px] text-neutral-500">
          {open ? '▼' : '▶'}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-neutral-800">{title}</div>
          {!open ? (
            <p
              className="mt-0.5 truncate text-[11px] text-neutral-500"
              title={summary}>
              {summary}
            </p>
          ) : null}
        </div>
      </button>
      {open ? <div className="px-3 py-3">{children}</div> : null}
    </div>
  );
}
