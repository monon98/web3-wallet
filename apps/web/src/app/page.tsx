import { HomeDemoNav } from '@/components/homeDemoNav';
import { PanelSection } from '@plugin/ui';
import { mainnet } from 'viem/chains';

const rawChain = process.env.NEXT_PUBLIC_CHAIN_ID;
const chainId =
  rawChain !== undefined &&
  rawChain !== '' &&
  !Number.isNaN(Number.parseInt(rawChain, 10))
    ? Number.parseInt(rawChain, 10)
    : mainnet.id;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10 leading-relaxed sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-50 sm:text-3xl">
          Web 端已初始化
        </h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          演示与联调入口；表单与面板组件与扩展侧共用 @plugin/ui。
        </p>
      </header>

      <PanelSection
        title="技术栈与约定"
        tone="muted"
        description="Next.js App Router、viem、TanStack Query、UnoCSS；共享 UI 来自 @plugin/ui（与浏览器扩展一致）。链上只读与多链数据请优先走服务端 API。">
        <p className="mb-3 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          已接入 workspace 包{' '}
          <code className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-xs text-neutral-800 dark:bg-neutral-800/90 dark:text-neutral-200">
            @plugin/shared
          </code>
          、
          <code className="rounded bg-white/90 px-1.5 py-0.5 font-mono text-xs text-neutral-800 dark:bg-neutral-800/90 dark:text-neutral-200">
            @plugin/ui
          </code>
          。
        </p>
        <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
          <strong>NEXT_PUBLIC_CHAIN_ID</strong> 解析为：{chainId}
        </p>
      </PanelSection>

      <PanelSection
        title="联调入口"
        description="以下为演示页，需本地启动扩展或服务端时按各页说明操作。">
        <HomeDemoNav />
      </PanelSection>
    </main>
  );
}
