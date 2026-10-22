/**
 * 进程内 TTL 缓存（MVP）。
 *
 * 同时保留「新鲜期」与「过期保留期」：新鲜期内直接命中；上游失败时可在保留期内
 * 回退旧值并标记 stale。生产多实例部署需替换为 Redis 等共享缓存。
 */

export type MemoryCacheHit<T> = {
  value: T;
  /** 写入时间（epoch ms） */
  storedAt: number;
  /** 距写入时间的毫秒数 */
  ageMs: number;
  /** 是否已超过新鲜期（仍可能在过期保留期内） */
  stale: boolean;
};

type MemoryCacheEntry<T> = {
  value: T;
  storedAt: number;
  freshUntil: number;
  staleUntil: number;
};

export type MemoryTtlCacheOptions = {
  maxEntries: number;
};

export class MemoryTtlCache<T> {
  private readonly entries = new Map<string, MemoryCacheEntry<T>>();

  constructor(private readonly options: MemoryTtlCacheOptions) {}

  get(key: string, now = Date.now()): MemoryCacheHit<T> | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    if (entry.staleUntil <= now) {
      this.entries.delete(key);
      return null;
    }
    return {
      value: entry.value,
      storedAt: entry.storedAt,
      ageMs: Math.max(0, now - entry.storedAt),
      stale: now >= entry.freshUntil
    };
  }

  set(
    key: string,
    value: T,
    params: { ttlMs: number; staleTtlMs: number },
    now = Date.now()
  ): void {
    if (this.entries.has(key)) {
      this.entries.delete(key);
    } else if (this.entries.size >= this.options.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (typeof oldest === 'string') {
        this.entries.delete(oldest);
      }
    }

    this.entries.set(key, {
      value,
      storedAt: now,
      freshUntil: now + Math.max(0, params.ttlMs),
      staleUntil: now + Math.max(0, params.staleTtlMs)
    });
  }

  delete(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
