import type { ReactNode } from 'react';

export type FieldHintVariant = 'neutral' | 'error' | 'success';

export type FieldHintProps = {
  children: ReactNode;
  /** 语义色：错误态会设置 `role="alert"` 便于读屏 */
  variant?: FieldHintVariant;
  className?: string;
  /** 与 `aria-describedby` 指向的控件 id 配对 */
  id?: string;
};
