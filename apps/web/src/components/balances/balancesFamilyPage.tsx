'use client';

import { BalancesFamilyResults } from '@/components/balances/balancesFamilyResults';
import { BalancesQueryForm } from '@/components/balances/balancesQueryForm';
import { BalancesStatusSection } from '@/components/balances/balancesStatusSection';
import { useBalancesQuery } from '@/hooks/useBalancesQuery';
import {
  buildBalanceQueryRequest,
  DEFAULT_BTC_ADDRESSES,
  DEFAULT_EVM_ADDRESSES,
  DEFAULT_TRON_ADDRESSES,
  type BalancesFormState
} from '@/lib/balancesApi';
import {
  BALANCE_FAMILY_ORDER,
  getBalanceFamilyMeta
} from '@/lib/balancesFamilies';
import { getPublicApiBaseUrl } from '@/lib/publicApi';
import type { BalanceFamily } from '@plugin/shared';
import { PanelSection } from '@plugin/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const EMPTY_FORM: BalancesFormState = {
  evmChainId: '1',
  evmAddresses: '',
  tronAddresses: '',
  btcAddresses: '',
  includeEvmTokens: true,
  includeTronTokens: true
};

function initialFormFor(family: BalanceFamily): BalancesFormState {
  if (family === 'evm') {
    return { ...EMPTY_FORM, evmAddresses: DEFAULT_EVM_ADDRESSES };
  }
  if (family === 'tron') {
    return { ...EMPTY_FORM, tronAddresses: DEFAULT_TRON_ADDRESSES };
  }
  return { ...EMPTY_FORM, btcAddresses: DEFAULT_BTC_ADDRESSES };
}

/**
 * 单链余额查询页（EVM / Tron / BTC 各自独立路由）。
 *
 * 每页只提交当前链的一个 group，统一 API 仍然可用；这样避免三组表单和结果挤在同一页，
 * 也避免慢链拖住其他链的结果展示。地址在浏览器做基础校验与去重，服务端做最终校验。
 */
export function BalancesFamilyPage({ family }: { family: BalanceFamily }) {
  const meta = getBalanceFamilyMeta(family);
  const apiBase = useMemo(() => getPublicApiBaseUrl(), []);
  const [form, setForm] = useState<BalancesFormState>(() =>
    initialFormFor(family)
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const { result, busy, error, notice, query, cancel } =
    useBalancesQuery(apiBase);

  function updateForm(patch: Partial<BalancesFormState>) {
    setForm((previous) => ({ ...previous, ...patch }));
    setValidationError(null);
  }

  function submit() {
    setValidationError(null);
    try {
      const built = buildBalanceQueryRequest(form);
      if (built.families.length !== 1 || built.families[0] !== family) {
        throw new Error('当前页面只允许查询一条链，请刷新后重试。');
      }
      void query(built.request);
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : '查询参数无效。');
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-5 px-4 py-8 leading-relaxed text-neutral-900 dark:text-neutral-100 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/"
          className="text-sm text-blue-700 underline decoration-blue-700/50 hover:opacity-80 dark:text-blue-400 dark:decoration-blue-400/50">
          ← 返回首页
        </Link>
        <Link
          href="/account"
          className="text-sm text-blue-700 underline decoration-blue-700/50 hover:opacity-80 dark:text-blue-400 dark:decoration-blue-400/50">
          登录与交易广播 →
        </Link>
      </div>

      <nav aria-label="余额查询链" className="flex flex-wrap gap-2">
        {BALANCE_FAMILY_ORDER.map((item) => {
          const itemMeta = getBalanceFamilyMeta(item);
          const active = item === family;
          return (
            <Link
              key={item}
              href={itemMeta.href}
              aria-current={active ? 'page' : undefined}
              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? 'border-[var(--ui-primary)] bg-[var(--ui-primary)] text-white'
                  : 'border-[var(--ui-border)] text-[color:var(--ui-fg)] hover:bg-[var(--ui-surface-2)]'
              }`}>
              {itemMeta.label} 余额
            </Link>
          );
        })}
      </nav>

      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          {meta.title}
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {meta.description}
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          本页只查询 {meta.label} 一条链；查询走本机 Fastify（默认{' '}
          <span className="font-mono text-xs">http://localhost:8787</span>
          ），生产环境请设置{' '}
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

      <BalancesQueryForm
        family={family}
        form={form}
        onChange={updateForm}
        onSubmit={submit}
        onCancel={cancel}
        busy={busy}
        error={validationError ?? error}
        notice={notice}
        apiBaseConfigured={Boolean(apiBase)}
      />

      <BalancesFamilyResults family={family} result={result} busy={busy} />

      {apiBase ? (
        <BalancesStatusSection apiBase={apiBase} family={family} />
      ) : null}
    </main>
  );
}
