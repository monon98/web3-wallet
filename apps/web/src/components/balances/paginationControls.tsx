import { UiButton } from '@plugin/ui';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

/** 表格底部分页（客户端分页；数据量上限由服务端每链 20 个地址约束）。 */
export function PaginationControls({
  page,
  pageSize,
  total,
  onPageChange
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--ui-text-muted)]">
      <span>
        第 {safePage} / {totalPages} 页 · 共 {total} 条
      </span>
      <span className="flex items-center gap-1">
        <UiButton
          variant="outline"
          size="xs"
          disabled={safePage <= 1}
          onClick={() => onPageChange(safePage - 1)}>
          上一页
        </UiButton>
        <UiButton
          variant="outline"
          size="xs"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(safePage + 1)}>
          下一页
        </UiButton>
      </span>
    </div>
  );
}
