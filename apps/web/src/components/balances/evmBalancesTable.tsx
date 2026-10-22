import { PartialErrorNotice } from '@/components/common/resultBlocks';
import { upstreamErrorMessage } from '@/lib/balancesApi';
import {
  ADDRESS_PAGE_SIZE,
  downloadCsv,
  formatCacheAge,
  formatEvmAmount,
  formatIsoTimestamp,
  shortAddress,
  TOKEN_PREVIEW_LIMIT,
  tokenAmountDisplay
} from '@/lib/balancesFormat';
import type { EvmBalanceResult } from '@plugin/shared';
import { TableShell, UiBadge, UiButton } from '@plugin/ui';
import { Fragment, useState } from 'react';

import { PaginationControls } from './paginationControls';

type Props = {
  result: EvmBalanceResult;
};

/** EVM 原生余额 + ERC-20 持仓表格；地址行分页，代币行可展开。 */
export function EvmBalancesTable({ result }: Props) {
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const totalPages = Math.max(
    1,
    Math.ceil(result.rows.length / ADDRESS_PAGE_SIZE)
  );
  const safePage = Math.min(page, totalPages);
  const pageRows = result.rows.slice(
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
      'native_balance',
      'native_balance_wei',
      'token_symbol',
      'token_name',
      'token_address',
      'token_quantity',
      'token_divisor',
      'error'
    ];
    const rows = result.rows.flatMap((row) => {
      const base = [
        row.address,
        formatEvmAmount(row.balanceWei),
        row.balanceWei
      ];
      if (!row.tokens || row.tokens.length === 0) {
        return [[...base, '', '', '', '', '', row.tokenError ?? '']];
      }
      return row.tokens.map((token) => [
        ...base,
        token.tokenSymbol,
        token.tokenName,
        token.tokenAddress,
        token.tokenQuantity,
        token.tokenDivisor,
        row.tokenError ?? ''
      ]);
    });
    downloadCsv(`balances-evm-${result.chainId}`, headers, rows);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">EVM 链 {result.chainId}</span>
          <UiBadge variant={result.source === 'rpc' ? 'success' : 'info'}>
            {result.source === 'rpc' ? '服务端 RPC' : 'Etherscan'}
          </UiBadge>
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
          disabled={result.rows.length === 0}>
          导出 CSV
        </UiButton>
      </div>

      {result.meta.stale ? (
        <PartialErrorNotice
          className="mb-2"
          message="上游暂时不可达，当前显示上一次成功查询的过期缓存。"
        />
      ) : null}

      {result.rows.length === 0 ? (
        <p className="text-sm text-[color:var(--ui-muted-fg)]">
          没有返回 EVM 地址结果。
        </p>
      ) : (
        <>
          <TableShell>
            <thead className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-2)] text-[color:var(--ui-text-muted)]">
              <tr>
                <th className="p-2">地址</th>
                <th className="p-2">原生币余额</th>
                <th className="p-2">ERC-20</th>
                <th className="p-2">状态</th>
                <th className="p-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const tokenCount = row.tokens?.length ?? 0;
                const isExpanded = expanded.has(row.address);
                const preview = row.tokens?.slice(0, TOKEN_PREVIEW_LIMIT) ?? [];
                return (
                  <Fragment key={row.address}>
                    <tr className="border-b border-[var(--ui-border)] align-top last:border-b-0">
                      <td className="p-2 font-mono" title={row.address}>
                        {shortAddress(row.address)}
                      </td>
                      <td className="p-2 font-mono">
                        {formatEvmAmount(row.balanceWei)}
                      </td>
                      <td className="p-2">
                        {row.tokens === undefined ? '—' : `${tokenCount} 个`}
                      </td>
                      <td className="p-2">
                        {row.tokenError ? (
                          <span
                            className="text-[color:var(--ui-warning)]"
                            title={upstreamErrorMessage(
                              row.tokenError,
                              row.tokenRetryAfterMs
                            )}>
                            {row.tokenStale ? '旧缓存' : '代币不可用'}
                          </span>
                        ) : row.tokenStale ? (
                          <span className="text-[color:var(--ui-warning)]">
                            旧缓存
                          </span>
                        ) : row.tokens === undefined ? (
                          '未查询'
                        ) : (
                          '正常'
                        )}
                      </td>
                      <td className="p-2">
                        {tokenCount > 0 ? (
                          <UiButton
                            variant="outline"
                            size="xs"
                            onClick={() => toggle(row.address)}>
                            {isExpanded ? '收起' : '查看代币'}
                          </UiButton>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                    {isExpanded && preview.length > 0 ? (
                      <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-2)] last:border-b-0">
                        <td colSpan={5} className="p-2">
                          {row.tokenError ? (
                            <PartialErrorNotice
                              className="mb-2"
                              message={upstreamErrorMessage(
                                row.tokenError,
                                row.tokenRetryAfterMs
                              )}
                            />
                          ) : null}
                          {row.tokenStale ? (
                            <p className="mb-2 text-xs text-[color:var(--ui-warning)]">
                              ERC-20 数据来自旧缓存（写入时间：
                              {row.tokenCachedAt
                                ? formatIsoTimestamp(row.tokenCachedAt)
                                : '未知'}
                              ）。
                            </p>
                          ) : null}
                          <TableShell>
                            <thead className="border-b border-[var(--ui-border)] text-[color:var(--ui-text-muted)]">
                              <tr>
                                <th className="p-1.5">代币</th>
                                <th className="p-1.5">数量</th>
                                <th className="p-1.5">合约</th>
                              </tr>
                            </thead>
                            <tbody>
                              {preview.map((token) => (
                                <tr
                                  key={token.tokenAddress}
                                  className="border-b border-[var(--ui-border)] last:border-b-0">
                                  <td className="p-1.5">
                                    {token.tokenSymbol || '—'}{' '}
                                    <span className="text-[color:var(--ui-text-muted)]">
                                      {token.tokenName}
                                    </span>
                                  </td>
                                  <td className="p-1.5 font-mono">
                                    {tokenAmountDisplay(
                                      token.tokenQuantity,
                                      token.tokenDivisor
                                    )}
                                  </td>
                                  <td
                                    className="p-1.5 font-mono"
                                    title={token.tokenAddress}>
                                    {shortAddress(token.tokenAddress)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </TableShell>
                          {tokenCount > TOKEN_PREVIEW_LIMIT ? (
                            <p className="mt-1 text-xs text-[color:var(--ui-text-muted)]">
                              仅显示前 {TOKEN_PREVIEW_LIMIT}{' '}
                              个代币；完整数据请导出 CSV。
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
            total={result.rows.length}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
