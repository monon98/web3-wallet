import type { HTMLAttributes } from 'react';

export type UiDividerProps = Omit<
  HTMLAttributes<HTMLHRElement>,
  'className'
> & {
  className?: string;
};
