// ── 通用缓存机制 ──────────────────────────────────────
// 为高频计算提供LRU缓存

/**
 * LRU缓存选项
 */
export interface CacheOptions {
  maxSize?: number;
  ttlMs?: number;
}

/**
 * LRU缓存
 */
export class LRUCache<K, V> {
  private cache: Map<K, { value: V; lastAccess: number; expiresAt?: number }>;
  private maxSize: number;
  private ttlMs: number;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize ?? 1000;
    this.ttlMs = options.ttlMs ?? 5 * 60 * 1000; // 5分钟
  }

  /**
   * 获取缓存值
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    // 检查过期
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // 更新访问时间
    entry.lastAccess = Date.now();
    return entry.value;
  }

  /**
   * 设置缓存值
   */
  set(key: K, value: V): void {
    // 如果已存在，更新
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;
      entry.value = value;
      entry.lastAccess = Date.now();
      entry.expiresAt = this.ttlMs > 0 ? Date.now() + this.ttlMs : undefined;
      return;
    }

    // 如果达到最大容量，删除最久未访问的
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      lastAccess: Date.now(),
      expiresAt: this.ttlMs > 0 ? Date.now() + this.ttlMs : undefined,
    });
  }

  /**
   * 检查是否存在
   */
  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * 删除缓存
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * 删除最久未访问的条目
   */
  private evictOldest(): void {
    let oldestKey: K | undefined;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey !== undefined) {
      this.cache.delete(oldestKey);
    }
  }
}

/**
 * 创建带缓存的函数
 */
export function withCache<K, V>(
  fn: (key: K) => V,
  options: CacheOptions = {},
): (key: K) => V {
  const cache = new LRUCache<K, V>(options);

  return (key: K): V => {
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const value = fn(key);
    cache.set(key, value);
    return value;
  };
}
