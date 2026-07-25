import type { TableShellProps } from './types';

/**
 * 统一的表格外壳：处理横向滚动、边框、背景等基础样式。
 * 仅提供布局与通用样式，不绑定具体表格列/语义。
 */
export function TableShell({
  className = '',
  tableClassName = '',
  children
}: TableShellProps) {
  return (
    <div
      className={`overflow-x-auto rounded border border-[var(--ui-border)] bg-[var(--ui-surface-1)] ${className}`.trim()}>
      <table
        className={`w-full table-auto text-left text-[11px] ${tableClassName}`.trim()}>
        {children}
      </table>
    </div>
  );
}
