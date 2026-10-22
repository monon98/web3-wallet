import { PartialErrorNotice } from '@/components/common/resultBlocks';
import { upstreamErrorMessage } from '@/lib/balancesApi';
import {
  ADDRESS_PAGE_SIZE,
  downloadCsv,
  formatCacheAge,
  formatTronAmount,
  shortAddress,
  TOKEN_PREVIEW_LIMIT
} from '@/lib/balancesFormat';
import type { TronBalanceResult } from '@plugin/shared';
import { TableShell, UiBadge, UiButton } from '@plugin/ui';
import { Fragment, useState } from 'react';

import { PaginationControls } from './paginationControls';

type Props = {
  result: TronBalanceResult;
};

/** TRX + TRC-20 持仓表格；单地址失败保留在行内错误列。 */
export function TronBalancesTable({ result }: Props) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const totalPages = Math.max(
    1,
    Math.ceil(result.accounts.length / ADDRESS_PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);
  const pageRows = result.accounts.slice(
    (safePage - 1) * ADDRESS_PAGE_SIZE,
    safePage * ADDRESS_PAGE_SIZE
  );

  function toggle(address: string) {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(address)) {
        next.delete(address);
      } else {
        next.add(address);
      }
      return next;
    });
  }

  function exportCsv() {
    const headers = [
      'address',
      'balance_trx',
      'balance_sun',
      'trc20_contract',
      'trc20_balance_raw',
      'error'
    ];
    const rows = result.accounts.flatMap((account) => {
      const base = [
        account.address,
        formatTronAmount(account.balanceSun),
        account.balanceSun
      ];
      if (account.trc20.length === 0) {
        return [[...base, '', '', account.error ?? '']];
      }
      return account.trc20.map((token) => [
        ...base,
        token.contractAddress,
        token.balanceRaw,
        account.error ?? ''
      ]);
    });
    downloadCsv('balances-tron', headers, rows);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Tron（TronGrid）</span>
          {result.meta.cached ? (
            <UiBadge variant="neutral">
              缓存 {formatCacheAge(result.meta.cacheAgeMs)}
            </UiBadge>
          ) : null}
          {result.meta.stale ? (
            <UiBadge variant="warning">stale 缓存</UiBadge>
          ) : null}
        </div>
        <UiButton
          variant="outline"
          size="sm"
          onClick={exportCsv}
          disabled={result.accounts.length === 0}>
          导出 CSV
        </UiButton>
      </div>

      {result.meta.stale ? (
        <PartialErrorNotice
          className="mb-2"
          message="TronGrid 暂时不可达，当前显示上一次成功查询的过期缓存。"
        />
      ) : null}

      {result.accounts.length === 0 ? (
        <p className="text-sm text-[color:var(--ui-muted-fg)]">
          没有返回 Tron 地址结果。
        </p>
      ) : (
        <>
          <TableShell>
            <thead className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[color:var(--ui-text-muted)]">
              <tr>
                <th className="p-2">地址</th>
                <th className="p-2">TRX</th>
                <th className="p-2">TRC-20</th>
                <th className="p-2">状态</th>
                <th className="p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((account) => {
                const isExpanded = expanded.has(account.address);
                const preview = account.trc20.slice(0, TOKEN_PREVIEW_LIMIT);
                return (
                  <Fragment key={account.address}>
                    <tr className="border-b border-[var(--ui-border)] align-top last:border-b-0">
                      <td className="p-2 font-mono" title={account.address}>
                        {shortAddress(account.address)}
                      </td>
                      <td className="p-2 font-mono">
                        {formatTronAmount(account.balanceSun)}
                      </td>
                      <td className="p-2">{account.trc20.length} 个</td>
                      <td className="p-2">
                        {account.error ? (
                          <span
                            className="text-[color:var(--ui-warning)]"
                            title={upstreamErrorMessage(account.error)}>
                            查询失败
                          </span>
                        ) : (
                          '正常'
                        )}
                      </td>
                      <td className="p-2">
                        {account.trc20.length > 0 ? (
                          <UiButton
                            variant="outline"
                            size="xs"
                            onClick={() => toggle(account.address)}>
                            {isExpanded ? '收起' : '查看 TRC-20'}
                          </UiButton>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                    {isExpanded && preview.length > 0 ? (
                      <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-2)] last:border-b-0">
                        <td colSpan={5} className="p-2">
                          {account.error ? (
                            <PartialErrorNotice
                              className="mb-2"
                              message={upstreamErrorMessage(account.error)}
                            />
                          ) : null}
                          <TableShell>
                            <thead className="border-b border-[var(--ui-border)] text-[color:var(--ui-text-muted)]">
                              <tr>
                                <th className="p-1.5">合约地址</th>
                                <th className="p-1.5">原始数量</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.map((token) => (
                                <tr
                                  key={token.contractAddress}
                                  className="border-b border-[var(--ui-border)] last:border-b-0">
                                  <td
                                    className="p-1.5 font-mono"
                                    title={token.contractAddress}>
                                    {shortAddress(token.contractAddress)}
                                  </td>
                                  <td className="p-1.5 font-mono">
                                    {token.balanceRaw}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </TableShell>
                          {account.trc20.length > TOKEN_PREVIEW_LIMIT ? (
                            <p className="mt-1 text-xs text-[color:var(--ui-text-muted)]">
                              仅显示前 {TOKEN_PREVIEW_LIMIT} 个
                              TRC-20；完整数据请导出 CSV。
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </TableShell>
          <PaginationControls
            page={safePage}
            pageSize={ADDRESS_PAGE_SIZE}
            total={result.accounts.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
