import { ErrorNotice } from '@/components/common/resultBlocks';
import { formatDuration } from '@/lib/balancesFormat';
import type { BalanceFamily, BalanceStatusResponse } from '@plugin/shared';
import { PanelSection, UiBadge, UiSpinner } from '@plugin/ui';
import { useQuery } from '@tanstack/react-query';

type Props = {
  /** Fastify 基址（末尾无 `/`）；空串表示未配置 */
  apiBase: string;
  /** 当前查询链；只展示与该链相关的上游配置 */
  family: BalanceFamily;
};

/** 当前链的配置 / 限额 / 缓存状态；不展示任何密钥。 */
export function BalancesStatusSection({ apiBase, family }: Props) {
  const statusQuery = useQuery({
    queryKey: ['balances-status', apiBase],
    enabled: Boolean(apiBase),
    staleTime: 30_000,
    queryFn: async (): Promise<BalanceStatusResponse> => {
      const res = await fetch(`${apiBase}/api/v1/balances/status`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as BalanceStatusResponse;
    }
  });

  const status = statusQuery.data;
  const cooldownSec = status
    ? Math.ceil(status.upstream.etherscanCooldownRemainingMs / 1000)
    : 0;

  return (
    <PanelSection
      title="服务状态"
      description={
        family === 'evm'
          ? 'EVM 上游配置、限额与缓存；Etherscan 冷却时 ERC-20 持仓可能回退旧缓存。'
          : family === 'tron'
            ? 'TronGrid 配置、限额与缓存；未配置 API Key 时仍可查询，但更易触发限流。'
            : 'Esplora 配置、限额与缓存；默认使用 Blockstream 公共实例。'
      }>
      {!apiBase ? (
        <ErrorNotice message="未配置 NEXT_PUBLIC_API_URL，查询与状态探测不可用。" />
      ) : statusQuery.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-[color:var(--ui-text-muted)]">
          <UiSpinner /> 正在探测服务端…
        </p>
      ) : statusQuery.isError ? (
        <ErrorNotice
          message={`服务状态不可用：${
            statusQuery.error instanceof Error
              ? statusQuery.error.message
              : '未知错误'
          }`}
        />
      ) : status ? (
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-2">
            {family === 'evm' ? (
              <>
                <UiBadge
                  variant={
                    status.upstream.rpcConfigured ? 'success' : 'warning'
                  }>
                  服务端 RPC{' '}
                  {status.upstream.rpcConfigured ? '已配置' : '未配置'}
                </UiBadge>
                <UiBadge
                  variant={
                    status.upstream.etherscanConfigured ? 'success' : 'warning'
                  }>
                  Etherscan{' '}
                  {status.upstream.etherscanConfigured ? '已配置' : '未配置'}
                </UiBadge>
                {cooldownSec > 0 ? (
                  <UiBadge variant="warning">
                    Etherscan 冷却中（约 {cooldownSec}s）
                  </UiBadge>
                ) : null}
              </>
            ) : family === 'tron' ? (
              <UiBadge
                variant={
                  status.upstream.tronApiKeyConfigured ? 'success' : 'neutral'
                }>
                TronGrid Key{' '}
                {status.upstream.tronApiKeyConfigured ? '已配置' : '未配置'}
              </UiBadge>
            ) : (
              <UiBadge
                variant={
                  status.upstream.btcApiUrlConfigured ? 'success' : 'neutral'
                }>
                BTC 自定义端点{' '}
                {status.upstream.btcApiUrlConfigured ? '已配置' : '默认'}
              </UiBadge>
            )}
          </div>
          <p className="text-[color:var(--ui-text-muted)]">
            每链最多 {status.maxAddressesPerChain} 个地址 · 缓存{' '}
            {formatDuration(status.cache.ttlMs)} / 过期保留{' '}
            {formatDuration(status.cache.staleTtlMs)} · 匿名{' '}
            {status.rateLimit.anonymousPerMinute} 次/分钟 · 登录{' '}
            {status.rateLimit.sessionPerMinute} 次/分钟
          </p>
          {family === 'evm' ? (
            <p className="text-xs text-[color:var(--ui-text-muted)]">
              ERC-20 缓存 {formatDuration(status.cache.etherscanTokenTtlMs)} /
              过期保留 {formatDuration(status.cache.etherscanTokenStaleTtlMs)}
            </p>
          ) : null}
        </div>
      ) : null}
    </PanelSection>
  );
}
