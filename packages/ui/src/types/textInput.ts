import type { InputHTMLAttributes } from 'react';

export type TextInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'className'
> & {
  className?: string;
};
