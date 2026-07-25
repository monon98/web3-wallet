import type { HTMLAttributes, ReactNode } from 'react';

export type UiBadgeVariant =
  | 'neutral'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

export type UiBadgeProps = {
  children: ReactNode;
  variant?: UiBadgeVariant;
  className?: string;
} & Omit<HTMLAttributes<HTMLSpanElement>, 'className' | 'children'>;
