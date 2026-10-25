import { PanelSection, UiAlert, UiBadge, UiButton } from '@plugin/ui';
import { useEffect } from 'react';

import '~/assets/style.css';

import { openTab } from '~lib/extension';
import { parseOnboardingContext, type OnboardingContext } from '~lib/extension/onboarding';

/**
 * **首次安装 / 升级引导页**（Plasmo `tabs/welcome.html`）。
 *
 * 由 `background` 在安装或版本变化时打开，也可从侧栏「安全与使用指南」随时进入。
 * 内容只包含备份、签名、隐私与权限说明，不读取账户、不要求输入助记词 / 私钥 / 口令。
 */

const SECURITY_RULES = [
  {
    title: '先备份，再导入',
    body: '助记词或私钥请离线抄写并妥善保管。扩展不提供云备份、代客找回；截图、网盘或聊天工具都可能泄露。'
  },
  {
    title: '每次签名都要核对',
    body: '连接、消息签名、EIP-712 与交易都会打开独立审批页。确认链、地址、金额与授权内容后再批准。'
  },
  {
    title: '口令只在本地解密',
    body: '导入时设置的口令不落盘、不上传。Service Worker 休眠、手动锁定或超时后，需要重新输入口令。'
  },
  {
    title: '自定义 RPC 是信任选择',
    body: '节点能看到公开地址、查询与广播交易。只填写你信任的 HTTPS 节点，不要把带访问 key 的 RPC URL 分享给别人。'
  }
] as const;

const PERMISSION_ROWS = [
  ['sidePanel', '在浏览器侧栏显示钱包与设置页。'],
  ['scripting', '在本地开发域名白名单中注入 EIP-1193 provider 与隔离桥内容脚本。'],
  ['storage', '保存加密账户包、当前网络、解锁设置与站点授权；不保存明文口令 / 私钥。'],
  ['tabs', '打开账户与审批页，并在标签关闭时撤销该标签的站点会话。'],
  ['webNavigation', '检测主框架刷新并撤销旧页面的站点授权。'],
  ['contextMenus', '在右键菜单中打开钱包侧边栏。'],
  ['windows', '创建独立的连接 / 签名 / 交易审批窗口。'],
  [
    '主机权限（HTTPS / 本地）',
    '访问内置公共 RPC 或你配置的 EVM RPC；DApp 内容脚本仅注入 localhost / 127.0.0.1 白名单。'
  ]
] as const;

function pageTitle(context: OnboardingContext): string {
  if (context.mode === 'install') {
    return '欢迎使用本地 Web3 钱包';
  }
  if (context.mode === 'update') {
    return `已更新到 v${context.version}`;
  }
  return '安全与使用指南';
}

function pageLead(context: OnboardingContext): string {
  if (context.mode === 'install') {
    return '安装完成。导入账户前，请先读完备份与签名须知；你的密钥只会保存在这台设备上。';
  }
  if (context.mode === 'update') {
    return context.previousVersion
      ? `已从 v${context.previousVersion} 更新到 v${context.version}。升级不会代替备份，请核对账户、网络与站点授权。`
      : '扩展已更新。升级不会代替备份，请核对账户、网络与站点授权。';
  }
  return '首次安装或版本更新时会自动打开本页；也可以随时从侧栏返回这里查看备份、签名与权限说明。';
}

function SecurityRuleCard({ index, title, body }: { index: number; title: string; body: string }) {
  return (
    <article className='rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-4 text-sm shadow-[var(--ui-shadow-sm)]'>
      <div className='flex items-start gap-2'>
        <span className='inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--ui-surface-2)] text-xs font-semibold text-[var(--ui-fg)]'>
          {index}
        </span>
        <div className='min-w-0'>
          <h2 className='text-sm font-semibold text-[var(--ui-fg)]'>{title}</h2>
          <p className='mt-1 text-xs leading-relaxed text-[var(--ui-muted-fg)]'>{body}</p>
        </div>
      </div>
    </article>
  );
}

export default function WelcomePage() {
  const context = parseOnboardingContext(window.location.search, chrome.runtime.getManifest().version);
  const title = pageTitle(context);

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div className='min-h-[100dvh] bg-[var(--ui-surface-2)] px-3 py-5 text-left text-sm text-[var(--ui-fg)] sm:px-6 sm:py-8'>
      <main className='mx-auto w-full max-w-3xl'>
        <header className='rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-4 shadow-[var(--ui-shadow-sm)] sm:p-6'>
          <div className='flex flex-wrap items-center gap-2'>
            <UiBadge variant='success'>本地自托管</UiBadge>
            <UiBadge>v{context.version}</UiBadge>
            {context.mode === 'update' ? <UiBadge variant='info'>升级提示</UiBadge> : null}
          </div>
          <h1 className='mt-3 text-xl font-semibold tracking-tight text-[var(--ui-fg)] sm:text-2xl'>{title}</h1>
          <p className='mt-2 max-w-2xl text-sm leading-relaxed text-[var(--ui-muted-fg)]'>{pageLead(context)}</p>
        </header>

        <div className='mt-3'>
          <UiAlert variant='error'>
            重要：助记词 / 私钥丢失后无法找回。扩展不托管资产，也不会替你恢复账户；请先完成离线备份。
          </UiAlert>
        </div>

        <PanelSection
          className='mt-3'
          title='四条安全底线'
          description='钱包安全主要取决于密钥保管与每次签名确认；扩展只能降低误操作，不能替代你的备份。'>
          <div className='grid gap-3 sm:grid-cols-2'>
            {SECURITY_RULES.map((rule, index) => (
              <SecurityRuleCard key={rule.title} index={index + 1} title={rule.title} body={rule.body} />
            ))}
          </div>
        </PanelSection>

        <PanelSection title='开始使用'>
          {context.mode === 'update' ? (
            <div className='mb-3 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-3'>
              <h3 className='text-sm font-semibold text-[var(--ui-fg)]'>升级后核对</h3>
              <ul className='mt-1 list-disc space-y-1 pl-5 text-xs leading-relaxed text-[var(--ui-muted-fg)]'>
                <li>确认默认 EVM 账户与当前网络没有变化；自定义 RPC 配置仍是你信任的节点。</li>
                <li>打开「DApp 全局设置 → 已连接网站」，断开不再使用的站点授权。</li>
                <li>确认助记词 / 私钥的离线备份仍可用；升级不会替你补做备份。</li>
              </ul>
            </div>
          ) : null}

          <ol className='space-y-2'>
            <li className='rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-3'>
              <span className='font-semibold text-[var(--ui-fg)]'>1. 离线备份</span>
              <p className='mt-1 text-xs leading-relaxed text-[var(--ui-muted-fg)]'>
                将助记词或私钥抄写在只有你能访问的离线介质上，并验证备份可读；不要用截图、聊天记录或不明云盘保存。
              </p>
            </li>
            <li className='rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-3'>
              <span className='font-semibold text-[var(--ui-fg)]'>2. 导入 EVM 账户</span>
              <p className='mt-1 text-xs leading-relaxed text-[var(--ui-muted-fg)]'>
                在扩展内设置加密口令后导入助记词或私钥。口令只用于本地解密，不会上传。
              </p>
            </li>
            <li className='rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-1)] p-3'>
              <span className='font-semibold text-[var(--ui-fg)]'>3. 连接 DApp</span>
              <p className='mt-1 text-xs leading-relaxed text-[var(--ui-muted-fg)]'>
                在任意网页点击浏览器工具栏中的钱包图标打开侧栏；连接请求需选择账户并确认，签名与交易仍需逐笔批准。
              </p>
            </li>
          </ol>

          <div className='mt-3 flex flex-wrap gap-2'>
            <UiButton variant='primary' size='lg' onClick={() => openTab('tabs/evmAccounts.html')}>
              打开 EVM 账户管理
            </UiButton>
            <UiButton variant='outline' size='lg' onClick={() => openTab('tabs/generateAccounts.html')}>
              多链地址生成器
            </UiButton>
          </div>
        </PanelSection>

        <PanelSection title='隐私说明' description='扩展当前不接入广告、分析或遥测服务。'>
          <div className='space-y-2 text-xs leading-relaxed text-[var(--ui-muted-fg)]'>
            <p>
              <span className='font-semibold text-[var(--ui-fg)]'>本地保存：</span>
              加密账户包、当前网络与解锁设置、已连接站点授权、最近一次引导版本。明文助记词 /
              私钥与口令不会写入持久存储。
            </p>
            <p>
              <span className='font-semibold text-[var(--ui-fg)]'>网络通信：</span>
              只在你查看余额、连接 DApp 或签名 / 广播交易时，向当前链 RPC（内置公共节点或你配置的自定义
              RPC）发送公开地址、查询参数与已签名交易。
            </p>
            <p>
              <span className='font-semibold text-[var(--ui-fg)]'>不会发生：</span>
              扩展不会把助记词、私钥或口令发送给 DApp、本项目 Web / 服务端或其他第三方，也不提供资产找回服务。
            </p>
            <p className='text-[11px]'>
              第三方 RPC 与 DApp
              仍会看到你主动发起的公开链上请求，其数据处理受各自隐私政策约束。上架版隐私说明以商店商品页为准。
            </p>
          </div>

          <details className='mt-3 rounded-md border border-[var(--ui-border)] bg-[var(--ui-surface-2)] p-3'>
            <summary className='cursor-pointer text-xs font-semibold text-[var(--ui-fg)]'>权限用途（点击展开）</summary>
            <dl className='mt-2 space-y-2 text-xs leading-relaxed'>
              {PERMISSION_ROWS.map(([permission, purpose]) => (
                <div key={permission} className='grid gap-0.5 sm:grid-cols-[11rem_1fr] sm:gap-2'>
                  <dt className='font-mono text-[11px] font-semibold text-[var(--ui-fg)]'>{permission}</dt>
                  <dd className='text-[var(--ui-muted-fg)]'>{purpose}</dd>
                </div>
              ))}
            </dl>
            <p className='mt-2 text-[11px] leading-relaxed text-[var(--ui-muted-fg)]'>
              扩展不加载远程代码；所有脚本随扩展包发布。内容脚本仅在本地开发域名白名单注入。
            </p>
          </details>
        </PanelSection>

        <footer className='pb-4 text-center text-[11px] leading-relaxed text-[var(--ui-muted-fg)]'>
          <p>在任意网页点击浏览器工具栏中的钱包图标可打开侧栏。</p>
          <p className='mt-1'>安全与使用指南 · v{context.version}</p>
        </footer>
      </main>
    </div>
  );
}
