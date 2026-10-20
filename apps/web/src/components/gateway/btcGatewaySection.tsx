import {
  apiErrorMessage,
  DEFAULT_BTC_ADDRESSES,
  formatBtcAmount,
  parseBtcAddressLines,
  readJson,
  shortAddress,
  type BtcAddressBalance,
  type BtcStatus
} from '@/lib/gatewayHelpers';
import { BTCEXPLORER_MAX_ADDRESSES_PER_BATCH } from '@plugin/shared';
import {
  FieldHint,
  FieldLabel,
  PanelSection,
  TableShell,
  TextArea,
  UiButton
} from '@plugin/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ErrorNotice, PartialErrorNotice, RawResult } from './resultBlocks';

type Props = {
  /** Fastify 基址（末尾无 `/`）；空串表示未配置 */
  apiBase: string;
};

type BtcQueryResult = {
  rows: BtcAddressBalance[];
  raw: string;
};

/** BTC 网关：单 / 批量地址余额（Esplora，仅主网）。 */
export function BtcGatewaySection({ apiBase }: Props) {
  const [addressesText, setAddressesText] = useState(DEFAULT_BTC_ADDRESSES);
  const [rows, setRows] = useState<BtcAddressBalance[] | null>(null);
  const [raw, setRaw] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['btc-status', apiBase],
    enabled: Boolean(apiBase),
    queryFn: async (): Promise<BtcStatus> => {
      const res = await fetch(`${apiBase}/api/v1/btc/status`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return readJson<BtcStatus>(res);
    }
  });

  const singleMutation = useMutation({
    mutationFn: async (): Promise<BtcQueryResult> => {
      const address = parseBtcAddressLines(addressesText)[0];
      if (!address) {
        throw new Error('至少填写一个地址');
      }
      const res = await fetch(
        `${apiBase}/api/v1/btc/explorer/address?address=${encodeURIComponent(address)}`
      );
      const body = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(body, res.status));
      }
      const row = JSON.parse(body) as BtcAddressBalance;
      return { rows: [row], raw: JSON.stringify(row, null, 2) };
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setRaw(data.raw);
    },
    onError: () => {
      setRows(null);
      setRaw(null);
    }
  });

  const batchMutation = useMutation({
    mutationFn: async (): Promise<BtcQueryResult> => {
      const addresses = parseBtcAddressLines(addressesText);
      if (addresses.length === 0) {
        throw new Error('至少填写一个地址');
      }
      const res = await fetch(`${apiBase}/api/v1/btc/explorer/addresses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses })
      });
      const body = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(body, res.status));
      }
      const data = JSON.parse(body) as { addresses: BtcAddressBalance[] };
      return {
        rows: data.addresses,
        raw: JSON.stringify(data, null, 2)
      };
    },
    onSuccess: (data) => {
      setRows(data.rows);
      setRaw(data.raw);
    },
    onError: () => {
      setRows(null);
      setRaw(null);
    }
  });

  const busy = singleMutation.isPending || batchMutation.isPending;
  const actionError = batchMutation.isError
    ? batchMutation.error
    : singleMutation.isError
      ? singleMutation.error
      : null;

  return (
    <PanelSection
      title="BTC · 地址余额（Esplora）"
      description="GET /api/v1/btc/explorer/address · POST /api/v1/btc/explorer/addresses（服务端按地址串行）">
      {statusQuery.data ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          数据源：
          {statusQuery.data.apiUrlConfigured
            ? '自定义 Esplora 端点（SERVER_BTC_API_URL）'
            : '默认 Blockstream 公共 Esplora'}
          {' · '}
          批量串行间隔 {statusQuery.data.minIntervalMs}ms
        </p>
      ) : null}
      {statusQuery.isError ? (
        <ErrorNotice
          className="mt-2"
          message={`无法获取 BTC 状态：${(statusQuery.error as Error).message}`}
        />
      ) : null}

      <FieldLabel className="mt-4">
        BTC 地址（每行一个或逗号分隔，仅主网 1 / 3 / bc1 开头；每批最多{' '}
        {BTCEXPLORER_MAX_ADDRESSES_PER_BATCH} 个）
        <TextArea
          className="mt-1.5"
          rows={3}
          value={addressesText}
          onChange={(e) => setAddressesText(e.target.value)}
        />
      </FieldLabel>

      <div className="mt-3 flex flex-wrap gap-2">
        <UiButton
          variant="primary"
          size="sm"
          disabled={!apiBase || busy}
          onClick={() => {
            batchMutation.reset();
            singleMutation.mutate();
          }}>
          {singleMutation.isPending ? '请求中…' : '单地址查询（取第一行）'}
        </UiButton>
        <UiButton
          variant="outline"
          size="sm"
          disabled={!apiBase || busy}
          onClick={() => {
            singleMutation.reset();
            batchMutation.mutate();
          }}>
          {batchMutation.isPending ? '请求中（串行，可能较慢）…' : '批量查询'}
        </UiButton>
      </div>

      {actionError ? (
        <ErrorNotice
          className="mt-3"
          message={
            actionError.message === 'invalid_address'
              ? 'invalid_address（仅支持主网 1 / 3 / bc1 地址）'
              : actionError.message
          }
        />
      ) : null}

      {rows ? (
        <div className="mt-4">
          <TableShell>
            <thead>
              <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-2)]">
                <th className="px-3 py-2 font-medium">地址</th>
                <th className="px-3 py-2 font-medium">已确认余额（BTC）</th>
                <th className="px-3 py-2 font-medium">内存池净变化（BTC）</th>
                <th className="px-3 py-2 font-medium">交易数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={`${row.address}-${index}`}
                  className="border-b border-[var(--ui-border)] last:border-0">
                  <td
                    className="px-3 py-2 font-mono text-xs"
                    title={row.address}>
                    {shortAddress(row.address)}
                  </td>
                  {row.error ? (
                    <td className="px-3 py-2" colSpan={3}>
                      <PartialErrorNotice message={row.error} />
                    </td>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-mono text-xs">
                        {formatBtcAmount(row.balanceSat)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {formatBtcAmount(row.mempoolBalanceSat)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {row.txCount}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </TableShell>
          <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
            共 {rows.length} 个地址；已确认余额来自
            chain_stats，内存池列为未确认净变化。
          </p>
        </div>
      ) : null}

      <FieldHint className="mt-2">
        BTC 余额以 sat÷10⁸ 换算展示；仅支持主网地址，测试网地址会被服务端拒绝。
      </FieldHint>

      <RawResult raw={raw} />
    </PanelSection>
  );
}
