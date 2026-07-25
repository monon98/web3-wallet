import type { ReactNode } from 'react';

export type UiTipBubblePlacement = 'top' | 'bottom' | 'left' | 'right';

export type UiTipBubbleProps = {
  /** 气泡内说明（可为多行短文案） */
  content: ReactNode;
  /** 气泡相对触发器出现位置 */
  placement?: UiTipBubblePlacement;
  /** 包裹触发器与气泡的外层 class */
  className?: string;
  /** 气泡内容区额外 class */
  contentClassName?: string;
  /** 默认触发器 `aria-label` */
  ariaLabel?: string;
};
