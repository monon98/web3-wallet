import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type UiButtonVariant =
  | 'primary'
  | 'secondary'
  | 'neutral'
  | 'danger'
  | 'outline'
  | 'outlineActive'
  | 'linkDanger';

export type UiButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export type UiButtonProps = {
  variant: UiButtonVariant;
  size?: UiButtonSize;
  className?: string;
  children: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type'>;
