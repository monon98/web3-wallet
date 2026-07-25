import { PanelSection, UiButton } from '@plugin/ui';

import type { PendingConnectSectionProps } from '~/types';

/**
 * 侧栏内联审批：与独立 `siteConnect` 弹窗二选一展示挂起的 `origin` 与账户单选。
 * 用户点击批准/拒绝时的日志在 `useWalletPanel`（`panel_*`）与 `background`（`runtime_*`）。
 */
export function PendingConnectSection({
  pending,
  choices,
  selectedAddress,
  onSelectAddress,
  onApprove,
  onReject
}: PendingConnectSectionProps) {
  return (
    <PanelSection title='站点请求连接' description='一般会弹出审批窗口；也可在此选择账户后批准。' tone='amber'>
      <p className='mb-1 break-all opacity-90'>{pending.origin}</p>
      {choices.length > 0 ? (
        <ul className='my-2 max-h-28 overflow-y-auto rounded border border-[var(--ui-border)] bg-[var(--ui-surface-1)]/80 p-1'>
          {choices.map((c) => (
            <li key={c.key} className='list-none'>
              <label className='flex cursor-pointer items-start gap-2 rounded px-1 py-1 hover:bg-[var(--ui-surface-2)]'>
                <input
                  type='radio'
                  name='panel-acc'
                  className='mt-0.5'
                  checked={selectedAddress.toLowerCase() === c.address.toLowerCase()}
                  onChange={() => onSelectAddress(c.address)}
                />
                <span className='text-[11px] leading-snug'>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className='my-2 rounded border border-[var(--ui-warning)] bg-[var(--ui-surface-2)] p-2 text-[11px] text-[var(--ui-fg)]'>
          暂无本地 EVM 账户。请打开「EVM 管理页（新标签页）」添加助记词或私钥后，再批准连接。
        </p>
      )}
      <div className='mt-2 flex flex-wrap gap-2'>
        <UiButton variant='primary' size='md' disabled={choices.length === 0} onClick={onApprove}>
          批准连接
        </UiButton>
        <UiButton variant='neutral' size='md' onClick={onReject}>
          拒绝
        </UiButton>
      </div>
    </PanelSection>
  );
}
