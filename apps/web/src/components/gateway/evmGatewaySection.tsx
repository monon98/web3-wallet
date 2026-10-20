import {
  apiErrorMessage,
  CHAIN_OPTIONS,
  DEFAULT_ADDRESSES,
  parseAddressLines,
  shortAddress,
  tokenAmountDisplay,
  type NativeBalancesResponse,
  type TokenBalancesResponse
} from '@/lib/gatewayHelpers';
import { EVEXPLORER_MAX_ADDRESSES_PER_BATCH } from '@plugin/shared';
import {
  CollapsibleSection,
  FieldHint,
  FieldLabel,
  PanelSection,
  SelectField,
  TableShell,
  TextArea,
  TextInput,
  UiButton
} from '@plugin/ui';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { formatEther } from 'viem';

import { ErrorNotice, PartialErrorNotice, RawResult } from './resultBlocks';

type Props = {
  /** Fastify 基址（末尾无 `/`）；空串表示未配置 */
  apiBase: string;
};

/** EVM 网关：批量原生余额与多地址 ERC-20 持仓（数据源 Etherscan V2）。 */
export function EvmGatewaySection({ apiBase }: Props) {
  const [chainIdStr, setChainIdStr] = useState(String(CHAIN_OPTIONS[0].id));
  const [addressesText, setAddressesText] = useState(DEFAULT_ADDRESSES);
  const [pageStr, setPageStr] = useState('1');
  const [offsetStr, setOffsetStr] = useState('20');
  const [nativeParsed, setNativeParsed] =
    useState<NativeBalancesResponse | null>(null);
  const [nativeRaw, setNativeRaw] = useState<string | null>(null);
  const [tokenParsed, setTokenParsed] = useState<TokenBalancesResponse | null>(
    null
  );
  const [tokenRaw, setTokenRaw] = useState<string | null>(null);

  const nativeMutation = useMutation({
    mutationFn: async () => {
      const chainId = Number.parseInt(chainIdStr, 10);
      if (!Number.isFinite(chainId) || chainId <= 0) {
        throw new Error('请选择有效链');
      }
      const addresses = parseAddressLines(addressesText);
      if (addresses.length === 0) {
        throw new Error('至少填写一个地址');
      }
      const res = await fetch(
        `${apiBase}/api/v1/evm/explorer/native-balances`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chainId, addresses })
        }
      );
      const body = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(body, res.status));
      }
      return JSON.parse(body) as NativeBalancesResponse;
    },
    onSuccess: (data) => {
      setNativeParsed(data);
      setNativeRaw(JSON.stringify(data, null, 2));
    },
    onError: () => {
      setNativeParsed(null);
      setNativeRaw(null);
    }
  });

  const tokenMutation = useMutation({
    mutationFn: async () => {
      const chainId = Number.parseInt(chainIdStr, 10);
      if (!Number.isFinite(chainId) || chainId <= 0) {
        throw new Error('请选择有效链');
      }
      const addresses = parseAddressLines(addressesText);
      if (addresses.length === 0) {
        throw new Error('至少填写一个地址');
      }
      const page = Number.parseInt(pageStr, 10);
      const offset = Number.parseInt(offsetStr, 10);
      if (!Number.isFinite(page) || page < 1) {
        throw new Error('page 须 ≥ 1');
      }
      if (!Number.isFinite(offset) || offset < 1) {
        throw new Error('offset 须 ≥ 1');
      }
      const res = await fetch(
        `${apiBase}/api/v1/evm/explorer/address-token-balances`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chainId, addresses, page, offset })
        }
      );
      const body = await res.text();
      if (!res.ok) {
        throw new Error(apiErrorMessage(body, res.status));
      }
      return JSON.parse(body) as TokenBalancesResponse;
    },
    onSuccess: (data) => {
      setTokenParsed(data);
      setTokenRaw(JSON.stringify(data, null, 2));
    },
    onError: () => {
      setTokenParsed(null);
      setTokenRaw(null);
    }
  });

  return (
    <>
      <PanelSection
        title="EVM · 查询条件"
        description={`下方两个 EVM 接口共用；每批最多 ${EVEXPLORER_MAX_ADDRESSES_PER_BATCH} 个地址。`}>
        <FieldLabel>
          链
          <SelectField
            className="mt-1.5 max-w-full sm:max-w-md"
            value={chainIdStr}
            onChange={(e) => setChainIdStr(e.target.value)}>
            {CHAIN_OPTIONS.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.label}
              </option>
            ))}
          </SelectField>
        </FieldLabel>
        <FieldLabel className="mt-4">
          地址（每行一个或逗号分隔）
          <TextArea
            className="mt-1.5"
            rows={4}
            value={addressesText}
            onChange={(e) => setAddressesText(e.target.value)}
          />
        </FieldLabel>
      </PanelSection>

      <PanelSection
        title="EVM · 批量原生余额"
        description="POST /api/v1/evm/explorer/native-balances">
        <UiButton
          variant="primary"
          size="sm"
          disabled={!apiBase || nativeMutation.isPending}
          onClick={() => nativeMutation.mutate()}>
          {nativeMutation.isPending ? '请求中…' : '查询原生余额'}
        </UiButton>

        {nativeMutation.isError ? (
          <ErrorNotice
            className="mt-3"
            message={(nativeMutation.error as Error).message}
          />
        ) : null}

        {nativeParsed ? (
          <TableShell className="mt-4">
            <thead>
              <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-2)]">
                <th className="px-3 py-2 font-medium">地址</th>
                <th className="px-3 py-2 font-medium">余额（ETH 单位）</th>
              </tr>
            </thead>
            <tbody>
              {nativeParsed.balances.map((row) => (
                <tr
                  key={row.address}
                  className="border-b border-[var(--ui-border)] last:border-0">
                  <td
                    className="px-3 py-2 font-mono text-xs"
                    title={row.address}>
                    {shortAddress(row.address)}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {formatEther(BigInt(row.balanceWei))}
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : null}

        <RawResult raw={nativeRaw} preClassName="max-h-64" />
      </PanelSection>

      <PanelSection
        title="EVM · 多地址 ERC-20 持仓"
        description="POST /api/v1/evm/explorer/address-token-balances（PRO；服务端串行，可能较慢）">
        <CollapsibleSection
          title="分页参数"
          summary={`page=${pageStr} · offset=${offsetStr}`}
          defaultOpen={false}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <FieldLabel className="sm:w-28">
              page
              <TextInput
                className="mt-1.5 w-full"
                value={pageStr}
                onChange={(e) => setPageStr(e.target.value)}
              />
            </FieldLabel>
            <FieldLabel className="sm:w-28">
              offset
              <TextInput
                className="mt-1.5 w-full"
                value={offsetStr}
                onChange={(e) => setOffsetStr(e.target.value)}
              />
            </FieldLabel>
          </div>
        </CollapsibleSection>

        <UiButton
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={!apiBase || tokenMutation.isPending}
          onClick={() => tokenMutation.mutate()}>
          {tokenMutation.isPending ? '请求中（可能较慢）…' : '查询 ERC-20 持仓'}
        </UiButton>

        {tokenMutation.isError ? (
          <ErrorNotice
            className="mt-3"
            message={(tokenMutation.error as Error).message}
          />
        ) : null}

        <FieldHint className="mt-2">
          表格中「数量」由接口返回的 quantity÷divisor
          换算，仅作浏览；精确记账请以原始 JSON 为准。
        </FieldHint>

        {tokenParsed ? (
          <div className="mt-4 space-y-6">
            {tokenParsed.items.map((item) => (
              <div key={item.address}>
                <p
                  className="mb-2 font-mono text-xs text-neutral-600 dark:text-neutral-400"
                  title={item.address}>
                  {item.address}
                </p>
                {item.error ? (
                  <PartialErrorNotice message={item.error} />
                ) : item.tokens.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    无代币记录
                  </p>
                ) : (
                  <TableShell>
                    <thead>
                      <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-2)]">
                        <th className="px-3 py-2 font-medium">符号</th>
                        <th className="px-3 py-2 font-medium">名称</th>
                        <th className="px-3 py-2 font-medium">数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.tokens.map((t) => (
                        <tr
                          key={`${item.address}-${t.tokenAddress}`}
                          className="border-b border-[var(--ui-border)] last:border-0">
                          <td className="px-3 py-2">{t.tokenSymbol}</td>
                          <td className="px-3 py-2 text-neutral-700 dark:text-neutral-300">
                            {t.tokenName}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">
                            {tokenAmountDisplay(
                              t.tokenQuantity,
                              t.tokenDivisor
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </TableShell>
                )}
              </div>
            ))}
          </div>
        ) : null}

        <RawResult raw={tokenRaw} />
      </PanelSection>
    </>
  );
}
