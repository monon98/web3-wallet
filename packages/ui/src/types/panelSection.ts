import type { ReactNode } from 'react';

export type PanelSectionTone = 'default' | 'amber' | 'muted';

export type PanelSectionProps = {
  title?: ReactNode;
  description?: string;
  tone?: PanelSectionTone;
  className?: string;
  /** 可省略：仅标题/描述时作为提示块使用 */
  children?: ReactNode;
};
