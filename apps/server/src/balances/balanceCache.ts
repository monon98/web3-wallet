import { createHash } from 'node:crypto';

import { MemoryTtlCache } from './memoryTtlCache.js';

/**
 * 统一余额查询的短缓存与 stale-if-error 回退。
 *
 * Web 侧一次查询会同时命中 EVM / Tron / BTC；缓存以「链 + 地址集合 + 选项」为键，
 * 默认新鲜 15s、过期保留 5min。上游失败时返回旧值并标记 `stale`，避免页面直接空白。
 */

export type BalanceCacheOptions = {
  ttlMs: number;
  staleTtlMs: number;
};

export type CachedBalanceResult<T> = {
  value: T;
  meta: {
    cached: boolean;
    cacheAgeMs?: number;
    stale?: boolean;
  };
};

const balanceCache = new MemoryTtlCache<unknown>({ maxEntries: 2_000 });

function parseNonNegativeInt(
  raw: string | undefined,
  fallback: number
): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

export function getBalanceCacheOptions(): BalanceCacheOptions {
  const ttlMs = parseNonNegativeInt(
    process.env.SERVER_BALANCE_CACHE_TTL_MS,
    15_000
  );
  const staleTtlMs = Math.max(
    ttlMs,
    parseNonNegativeInt(process.env.SERVER_BALANCE_STALE_TTL_MS, 300_000)
  );
  return { ttlMs, staleTtlMs };
}

function buildCacheKey(parts: unknown): string {
  return createHash('sha256').update(JSON.stringify(parts)).digest('hex');
}

/**
 * 读取新鲜缓存；未命中或已过期时执行 loader。
 * loader 失败且存在过期缓存时返回 stale 数据，否则向上抛出。
 */
export async function withBalanceCache<T>(
  keyParts: unknown,
  loader: () => Promise<T>,
  options: BalanceCacheOptions = getBalanceCacheOptions()
): Promise<CachedBalanceResult<T>> {
  const key = buildCacheKey(keyParts);
  const hit = balanceCache.get(key);

  if (hit && !hit.stale) {
    return {
      value: hit.value as T,
      meta: { cached: true, cacheAgeMs: hit.ageMs }
    };
  }

  try {
    const value = await loader();
    balanceCache.set(key, value, options);
    return { value, meta: { cached: false } };
  } catch (error) {
    if (hit) {
      return {
        value: hit.value as T,
        meta: { cached: true, cacheAgeMs: hit.ageMs, stale: true }
      };
    }
    throw error;
  }
}
