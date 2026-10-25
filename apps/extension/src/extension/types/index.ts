/**

 * 扩展内类型统一出口。引用：`import type { … } from '~/types'`。

 * 物理路径：`src/extension/types/`（聚合方式：`export type * from './…'`；勿用 `@types` 作 tsconfig paths，会与 `@types/*` 包冲突）。

 * 域划分：**`bridge/`**（DApp 桥挂起态与 handler，`~/types/bridge`）、`contentsPostMessage`、`unlock`、`vault`、`walletUi`、`walletPanel*`、`account`；末尾再导出 `@plugin/ui` 组件 props。

 */

export type * from './account';

export type * from './addressGeneration';

export type * from './bridgeFromShared';

/** 桥接挂起态与 handler，见目录 `./bridge/` */
export type * from './bridge';

export type * from './customEvmChain';

export type * from './contentsPostMessage';

export type * from './unlock';

export type * from './walletUi';

export type * from './vault';

export type * from './walletPanel';

export type * from './walletPanelUi';

export type * from '@plugin/ui';
