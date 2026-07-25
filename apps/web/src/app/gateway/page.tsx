'use client';

import {
  CHAIN_OPTIONS,
  DEFAULT_ADDRESSES,
  parseAddressLines,
  readJson,
  shortAddress,
  tokenAmountDisplay,
  type ApiMeta,
  type EvmStatus,
  type NativeBalancesResponse,
  type TokenBalancesResponse
} from '@/lib/gatewayHelpers';
import { getPublicApiBaseUrl } from '@/lib/publicApi';
import { EVEXPLORER_MAX_ADDRESSES_PER_BATCH } from '@plugin/shared';
import {
  CollapsibleSection,
  FieldHint,
  FieldLabel,
  PanelSection,
  SelectField,
  TextArea,
  TextInput,
  UiButton,
  UiSpinner
} from '@plugin/ui';
import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { formatEther } from 'viem';

export default function GatewayPage() {
  const apiBase = useMemo(() => getPublicApiBaseUrl(), []);
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

  const statusQuery = useQuery({
    queryKey: ['evm-status', apiBase],
    enabled: Boolean(apiBase),
    queryFn: async (): Promise<EvmStatus> => {
      const res = await fetch(`${apiBase}/api/v1/evm/status`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return readJson<EvmStatus>(res);
    }
  });

  const metaQuery = useQuery({
    queryKey: ['api-meta', apiBase],
    enabled: Boolean(apiBase),
    queryFn: async (): Promise<ApiMeta> => {
      const res = await fetch(`${apiBase}/api/v1/meta`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return readJson<ApiMeta>(res);
    }
  });

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
        throw new Error(body || `HTTP ${res.status}`);
      }
      return JSON.parse(body) as NativeBalancesResponse;
    },
    onSuccess: (data) => {
      setNativeParsed(data);
      setNativeRaw(JSON.stringify(data, null, 2));
    },
    onError: (e: Error) => {
      setNativeParsed(null);
      setNativeRaw(e.message);
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
        throw new Error(body || `HTTP ${res.status}`);
      }
      return JSON.parse(body) as TokenBalancesResponse;
    },
    onSuccess: (data) => {
      setTokenParsed(data);
      setTokenRaw(JSON.stringify(data, null, 2));
    },
    onError: (e: Error) => {
      setTokenParsed(null);
      setTokenRaw(e.message);
    }
  });

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 leading-relaxed text-neutral-900 dark:text-neutral-100 sm:px-6 lg:px-8">
      <p>
        <Link
          href="/"
          className="text-sm text-blue-700 underline decoration-blue-700/50 hover:opacity-80 dark:text-blue-400 dark:decoration-blue-400/50">
          ← 返回首页
        </Link>
      </p>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          服务端 EVM 网关
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          查询走本机 Fastify（默认{' '}
          <span className="font-mono text-xs">http://localhost:8787</span>
          ）。请先 <span className="font-mono text-xs">pnpm dev:server</span>
          ；生产环境请在环境变量中设置{' '}
          <span className="font-mono text-xs">NEXT_PUBLIC_API_URL</span>。
        </p>
      </header>

      {!apiBase ? (
        <PanelSection
          tone="amber"
          title="需要 API 基址"
          description="非开发构建未设置 NEXT_PUBLIC_API_URL。请在部署环境中配置后重新构建。"
        />
      ) : null}

      <PanelSection title="连接与状态">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          请求目标：<span className="font-mono">{apiBase}</span>
        </p>
        {statusQuery.isPending && apiBase ? (
          <p className="mt-2 flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
            <UiSpinner size="sm" label="加载状态" />
            正在拉取状态…
          </p>
        ) : null}
        {statusQuery.isError ? (
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">
            无法连接服务端：{(statusQuery.error as Error).message}。确认已启动
            dev:server 且端口一致。
          </p>
        ) : null}
        {statusQuery.data ? (
          <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/50">
              <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                RPC 代理
              </dt>
              <dd className="font-medium">
                {statusQuery.data.rpc ? '已配置' : '未配置'}
              </dd>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/50">
              <dt className="text-xs text-neutral-500 dark:text-neutral-400">
                Etherscan
              </dt>
              <dd className="font-medium">
                {statusQuery.data.etherscan ? '已配置' : '未配置'}
              </dd>
            </div>
          </dl>
        ) : null}
        {metaQuery.data ? (
          <p className="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
            meta · bridgeMethods：{metaQuery.data.bridgeMethods.join(', ')}
          </p>
        ) : null}
      </PanelSection>

      <PanelSection
        title="查询条件"
        description={`下方两个接口共用；每批最多 ${EVEXPLORER_MAX_ADDRESSES_PER_BATCH} 个地址。`}>
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
        title="批量原生余额"
        description="POST /api/v1/evm/explorer/native-balances">
        <UiButton
          variant="primary"
          size="sm"
          disabled={!apiBase || nativeMutation.isPending}
          onClick={() => nativeMutation.mutate()}>
          {nativeMutation.isPending ? '请求中…' : '查询原生余额'}
        </UiButton>

        {nativeRaw && !nativeRaw.trimStart().startsWith('{') ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-400">
            {nativeRaw}
          </p>
        ) : null}

        {nativeParsed ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            <table className="w-full min-w-[280px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/80">
                  <th className="px-3 py-2 font-medium">地址</th>
                  <th className="px-3 py-2 font-medium">余额（ETH 单位）</th>
                </tr>
              </thead>
              <tbody>
                {nativeParsed.balances.map((row) => (
                  <tr
                    key={row.address}
                    className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
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
            </table>
          </div>
        ) : null}

        {nativeRaw && nativeRaw.startsWith('{') ? (
          <CollapsibleSection
            className="mt-3"
            title="原始 JSON"
            summary="调试 / 对接用"
            defaultOpen={false}>
            <pre className="max-h-64 overflow-auto p-3 font-mono text-[11px] leading-relaxed">
              {nativeRaw}
            </pre>
          </CollapsibleSection>
        ) : null}
      </PanelSection>

      <PanelSection
        title="多地址 ERC-20 持仓"
        description="POST /api/v1/evm/explorer/address-token-balances（PRO；服务端串行，可能较慢）">
        <CollapsibleSection
          title="分页参数"
          summary={`page=${pageStr} · offset=${offsetStr}`}
          defaultOpen={false}>
          <div className="flex flex-col gap-3 p-3 sm:flex-row">
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

        <FieldHint className="mt-2">
          表格中「数量」由接口返回的 quantity÷divisor
          换算，仅作浏览；精确记账请以原始 JSON 为准。
        </FieldHint>

        {tokenRaw && !tokenRaw.trimStart().startsWith('{') ? (
          <p className="mt-3 text-sm text-red-700 dark:text-red-400">
            {tokenRaw}
          </p>
        ) : null}

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
                  <p className="text-sm text-amber-800 dark:text-amber-300">
                    {item.error}
                  </p>
                ) : item.tokens.length === 0 ? (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    无代币记录
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <table className="w-full min-w-[320px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900/80">
                          <th className="px-3 py-2 font-medium">符号</th>
                          <th className="px-3 py-2 font-medium">名称</th>
                          <th className="px-3 py-2 font-medium">数量</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.tokens.map((t) => (
                          <tr
                            key={`${item.address}-${t.tokenAddress}`}
                            className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
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
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : null}

        {tokenRaw && tokenRaw.startsWith('{') ? (
          <CollapsibleSection
            className="mt-3"
            title="原始 JSON"
            summary="调试 / 对接用"
            defaultOpen={false}>
            <pre className="max-h-72 overflow-auto p-3 font-mono text-[11px] leading-relaxed">
              {tokenRaw}
            </pre>
          </CollapsibleSection>
        ) : null}
      </PanelSection>
    </main>
  );
}
