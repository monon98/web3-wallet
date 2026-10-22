import type { FastifyReply } from 'fastify';

/**
 * 进程内固定窗口限流（MVP）。
 *
 * 调用方：`routes/balances.ts`（按 IP / 会话）与 `routes/auth.ts`（按 IP）。
 * 多实例部署时需替换为 Redis 等共享实现；本模块只保存计数与窗口，不保存请求内容。
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

export function parsePositiveInt(
  raw: string | undefined,
  fallback: number
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function consumeRateLimit(
  key: string,
  limit: number,
  now = Date.now()
): RateLimitResult {
  if (!buckets.has(key) && buckets.size >= MAX_BUCKETS) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) {
        buckets.delete(bucketKey);
      }
    }
    // 仍满时淘汰最早插入的桶，避免高基数 IP 让 Map 无界增长。
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (typeof oldest === 'string') {
        buckets.delete(oldest);
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

/** 统一写入 `x-ratelimit-*` 响应头。 */
export function setRateLimitHeaders(
  reply: FastifyReply,
  result: RateLimitResult
): void {
  reply.header('x-ratelimit-limit', String(result.limit));
  reply.header('x-ratelimit-remaining', String(result.remaining));
  reply.header('x-ratelimit-reset', String(Math.ceil(result.resetAt / 1000)));
}
