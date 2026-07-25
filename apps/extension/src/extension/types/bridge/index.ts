/**
 * 扩展 **DApp 桥** 专用类型（挂起态、handler 返回）。
 * 业务代码优先 `import type { … } from '~/types'`（根 index 已聚合）；桥接细粒度可 `~/types/bridge`。
 */

export type * from './handlerResult';
export type * from './pendingStates';
