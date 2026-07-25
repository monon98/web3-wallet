import type { Metadata } from 'next';

import '@unocss/reset/tailwind.css';

import { Providers } from './providers';

import './globals.css';

export const metadata: Metadata = {
  title: 'Plugin Web',
  description: '四端系统 Web 端（Next.js + viem + TanStack Query）'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      {/* 部分浏览器扩展会在挂载前改写 <html>/<body>（如 data-atm-ext-installed），与 SSR 不一致会触发 hydration 警告 */}
      <body
        className="flex min-h-screen flex-col antialiased"
        suppressHydrationWarning>
        <div className="flex min-h-screen flex-1 flex-col bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
