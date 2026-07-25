import { UiButton } from './button';
import type { SegmentedControlOption, SegmentedControlProps } from './types';

/**
 * 轻量分段切换（用按钮实现），用于模式切换（如：卡片/表格、批量/单个）。
 * 仅负责展示与交互，不强制特定业务语义。
 */
export function SegmentedControl({
  options,
  value,
  onChange,
  size = 'sm',
  className = ''
}: SegmentedControlProps) {
  const normalized = options.filter(Boolean);
  const hasValue = normalized.some((o) => o.value === value);
  const active = hasValue ? value : normalized[0]?.value;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()} role="group">
      {normalized.map((o: SegmentedControlOption) => (
        <UiButton
          key={o.value}
          variant={o.value === active ? 'outlineActive' : 'outline'}
          size={size}
          onClick={() => onChange(o.value)}>
          {o.label}
        </UiButton>
      ))}
    </div>
  );
}
