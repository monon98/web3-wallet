import { ErrorNotice, RawResult } from '@/components/common/resultBlocks';
import { upstreamErrorMessage } from '@/lib/balancesApi';
import { getBalanceFamilyMeta } from '@/lib/balancesFamilies';
import { formatDuration } from '@/lib/balancesFormat';
import type { BalanceFamily, BalanceQueryResponse } from '@plugin/shared';
import { PanelSection, UiBadge } from '@plugin/ui';

import { BtcBalancesTable } from './btcBalancesTable';
import { EvmBalancesTable } from './evmBalancesTable';
import { TronBalancesTable } from './tronBalancesTable';

type Props = {
  family: BalanceFamily;
  result: BalanceQueryResponse | null;
  busy: boolean;
};

/** 单链查询结果：只展示当前链的表格 / 错误，不再使用跨链 Tab。 */
export function BalancesFamilyResults({ family, result, busy }: Props) {
  const meta = getBalanceFamilyMeta(family);

  if (!result) {
    return (
      <PanelSection title="查询结果">
        <p className="text-sm text-[color:var(--ui-muted-fg)]">
          {busy
            ? '正在查询…'
            : `填写 ${meta.label} 地址后点击「查询余额」，结果会展示在这里。`}
        </p>
      </PanelSection>
    );
  }

  const familyError = result.errors.find((error) => error.family === family);

  return (
    <PanelSection
      title={`${meta.label} 查询结果`}
      description={`请求 ${result.requestId} · 耗时 ${formatDuration(
        result.durationMs
      )}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <UiBadge variant={result.partial ? 'warning' : 'success'}>
          {result.partial ? '部分成功' : '成功'}
        </UiBadge>
        <UiBadge variant="neutral">
          {result.auth === 'session' ? '登录会话' : '匿名限额'}
        </UiBadge>
      </div>

      {familyError ? (
        <ErrorNotice
          message={upstreamErrorMessage(
            familyError.code,
            familyError.retryAfterMs
          )}
        />
      ) : family === 'evm' && result.evm ? (
        <EvmBalancesTable key={result.requestId} result={result.evm} />
      ) : family === 'tron' && result.tron ? (
        <TronBalancesTable key={result.requestId} result={result.tron} />
      ) : family === 'btc' && result.btc ? (
        <BtcBalancesTable key={result.requestId} result={result.btc} />
      ) : (
        <p className="text-sm text-[color:var(--ui-muted-fg)]">
          此链没有返回结果（可能被限流或上游不可达）；请查看原始 JSON。
        </p>
      )}

      <RawResult raw={JSON.stringify(result, null, 2)} />
    </PanelSection>
  );
}
