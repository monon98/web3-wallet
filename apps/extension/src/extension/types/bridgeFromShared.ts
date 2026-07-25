/**
 * 自 `@plugin/shared` **再导出**桥接信封类型；运行时解析以 shared 包 Zod/函数为准（如 `parseBridgeRequest`）。
 * 信封与响应中**不得**出现明文私钥、助记词或用户口令。
 */
export type { BridgeErrorPayload, BridgeMethod, BridgeRequest, BridgeResponse } from '@plugin/shared';
