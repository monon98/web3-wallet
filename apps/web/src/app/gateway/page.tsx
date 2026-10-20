'use client';

import { BtcGatewaySection } from '@/components/gateway/btcGatewaySection';
import { EvmGatewaySection } from '@/components/gateway/evmGatewaySection';
import { GatewayStatusSection } from '@/components/gateway/gatewayStatusSection';
import { TronGatewaySection } from '@/components/gateway/tronGatewaySection';
import { getPublicApiBaseUrl } from '@/lib/publicApi';
import { PanelSection, SegmentedControl } from '@plugin/ui';
import type { SegmentedControlOption } from '@plugin/ui';
import Link from 'next/link';
import { useMemo, useState } from 'react';

type GatewayTab = 'evm' | 'tron' | 'btc';

const TAB_OPTIONS: SegmentedControlOption[] = [
  { value: 'evm', label: 'EVM' },
  { value: 'tron', label: 'Tron' },
  { value: 'btc', label: 'BTC' }
];

/**
 * 多链余额查询页：EVM / Tron / BTC 分链展示（路由保留 `/gateway`）。
 * 各链区块自持有表单与查询状态；切换 tab 用 CSS 隐藏，避免丢失已查结果。
 */
export default function GatewayPage() {
  const apiBase = useMemo(() => getPublicApiBaseUrl(), []);
  const [tab, setTab] = useState<GatewayTab>('evm');

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
          多链余额查询（EVM / Tron / BTC）
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          查询走本机 Fastify（默认{' '}
          <span className="font-mono text-xs">http://localhost:8787</span>
          ）。请先 <span className="font-mono text-xs">pnpm dev:server</span>
          ；生产环境请在环境变量中设置{' '}
          <span className="font-mono text-xs">NEXT_PUBLIC_API_URL</span>。
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          按链切换查看；Tron / BTC
          批量由服务端按地址串行请求，可能较慢，单次最多 20 个地址。
        </p>
      </header>

      {!apiBase ? (
        <PanelSection
          tone="amber"
          title="需要 API 基址"
          description="非开发构建未设置 NEXT_PUBLIC_API_URL。请在部署环境中配置后重新构建。"
        />
      ) : null}

      <GatewayStatusSection apiBase={apiBase} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
          查询链
        </span>
        <SegmentedControl
          options={TAB_OPTIONS}
          value={tab}
          onChange={(next) => setTab(next as GatewayTab)}
          size="md"
        />
      </div>

      <div className={tab === 'evm' ? '' : 'hidden'}>
        <EvmGatewaySection apiBase={apiBase} />
      </div>
      <div className={tab === 'tron' ? '' : 'hidden'}>
        <TronGatewaySection apiBase={apiBase} />
      </div>
      <div className={tab === 'btc' ? '' : 'hidden'}>
        <BtcGatewaySection apiBase={apiBase} />
      </div>
    </main>
  );
}
