import { UiButton } from './button';
import { TextInput } from './textInput';
import type { InlineEditableTextProps } from './types';

/**
 * 内联可编辑文本：展示态 ↔ 编辑态（Enter 提交、Escape 取消）。
 * 由外部控制 `draftValue` 与提交时机；组件只处理键盘与基础布局。
 */
export function InlineEditableText({
  id,
  value,
  isEditing,
  draftValue,
  onDraftValueChange,
  onStartEdit,
  onCancel,
  onCommit,
  maxLength = 48,
  className = ''
}: InlineEditableTextProps) {
  if (!isEditing) {
    return (
      <span
        className={`inline-flex min-w-0 items-center gap-2 ${className}`.trim()}>
        <span className="min-w-0 truncate text-sm font-medium text-[var(--ui-fg)]">
          {value}
        </span>
        <UiButton variant="secondary" size="xs" onClick={onStartEdit}>
          重命名
        </UiButton>
      </span>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      <TextInput
        id={id}
        type="text"
        value={draftValue}
        onChange={(e) => onDraftValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void onCommit();
          }
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        autoComplete="off"
        maxLength={maxLength}
        className="text-sm"
      />
      <div className="flex flex-wrap gap-1">
        <UiButton variant="primary" size="xs" onClick={() => void onCommit()}>
          保存
        </UiButton>
        <UiButton variant="outline" size="xs" onClick={onCancel}>
          取消
        </UiButton>
      </div>
    </div>
  );
}
