import {
  apiErrorMessage,
  DEFAULT_TRON_ADDRESSES,
  parseTronAddressLines,
  readJson,
  shortAddress,
  TRC20_PREVIEW_LIMIT,
  type TronAccountBalances,
  type TronAccountsResponse,
  type TronStatus
} from '@/lib/gatewayHelpers';
import { TRONEXPLORER_MAX_ADDRESSES_PER_BATCH } from '@plugin/shared';
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
import { formatUnits } from 'viem';

import { ErrorNotice, PartialErrorNotice, RawResult } from './resultBlocks';

type Props = {
  /** Fastify 基址（末尾无 `/`）；空串表示未配置 */
  apiBase: string;
};

/** Tron 网关：单 / 批量账户余额（TRX + TRC-20 原始数量，数据源 TronGrid）。 */
export function TronGatewaySection({ apiBase }: Props) {
  const [addressesText, setAddressesText] = useState(DEFAULT_TRON_ADDRESSES);
  const [accounts, setAccounts] = useState<TronAccountBalances[] | null>(null);
  const [raw, setRaw] = useState<string | null>(null);

  const statusQuery = useQuery({
    queryKey: ['tron-status', apiBase],
    enabled: Boolean(apiBase),
    queryFn: async (): Promise<TronStatus> => {
      const res = await fetch(`${apiBase}/api/v1/tron/status`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return readJson<TronStatus>(res);
    }
  });

  const singleMutation = useMutation({
    mutationFn: async () => {
      const addresses = parseTronAddressLines(addressesText);
      const address = addresses[0];
      if (!address) {
        throw new Error('至少填写一个地址');
      }
      const res = await fetch(
        `${apiBase}/api/v1/tron/explorer/account?address=${encodeURIComponent(address)}`
      );
      const body = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(body, res.status));
      }
      const account = JSON.parse(body) as TronAccountBalances;
      return { accounts: [account], raw: JSON.stringify(account, null, 2) };
    },
    onSuccess: (data) => {
      setAccounts(data.accounts);
      setRaw(data.raw);
    },
    onError: () => {
      setAccounts(null);
      setRaw(null);
    }
  });

  const batchMutation = useMutation({
    mutationFn: async () => {
      const addresses = parseTronAddressLines(addressesText);
      if (addresses.length === 0) {
        throw new Error('至少填写一个地址');
      }
      const res = await fetch(`${apiBase}/api/v1/tron/explorer/accounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses })
      });
      const body = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(body, res.status));
      }
      const data = JSON.parse(body) as TronAccountsResponse;
      return { accounts: data.accounts, raw: JSON.stringify(data, null, 2) };
    },
    onSuccess: (data) => {
      setAccounts(data.accounts);
      setRaw(data.raw);
    },
    onError: () => {
      setAccounts(null);
      setRaw(null);
    }
  });

  const busy = singleMutation.isPending || batchMutation.isPending;
  const actionError = batchMutation.isError
    ? (batchMutation.error as Error)
    : singleMutation.isError
      ? (singleMutation.error as Error)
      : null;

  return (
    <PanelSection
      title="Tron · 账户余额（TronGrid）"
      description="GET /api/v1/tron/explorer/account · POST /api/v1/tron/explorer/accounts（服务端按地址串行，公共额度易限流）">
      {statusQuery.data ? (
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          TronGrid API Key：
          {statusQuery.data.apiKeyConfigured ? '已配置' : '未配置'}
          {' · '}
          批量串行间隔 {statusQuery.data.minIntervalMs}ms
          {statusQuery.data.apiKeyConfigured
            ? ''
            : '（未配置时批量易触发 429，可调大服务端 SERVER_TRON_MIN_INTERVAL_MS）'}
        </p>
      ) : null}
      {statusQuery.isError ? (
        <ErrorNotice
          className="mt-2"
          message={`无法获取 Tron 状态：${(statusQuery.error as Error).message}`}
        />
      ) : null}

      <FieldLabel className="mt-4">
        Tron 地址（每行一个或逗号分隔，T 开头 base58；每批最多{' '}
        {TRONEXPLORER_MAX_ADDRESSES_PER_BATCH} 个）
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
          onClick={() => singleMutation.mutate()}>
          {singleMutation.isPending ? '请求中…' : '单地址查询（取第一行）'}
        </UiButton>
        <UiButton
          variant="outline"
          size="sm"
          disabled={!apiBase || busy}
          onClick={() => batchMutation.mutate()}>
          {batchMutation.isPending ? '请求中（串行，可能较慢）…' : '批量查询'}
        </UiButton>
      </div>

      {actionError ? (
        <ErrorNotice className="mt-3" message={actionError.message} />
      ) : null}

      {accounts ? (
        <div className="mt-4 space-y-6">
          {accounts.map((account, index) => (
            <div key={`${account.address}-${index}`}>
              <p
                className="font-mono text-xs text-neutral-600 dark:text-neutral-400"
                title={account.address}>
                {account.address}
              </p>
              {account.error ? (
                <PartialErrorNotice className="mt-1" message={account.error} />
              ) : (
                <>
                  <p className="mt-1 text-sm">
                    TRX 余额：
                    <span className="font-mono">
                      {formatUnits(BigInt(account.balanceSun), 6)}
                    </span>
                  </p>
                  {account.trc20.length === 0 ? (
                    <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
                      无 TRC-20 记录
                    </p>
                  ) : (
                    <>
                      <TableShell className="mt-2">
                        <thead>
                          <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-2)]">
                            <th className="px-3 py-2 font-medium">
                              TRC-20 合约
                            </th>
                            <th className="px-3 py-2 font-medium">原始数量</th>
                          </tr>
                        </thead>
                        <tbody>
                          {account.trc20
                            .slice(0, TRC20_PREVIEW_LIMIT)
                            .map((t) => (
                              <tr
                                key={t.contractAddress}
                                className="border-b border-[var(--ui-border)] last:border-0">
                                <td
                                  className="px-3 py-2 font-mono text-xs"
                                  title={t.contractAddress}>
                                  {shortAddress(t.contractAddress)}
                                </td>
                                <td className="px-3 py-2 font-mono text-xs">
                                  {t.balanceRaw}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </TableShell>
                      {account.trc20.length > TRC20_PREVIEW_LIMIT ? (
                        <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                          仅显示前 {TRC20_PREVIEW_LIMIT} 条，共{' '}
                          {account.trc20.length} 条（完整数据见原始 JSON）。
                        </p>
                      ) : null}
                    </>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      ) : null}

      <FieldHint className="mt-2">
        TRX 以 sun÷10⁶ 换算展示；TRC-20 为原始数量（未除
        decimals），代币元数据（符号 / 精度）待后续接入。
      </FieldHint>

      <RawResult raw={raw} />
    </PanelSection>
  );
}
