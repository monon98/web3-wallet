'use client';

import { UiButton } from '@plugin/ui';
import { useRouter } from 'next/navigation';

/** 首页联调入口：用按钮导航，样式来自 @plugin/ui（与扩展侧栏一致）。 */
export function HomeDemoNav() {
  const router = useRouter();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <UiButton
        variant="primary"
        size="md"
        className="w-full sm:w-auto"
        onClick={() => router.push('/gateway')}>
        服务端 EVM 网关
      </UiButton>
      <UiButton
        variant="outline"
        size="md"
        className="w-full sm:w-auto"
        onClick={() => router.push('/wallet')}>
        钱包连接（EIP-6963）
      </UiButton>
    </div>
  );
}
