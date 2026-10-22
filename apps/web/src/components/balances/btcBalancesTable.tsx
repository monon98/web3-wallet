import { PartialErrorNotice } from '@/components/common/resultBlocks';
import { upstreamErrorMessage } from '@/lib/balancesApi';
import {
  ADDRESS_PAGE_SIZE,
  downloadCsv,
  formatBtcAmount,
  formatCacheAge,
  shortAddress
} from '@/lib/balancesFormat';
import type { BtcBalanceResult } from '@plugin/shared';
import { TableShell, UiBadge, UiButton } from '@plugin/ui';
import { useState } from 'react';

import { PaginationControls } from './paginationControls';

type Props = {
  result: BtcBalanceResult;
};

/** BTC 已确认 / 内存池余额表格（仅主网）。 */
export function BtcBalancesTable({ result }: Props) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(
    1,
    Math.ceil(result.addresses.length / ADDRESS_PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);
  const pageRows = result.addresses.slice(
    (safePage - 1) * ADDRESS_PAGE_SIZE,
    safePage * ADDRESS_PAGE_SIZE
  );

  function exportCsv() {
    const headers = [
      'address',
      'balance_btc',
      'balance_sat',
      'mempool_balance_btc',
      'mempool_balance_sat',
      'tx_count',
      'error'
    ];
    const rows = result.addresses.map((address) => [
      address.address,
      formatBtcAmount(address.balanceSat),
      address.balanceSat,
      formatBtcAmount(address.mempoolBalanceSat),
      address.mempoolBalanceSat,
      String(address.txCount),
      address.error ?? ''
    ]);
    downloadCsv('balances-btc', headers, rows);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">Bitcoin 主网（Esplora）</span>
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
          disabled={result.addresses.length === 0}>
          导出 CSV
        </UiButton>
      </div>

      {result.meta.stale ? (
        <PartialErrorNotice
          className="mb-2"
          message="Esplora 暂时不可达，当前显示上一次成功查询的过期缓存。"
        />
      ) : null}

      {result.addresses.length === 0 ? (
        <p className="text-sm text-[color:var(--ui-muted-fg)]">
          没有返回 BTC 地址结果。
        </p>
      ) : (
        <>
          <TableShell>
            <thead className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[color:var(--ui-text-muted)]">
              <tr>
                <th className="p-2">地址</th>
                <th className="p-2">已确认 BTC</th>
                <th className="p-2">内存池净变化</th>
                <th className="p-2">交易数</th>
                <th className="p-2">状态</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((address) => (
                <tr
                  key={address.address}
                  className="border-b border-[var(--ui-border)] last:border-b-0">
                  <td className="p-2 font-mono" title={address.address}>
                    {shortAddress(address.address)}
                  </td>
                  <td className="p-2 font-mono">
                    {formatBtcAmount(address.balanceSat)}
                  </td>
                  <td className="p-2 font-mono">
                    {formatBtcAmount(address.mempoolBalanceSat)}
                  </td>
                  <td className="p-2">{address.txCount}</td>
                  <td className="p-2">
                    {address.error ? (
                      <span
                        className="text-[color:var(--ui-warning)]"
                        title={upstreamErrorMessage(address.error)}>
                        查询失败
                      </span>
                    ) : (
                      '正常'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
          <PaginationControls
            page={safePage}
            pageSize={ADDRESS_PAGE_SIZE}
            total={result.addresses.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
