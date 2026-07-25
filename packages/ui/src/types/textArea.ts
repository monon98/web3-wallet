import type { TextareaHTMLAttributes } from 'react';

export type TextAreaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'className'
> & {
  className?: string;
};
