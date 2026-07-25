import type { SelectHTMLAttributes } from 'react';

export type SelectFieldProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'className'
> & {
  className?: string;
};
