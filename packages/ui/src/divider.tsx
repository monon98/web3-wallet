import type { UiDividerProps } from './types';

/**
 * 区块之间的水平分隔线；语义为 `hr`，默认上下留白。
 */
export function UiDivider({ className = '', ...rest }: UiDividerProps) {
  return (
    <hr
      className={`my-3 border-0 border-t border-[var(--ui-border)] ${className}`.trim()}
      {...rest}
    />
  );
}
