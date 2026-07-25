import type { LabelHTMLAttributes, ReactNode } from 'react';

export type FieldLabelProps = {
  children: ReactNode;
  className?: string;
} & Omit<LabelHTMLAttributes<HTMLLabelElement>, 'className'>;
