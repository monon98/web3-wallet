import type { ReactNode } from 'react';

import type { UiButtonSize } from './button';

export type SegmentedControlOption = {
  value: string;
  label: ReactNode;
};

export type SegmentedControlProps = {
  options: SegmentedControlOption[];
  value: string;
  onChange: (nextValue: string) => void;
  size?: UiButtonSize;
  className?: string;
};
