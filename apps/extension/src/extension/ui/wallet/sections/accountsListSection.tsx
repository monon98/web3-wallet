import { AccountsListBase } from '~/components/common/wallet/accountsListBase';
import type { AccountsListSectionProps, WalletAccountSummary } from '~/types';

const ACCOUNTS_ORDER_HINT =
  '列表顺序决定侧栏首页默认 EVM 地址与待批准连接时的默认选中项；「上移」可将常用账户设为默认。';

function shortHex(addr: string, head: number = 8, tail: number = 6) {
  const s = addr.trim();
  if (s.length <= head + tail + 2) {
    return s;
  }
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

/**
 * **已导入账户管理**：顺序（与 vault 数组一致，第一项为默认展示/连接优先）、内联重命名、删除、清空。
 * 重命名在组件内完成，避免扩展侧栏中 `window.prompt` 体验与焦点问题。
 */
export function AccountsListSection({
  variant = 'panel',
  accounts,
  onRenameCommit,
  onMoveUp,
  onMoveDown,
  onRemove,
  onClearAll
}: AccountsListSectionProps) {
  const items = accounts.map((a: WalletAccountSummary, idx: number) => ({
    id: a.id,
    label: a.label,
    isDefault: idx === 0,
    order: idx + 1,
    extra: a
  }));

  return (
    <AccountsListBase
      variant={variant}
      title={`已导入 EVM 账户（${accounts.length}）`}
      orderHint={ACCOUNTS_ORDER_HINT}
      emptyText='暂无已导入 EVM 账户。请在下方「导入 EVM 账户」添加助记词或私钥后，再在网页中发起连接。'
      items={items}
      columns={[
        {
          header: '地址',
          renderCell: (it) => <code className='block break-all text-[11px]'>{it.extra.address}</code>
        },
        {
          header: '类型',
          className: 'whitespace-nowrap',
          renderCell: (it) => (
            <span className='text-[10px] text-[var(--ui-muted-fg)]'>
              {it.extra.walletKind === 'privateKey' ? '私钥' : '助记词'}
            </span>
          )
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
          <span>{it.extra.walletKind === 'privateKey' ? '私钥' : '助记词'}</span>
          <code className='break-all'>{shortHex(it.extra.address)}</code>
        </span>
      )}
      renderExpanded={(it) => (
        <>
          <div className='space-y-0.5'>
            <div className='text-[10px] text-[var(--ui-muted-fg)]'>地址</div>
            <code className='block break-all'>{it.extra.address}</code>
          </div>
          <div className='flex flex-wrap items-center gap-2 text-[10px] text-[var(--ui-muted-fg)]'>
            <span>ID</span>
            <code className='break-all'>{shortHex(it.extra.id, 10, 8)}</code>
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
