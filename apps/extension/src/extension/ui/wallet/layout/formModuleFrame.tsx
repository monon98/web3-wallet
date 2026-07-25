import type { ReactNode } from 'react';

export type FormModuleFrameProps = {
  children: ReactNode;
  /** 子树根为 `section`（如 `PanelSection`）时去掉其 `mb-3`，避免与外框叠边 */
  resetSectionMargin?: boolean;
};

/**
 * 表单 / 设置页 **模块外框**：与 `WalletViewGlobalSettings` 视觉一致，用于新标签页导入等长表单分段。
 */
export function FormModuleFrame({ children, resetSectionMargin = false }: FormModuleFrameProps) {
  const reset = resetSectionMargin ? '[&>section]:mb-0' : '';
  return (
    <div
      className={`rounded-xl border-2 border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-3.5 shadow-sm sm:p-4 ${reset}`.trim()}>
      {children}
    </div>
  );
}
