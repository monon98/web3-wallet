'use client';

import { useId } from 'react';

import type { UiTipBubblePlacement, UiTipBubbleProps } from './types';

const placementClass: Record<UiTipBubblePlacement, string> = {
  top: 'bottom-full left-1/2 mb-1.5 -translate-x-1/2',
  bottom: 'top-full left-1/2 mt-1.5 -translate-x-1/2',
  left: 'right-full top-1/2 mr-1.5 -translate-y-1/2',
  right: 'left-full top-1/2 ml-1.5 -translate-y-1/2'
};

/**
 * **悬停 / 聚焦** 显示的提示气泡（轻量 CSS `group-hover` + `focus-within`），与块级 {@link UiAlert}、行内 {@link FieldHint} 区分。
 * 默认触发器为可聚焦按钮，配合 `aria-describedby` 供读屏关联气泡文案。
 */
export function UiTipBubble({
  content,
  placement = 'top',
  className = '',
  contentClassName = '',
  ariaLabel = '查看说明'
}: UiTipBubbleProps) {
  const tipId = useId();

  const bubble = (
    <div
      id={tipId}
      role="tooltip"
      className={`pointer-events-none absolute z-50 min-w-[11rem] max-w-[min(18rem,calc(100vw-2rem))] rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-1)] px-2 py-1.5 text-[11px] leading-snug text-[var(--ui-fg)] shadow-[var(--ui-shadow-sm)] opacity-0 transition-opacity duration-150 ease-out invisible group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 ${placementClass[placement]} ${contentClassName}`.trim()}>
      {content}
    </div>
  );

  return (
    <span
      className={`group relative inline-flex items-center ${className}`.trim()}>
      <button
        type="button"
        className="inline-flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-[var(--ui-border)] text-[9px] font-bold text-[var(--ui-muted-fg)] tabular-nums hover:bg-[var(--ui-surface-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[color:var(--ui-info)]"
        aria-label={ariaLabel}
        aria-describedby={tipId}>
        ?
      </button>
      {bubble}
    </span>
  );
}
