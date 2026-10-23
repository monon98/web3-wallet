/**
 * 扩展内**账户解锁态**的公开形状（P2-2）。
 *
 * 只描述公开地址与过期时间；解密后的账户对象只存在于 background 内存，
 * 不进入 `chrome.storage`、content script 或网页上下文。
 */

/** 单个地址的解锁状态；`expiresAt=null` 表示当前锁定。 */
export type UnlockStatus = {
  unlocked: boolean;
  expiresAt: number | null;
  /** 当前生效的空闲 TTL（分钟） */
  ttlMinutes: number;
};

/** 后台内存中已解锁账户的摘要（侧栏展示 / 手动锁定）。 */
export type UnlockedAccountSummary = {
  address: `0x${string}`;
  expiresAt: number;
};

export type UnlockSummary = {
  accounts: UnlockedAccountSummary[];
  ttlMinutes: number;
};

/** 签名审批的统一返回；`unlock_required` 用于提示弹窗展开口令输入。 */
export type SignApprovalResult = { ok: true } | { ok: false; error: string; code?: 'unlock_required' };
