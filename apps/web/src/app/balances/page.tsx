import {
  BALANCE_FAMILY_ORDER,
  getBalanceFamilyMeta
} from '@/lib/balancesFamilies';
import { PanelSection } from '@plugin/ui';
import Link from 'next/link';

/** 多链余额查询入口：按链进入独立页面，避免三组表单与结果挤在同一页。 */
export default function BalancesIndexPage() {
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

      <header className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          多链余额查询
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          选择一条链进入独立查询页。每条链只展示自己的表单和结果，避免三组输入挤在同一页。
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        {BALANCE_FAMILY_ORDER.map((family) => {
          const meta = getBalanceFamilyMeta(family);
          return (
            <Link
              key={family}
              href={meta.href}
              className="group block rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ui-primary)]">
              <PanelSection title={meta.title} description={meta.description}>
                <p className="text-sm font-medium text-blue-700 group-hover:underline dark:text-blue-400">
                  进入查询 →
                </p>
              </PanelSection>
            </Link>
          );
        })}
      </div>

      <PanelSection title="查询说明">
        <ul className="list-disc space-y-1 pl-5 text-sm text-[color:var(--ui-muted-fg)]">
          <li>每个页面最多查询 20 个地址，地址会自动去重。</li>
          <li>EVM 原生余额优先走服务端 RPC；ERC-20 持仓依赖 Etherscan。</li>
          <li>
            Tron / BTC 由服务端按地址串行节流，耗时以结果中的 durationMs 为准。
          </li>
          <li>登录后可获得更高限额；未登录按 IP 限额查询。</li>
        </ul>
      </PanelSection>
    </main>
  );
}
