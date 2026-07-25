import type { HTMLAttributes } from 'react';

export type UiSpinnerSize = 'sm' | 'md';

export type UiSpinnerProps = {
  size?: UiSpinnerSize;
  className?: string;
  /** 读屏文案；省略时视为纯装饰（`aria-hidden`） */
  label?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'>;
