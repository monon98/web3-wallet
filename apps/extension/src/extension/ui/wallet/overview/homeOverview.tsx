import { useEffect, useState } from 'react';

import { evmTxSubmitSummaryText } from '~/hooks/walletPanelHelpers';
import type { WalletHomeOverviewProps } from '~/types';
import { openTab } from '~lib/extension';
import { listTvmAccountSummaries } from '~lib/vault/tvmRecord';

/**
 * **概览首页**：功能入口（账户列表 / 工具页 / **DApp 全局设置**子页等）；默认 EVM/TVM 展示已迁至全局设置页。
 */
export function WalletHomeOverview({
  hasEvmAccounts,
  accountsSectionSummary,
  connectedSitesSummary,
  authPolicySummary,
  evmTxSubmitMode,
  onNavigate
}: WalletHomeOverviewProps) {
  const accountHint = hasEvmAccounts
    ? '列表第一项为默认 EVM 账户；在管理页「上移」可调整'
    : '尚未导入，点击打开 EVM 管理页（新标签页）';

  const [tvmCount, setTvmCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const list = await listTvmAccountSummaries();
      if (!cancelled) {
        setTvmCount(list.length);
      }
    };

    void refresh();

    const onChanged = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
      if (areaName !== 'local') {
        return;
      }
      if (changes.web3_wallet_tvm_accounts_bundle_v1) {
        void refresh();
      }
    };

    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      cancelled = true;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }, []);

  const dappGlobalSummary = [evmTxSubmitSummaryText(evmTxSubmitMode), connectedSitesSummary, authPolicySummary].join(
    ' · '
  );

  return (
    <div className='space-y-3'>
      <nav className='space-y-2' aria-label='钱包功能入口'>
        <OverviewNavRow
          title='DApp 全局设置'
          summary={dappGlobalSummary}
          hint='默认账户、网络与自定义 RPC、交易提交方式、已连接网站、站点授权策略'
          onClick={() => onNavigate('settings')}
        />
        <OverviewNavRow
          title='EVM 账户列表'
          summary={accountsSectionSummary}
          hint={accountHint}
          onClick={() => openTab('tabs/evmAccounts.html')}
        />
        <OverviewNavRow
          title='TVM(Tron) 账户列表'
          summary={`${tvmCount} 个已保存 TVM 账户`}
          hint={tvmCount > 0 ? '列表第一项为默认 TVM；点击打开管理页' : '尚未导入，点击打开 TVM 管理页（新标签页）'}
          onClick={() => openTab('tabs/tvmAccounts.html')}
        />
        <OverviewNavRow
          title='多链地址生成器'
          summary='EVM / TVM / BTC 助记词 HD 派生'
          hint='新标签页工具：可选路径模板、私钥列与 CSV/JSON 导出，不落盘'
          onClick={() => openTab('tabs/generateAccounts.html')}
        />
      </nav>
    </div>
  );
}

function OverviewNavRow({
  title,
  summary,
  hint,
  onClick
}: {
  title: string;
  summary: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      className='flex w-full min-w-0 items-start justify-between gap-2 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-1)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--ui-surface-2)] sm:px-3.5'
      onClick={onClick}>
      <div className='min-w-0 flex-1'>
        <div className='text-sm font-semibold text-[var(--ui-fg)]'>{title}</div>
        <p
          className='mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--ui-muted-fg)] sm:line-clamp-none sm:truncate'
          title={summary}>
          {summary}
        </p>
        <p className='mt-0.5 break-words text-[10px] leading-snug text-[var(--ui-muted-fg)]'>{hint}</p>
      </div>
      <span className='shrink-0 pt-0.5 text-[var(--ui-muted-fg)]' aria-hidden>
        ›
      </span>
    </button>
  );
}
