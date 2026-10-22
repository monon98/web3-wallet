/**
 * 统一余额查询的进程内固定窗口限流（MVP）。
 *
 * 匿名按 IP，登录后按「会话地址 + IP」计数；多实例部署时需替换为 Redis 等共享限流。
 */

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** 当前窗口重置时间（epoch ms） */
  resetAt: number;
  retryAfterMs: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const MAX_BUCKETS = 10_000;
const buckets = new Map<string, Bucket>();

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function getBalanceRateLimits(): {
  anonymousPerMinute: number;
  sessionPerMinute: number;
} {
  return {
    anonymousPerMinute: parsePositiveInt(
      process.env.SERVER_BALANCE_RATE_LIMIT_PER_MINUTE,
      30
    ),
    sessionPerMinute: parsePositiveInt(
      process.env.SERVER_BALANCE_AUTH_RATE_LIMIT_PER_MINUTE,
      120
    )
  };
}

export function consumeRateLimit(
  key: string,
  limit: number,
  now = Date.now()
): RateLimitResult {
  if (buckets.size >= MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
  }

  const existing = buckets.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : { count: 0, resetAt: now + WINDOW_MS };

  bucket.count += 1;
  buckets.set(key, bucket);

  const remaining = Math.max(0, limit - bucket.count);
  return {
    allowed: bucket.count <= limit,
    limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterMs: Math.max(0, bucket.resetAt - now)
  };
}
