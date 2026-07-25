import { PanelSection, SegmentedControl, TableShell, TextInput, UiButton, UiTipBubble } from '@plugin/ui';
import { useState } from 'react';
import type { ReactNode } from 'react';

type DisplayMode = 'cards' | 'table';

export type AccountsListBaseItem<TExtra> = {
  id: string;
  label: string;
  /** 是否为默认账户（通常为列表第一项） */
  isDefault?: boolean;
  /** 1-based 顺序（仅用于展示） */
  order: number;
  extra: TExtra;
};

export type AccountsListBaseColumn<TExtra> = {
  header: ReactNode;
  className?: string;
  /** 表格单元格渲染（不含“名称/操作”列） */
  renderCell: (item: AccountsListBaseItem<TExtra>) => ReactNode;
};

export type AccountsListBaseProps<TExtra> = {
  variant?: 'panel' | 'plain';
  title: ReactNode;
  orderHint: string;
  emptyText: string;
  items: Array<AccountsListBaseItem<TExtra>>;
  columns: Array<AccountsListBaseColumn<TExtra>>;
  /** 卡片模式：标题下方的摘要行 */
  renderCardSummary: (item: AccountsListBaseItem<TExtra>) => ReactNode;
  /** 卡片模式：展开内容（除“操作按钮”外） */
  renderExpanded: (item: AccountsListBaseItem<TExtra>) => ReactNode;
  onRenameCommit: (id: string, label: string) => void | Promise<void>;
  onMoveUp: (id: string) => void | Promise<void>;
  onMoveDown: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void;
  onClearAll: () => void;
};

/**
 * 钱包域通用账户列表（EVM/TVM 复用）：卡片/表格切换、内联重命名、排序、删除与清空。
 * 业务侧仅需提供字段渲染与文案。
 */
export function AccountsListBase<TExtra>({
  variant = 'panel',
  title,
  orderHint,
  emptyText,
  items,
  columns,
  renderCardSummary,
  renderExpanded,
  onRenameCommit,
  onMoveUp,
  onMoveDown,
  onRemove,
  onClearAll
}: AccountsListBaseProps<TExtra>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState('');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('table');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const startEdit = (id: string, label: string) => {
    setEditingId(id);
    setDraftLabel(label);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraftLabel('');
  };

  const commitEdit = async () => {
    if (!editingId) {
      return;
    }
    const id = editingId;
    const label = draftLabel;
    await onRenameCommit(id, label);
    cancelEdit();
  };

  const modeSwitch =
    items.length > 0 ? (
      <SegmentedControl
        size='xs'
        value={displayMode}
        onChange={(v) => setDisplayMode(v as DisplayMode)}
        options={[
          { value: 'cards', label: '卡片' },
          { value: 'table', label: '表格' }
        ]}
      />
    ) : null;

  const actionsForRow = (id: string, label: string, idx: number) => (
    <div className='flex flex-wrap gap-1'>
      <UiButton
        variant='outline'
        size='xs'
        disabled={idx === 0}
        onClick={() => void onMoveUp(id)}
        title={idx === 0 ? '已是第一条' : '上移'}>
        上移
      </UiButton>
      <UiButton
        variant='outline'
        size='xs'
        disabled={idx === items.length - 1}
        onClick={() => void onMoveDown(id)}
        title={idx === items.length - 1 ? '已是最后一条' : '下移'}>
        下移
      </UiButton>
      <UiButton variant='secondary' size='xs' onClick={() => startEdit(id, label)}>
        重命名
      </UiButton>
      <UiButton variant='danger' size='xs' onClick={() => void onRemove(id)}>
        删除
      </UiButton>
    </div>
  );

  const list = (
    <>
      {items.length === 0 ? (
        <p className='text-[11px] leading-snug text-[var(--ui-muted-fg)]'>{emptyText}</p>
      ) : (
        <>
          {displayMode === 'cards' ? (
            <div className='grid grid-cols-1 gap-2'>
              {items.map((it, idx) => {
                const isExpanded = expandedId === it.id;
                const isEditing = editingId === it.id;
                return (
                  <div key={it.id} className='rounded border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-2'>
                    {isEditing ? (
                      <div className='space-y-1.5'>
                        <FieldLabelMini htmlFor={`acc-rename-${it.id}`}>显示名</FieldLabelMini>
                        <TextInput
                          id={`acc-rename-${it.id}`}
                          type='text'
                          value={draftLabel}
                          onChange={(e) => setDraftLabel(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void commitEdit();
                            }
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          autoComplete='off'
                          maxLength={48}
                          className='text-sm'
                        />
                        <div className='flex flex-wrap gap-1'>
                          <UiButton variant='primary' size='xs' onClick={() => void commitEdit()}>
                            保存
                          </UiButton>
                          <UiButton variant='outline' size='xs' onClick={cancelEdit}>
                            取消
                          </UiButton>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                          <div className='min-w-0'>
                            <div className='flex flex-wrap items-center gap-1'>
                              <span className='font-medium text-[var(--ui-fg)]'>{it.label}</span>
                              {it.isDefault ? (
                                <span className='rounded bg-[var(--ui-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ui-success)]'>
                                  默认
                                </span>
                              ) : null}
                              <span className='text-[10px] text-[var(--ui-muted-fg)]'>#{it.order}</span>
                            </div>
                            <div className='mt-0.5 text-[10px] text-[var(--ui-muted-fg)]'>{renderCardSummary(it)}</div>
                          </div>
                          <UiButton
                            variant='outline'
                            size='xs'
                            onClick={() => setExpandedId(isExpanded ? null : it.id)}>
                            {isExpanded ? '收起' : '查看更多'}
                          </UiButton>
                        </div>
                        {isExpanded ? (
                          <div className='mt-2 space-y-1.5 border-t border-[var(--ui-border)] pt-2 text-[11px] text-[var(--ui-fg)]'>
                            {renderExpanded(it)}
                            {actionsForRow(it.id, it.label, idx)}
                          </div>
                        ) : (
                          <div className='mt-2'>{actionsForRow(it.id, it.label, idx)}</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <TableShell>
              <thead className='bg-[var(--ui-surface-2)] text-[var(--ui-fg)]'>
                <tr>
                  <th scope='col' className='whitespace-nowrap px-2 py-2 font-semibold'>
                    顺序
                  </th>
                  <th scope='col' className='px-2 py-2 font-semibold'>
                    名称
                  </th>
                  {columns.map((c, i) => (
                    <th key={i} scope='col' className={`px-2 py-2 font-semibold ${c.className ?? ''}`.trim()}>
                      {c.header}
                    </th>
                  ))}
                  <th scope='col' className='whitespace-nowrap px-2 py-2 font-semibold'>
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className='divide-y divide-[var(--ui-border)]'>
                {items.map((it, idx) => (
                  <tr key={it.id} className='align-top'>
                    <td className='whitespace-nowrap px-2 py-2 text-[var(--ui-muted-fg)]'>
                      <span className='text-[10px]'>#{it.order}</span>
                      {it.isDefault ? (
                        <span className='ml-1 rounded bg-[var(--ui-surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--ui-success)]'>
                          默认
                        </span>
                      ) : null}
                    </td>
                    <td className='px-2 py-2'>
                      {editingId === it.id ? (
                        <div className='space-y-1.5'>
                          <FieldLabelMini htmlFor={`acc-rename-${it.id}`}>显示名</FieldLabelMini>
                          <TextInput
                            id={`acc-rename-${it.id}`}
                            type='text'
                            value={draftLabel}
                            onChange={(e) => setDraftLabel(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                void commitEdit();
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                cancelEdit();
                              }
                            }}
                            autoComplete='off'
                            maxLength={48}
                            className='text-sm'
                          />
                          <div className='flex flex-wrap gap-1'>
                            <UiButton variant='primary' size='xs' onClick={() => void commitEdit()}>
                              保存
                            </UiButton>
                            <UiButton variant='outline' size='xs' onClick={cancelEdit}>
                              取消
                            </UiButton>
                          </div>
                        </div>
                      ) : (
                        <span className='text-sm font-medium text-[var(--ui-fg)]'>{it.label}</span>
                      )}
                    </td>
                    {columns.map((c, i) => (
                      <td key={i} className={`px-2 py-2 ${c.className ?? ''}`.trim()}>
                        {c.renderCell(it)}
                      </td>
                    ))}
                    <td className='px-2 py-2'>{editingId === it.id ? null : actionsForRow(it.id, it.label, idx)}</td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </>
      )}

      {items.length > 0 ? (
        <UiButton variant='linkDanger' size='xs' className='mt-2 !px-0 !py-0' onClick={() => void onClearAll()}>
          清空全部账户
        </UiButton>
      ) : null}
    </>
  );

  const titleWithTip = (
    <span className='inline-flex flex-wrap items-center gap-2'>
      <span className='inline-flex items-center gap-1'>
        <span>{title}</span>
        <UiTipBubble content={orderHint} ariaLabel='账户顺序说明' />
      </span>
      {modeSwitch}
    </span>
  );

  if (variant === 'plain') {
    return (
      <div className='space-y-2'>
        <h3 className='flex flex-wrap items-center gap-1 text-[11px] font-semibold text-[var(--ui-fg)]'>
          {titleWithTip}
        </h3>
        {list}
      </div>
    );
  }

  return (
    <PanelSection title={titleWithTip} tone='muted'>
      {list}
    </PanelSection>
  );
}

function FieldLabelMini({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className='block text-[11px] font-medium text-[var(--ui-fg)]'>
      {children}
    </label>
  );
}
