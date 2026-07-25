import type { ReactNode } from 'react';

export type CollapsibleSectionProps = {
  title: string;
  /** 折叠时展示的一行摘要 */
  summary: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};
