import { AccountsListBase } from '~/components/common/wallet/accountsListBase';
import type { TvmAccountSummary } from '~/types';

const ACCOUNTS_ORDER_HINT = '列表顺序决定 TVM 管理页默认展示顺序；「上移」可将常用账户设为默认。';

function shortMid(s: string, head: number = 10, tail: number = 8) {
  const x = s.trim();
  if (x.length <= head + tail + 2) {
    return x;
  }
  return `${x.slice(0, head)}…${x.slice(-tail)}`;
}

export type TvmAccountsListSectionProps = {
  variant?: 'panel' | 'plain';
  accounts: TvmAccountSummary[];
  onRenameCommit: (id: string, label: string) => void | Promise<void>;
  onMoveUp: (id: string) => void | Promise<void>;
  onMoveDown: (id: string) => void | Promise<void>;
  onRemove: (id: string) => void;
  onClearAll: () => void;
};

/**
 * **已导入 TVM 账户管理**：顺序（与 vault 数组一致）、内联重命名、删除、清空。
 * 交互与 `AccountsListSection`（EVM）对齐，避免使用 `window.prompt`。
 */
export function TvmAccountsListSection({
  variant = 'panel',
  accounts,
  onRenameCommit,
  onMoveUp,
  onMoveDown,
  onRemove,
  onClearAll
}: TvmAccountsListSectionProps) {
  const items = accounts.map((a: TvmAccountSummary, idx: number) => ({
    id: a.id,
    label: a.label,
    isDefault: idx === 0,
    order: idx + 1,
    extra: a
  }));

  return (
    <AccountsListBase
      variant={variant}
      title={`已导入 TVM 账户（${accounts.length}）`}
      orderHint={ACCOUNTS_ORDER_HINT}
      emptyText='暂无已导入 TVM 账户。请在下方「导入 TVM 账户」添加私钥，或在添加页生成新账户。'
      items={items}
      columns={[
        {
          header: 'Base58',
          renderCell: (it) => <code className='block break-all text-[11px]'>{it.extra.addressBase58}</code>
        },
        {
          header: 'Hex',
          renderCell: (it) => <code className='block break-all text-[11px]'>{it.extra.addressHex}</code>
        },
        {
          header: 'ID',
          className: 'whitespace-nowrap',
          renderCell: (it) => (
            <code className='block break-all text-[10px] text-[var(--ui-muted-fg)]'>{it.extra.id}</code>
          )
        }
      ]}
      renderCardSummary={(it) => (
        <span className='flex flex-wrap items-center gap-2'>
          <span>私钥</span>
          <code className='break-all'>{shortMid(it.extra.addressBase58)}</code>
        </span>
      )}
      renderExpanded={(it) => (
        <>
          <div className='space-y-0.5'>
            <div className='text-[10px] text-[var(--ui-muted-fg)]'>Base58</div>
            <code className='block break-all'>{it.extra.addressBase58}</code>
          </div>
          <div className='space-y-0.5'>
            <div className='text-[10px] text-[var(--ui-muted-fg)]'>Hex</div>
            <code className='block break-all'>{it.extra.addressHex}</code>
          </div>
          <div className='flex flex-wrap items-center gap-2 text-[10px] text-[var(--ui-muted-fg)]'>
            <span>ID</span>
            <code className='break-all'>{shortMid(it.extra.id, 10, 8)}</code>
          </div>
        </>
      )}
      onRenameCommit={onRenameCommit}
      onMoveUp={onMoveUp}
      onMoveDown={onMoveDown}
      onRemove={onRemove}
      onClearAll={onClearAll}
    />
  );
}
