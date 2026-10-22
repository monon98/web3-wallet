import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * CSRF token 派生与校验（P4-5）。
 *
 * 调用链：`routes/auth.ts` 在 verify / me 返回 token；`sessionAuth.ts` 在写操作校验请求头。
 * 设计：CSRF token = HMAC(SESSION_SECRET, sessionToken)，不落库；服务端只保存会话 token 摘要。
 * 安全边界：token 只与当前会话绑定，不包含私钥 / 助记词；比较使用常量时间。
 */

const DEV_FALLBACK_SECRET = randomBytes(32).toString('hex');

function resolveSecret(): string {
  const raw = process.env.SESSION_SECRET?.trim();
  if (raw) {
    return raw;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置 SESSION_SECRET（用于 CSRF token 派生）');
  }
  return DEV_FALLBACK_SECRET;
}

/** 启动时校验生产环境密钥；开发环境允许进程级随机 fallback。 */
export function assertCsrfSecretConfigured(): void {
  resolveSecret();
}

/** 为指定会话 token 派生稳定的 CSRF token（hex）。 */
export function createCsrfToken(sessionToken: string): string {
  return createHmac('sha256', resolveSecret())
    .update(`csrf:${sessionToken}`)
    .digest('hex');
}

/** 常量时间比较候选 CSRF token；格式不符直接拒绝。 */
export function isValidCsrfToken(
  sessionToken: string,
  candidate: string
): boolean {
  if (!/^[0-9a-f]{64}$/i.test(candidate)) {
    return false;
  }
  const expected = Buffer.from(createCsrfToken(sessionToken), 'hex');
  const actual = Buffer.from(candidate.toLowerCase(), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
