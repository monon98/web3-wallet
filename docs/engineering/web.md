# 子项目：Web（`apps/web`，`@plugin/web`）

- **本地类型**：`src/types/*.ts`，聚合出口 **`src/types/index.ts`**（`export type * from './…'`）；引用 **`@/types`**（与 `tsconfig` 的 `@/*` 一致）。
- **栈**：Next.js App Router、React、viem、TanStack Query、**UnoCSS**（`@unocss/postcss` + `uno.config.ts`，与 [UnoCSS · Next.js](https://unocss.dev/integrations/next) 一致：`globals.css` 中 `@unocss all`，`layout` 引入 `@unocss/reset/tailwind.css`）；与扩展共用的 UI 组件见 [**@plugin/ui**](./ui.md)（`next.config.ts` 已 `transpilePackages`）。
- **技术方案总览**：[TECHNICAL-SOLUTION.md §4.2](./TECHNICAL-SOLUTION.md)。
- **页面**：`/`（首页导航）、[`/wallet`](../../apps/web/src/app/wallet/page.tsx)（EIP-6963 / EIP-1193 联调）、[`/balances`](../../apps/web/src/app/balances/page.tsx)（**多链余额查询**：EVM / Tron / BTC；按链拆分为 `src/components/gateway/*` 子组件，页内分段切换；旧 `/gateway` 308 重定向到 `/balances`）。EVM 原生余额会标注实际数据源（`source: rpc | etherscan`）；Etherscan 不可达时 ERC-20 面板显示可读提示。
- **职责**：展示与业务流程；链上只读优先走服务端；不持有用户私钥。
- **产品对照**：[prd-web.md](../product/prd-web.md)；整体见 [PRODUCT-OVERVIEW.md](../product/PRODUCT-OVERVIEW.md) §A4、§A8。
