/**
 * 内容脚本（隔离桥 `allUrls.ts`、MAIN 注入 `inpageEvm.ts`）的 **URL match patterns** 白名单。
 * 不再使用 `<all_urls>`，仅在列出的来源注入 EIP-1193 / 桥接，缩小攻击面。
 *
 * **须与 `package.json` → `manifest.web_accessible_resources[0].matches` 保持条目一致**（Chrome 无法从 TS 引用）。
 * 增删主机或端口时同步修改该 JSON；可选同步 `manifest.host_permissions` 中与本地联调相关的 `http(s)://localhost…` 项。
 *
 * 生产 DApp 域名：按需追加 `'https://example.com/*'` 形式；子域可用 `'https://*.example.com/*'`（遵循 Chrome match pattern 规则）。
 */

/**
 * 与 manifest `web_accessible_resources.matches` 同源；供 Plasmo `PlasmoCSConfig.matches` 使用。
 *
 * 注意：Plasmo 在生成 manifest 时会静态分析 `contents/*` 的 `config`，因此这里保持**可静态求值**（避免函数生成 + spread）。
 */
export const CONTENT_SCRIPT_MATCH_PATTERNS: readonly string[] = [
  'http://localhost/*',
  'http://127.0.0.1/*',
  'https://localhost/*',
  'https://127.0.0.1/*'
];
