// src/compiler/services/cache-store.ts

/**
 * LRU Cache Store — Generic cache with LRU eviction.
 * Extracted from ChainCSSCompiler for separation of concerns.
 */

interface CacheEntry<T> {
  result: T;
  accessCount: number;
  lastAccessed: number;
  hash: string;
}

export class CacheStore<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private lru: string[] = [];
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize: number = 500) {
    this.maxSize = maxSize;
  }

  /**
   * Get a cached entry. Returns undefined if not found or expired.
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    
    this.hits++;
    entry.lastAccessed = Date.now();
    entry.accessCount++;
    this.touchLRU(key);
    
    return entry.result;
  }

  /**
   * Set a cached entry. Evicts oldest entry if at capacity.
   */
  set(key: string, result: T, hash: string): void {
    const entry: CacheEntry<T> = {
      result,
      accessCount: 1,
      lastAccessed: Date.now(),
      hash,
    };
    
    if (this.cache.has(key)) {
      this.cache.set(key, entry);
      this.touchLRU(key);
      return;
    }
    
    // Evict oldest if at capacity
    while (this.cache.size >= this.maxSize && this.lru.length > 0) {
      const oldest = this.lru.shift();
      if (oldest) {
        this.cache.delete(oldest);
      }
    }
    
    this.cache.set(key, entry);
    this.lru.push(key);
  }

  /**
   * Check if a key exists in the cache.
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Remove a specific entry.
   */
  delete(key: string): boolean {
    this.lru = this.lru.filter(k => k !== key);
    return this.cache.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
    this.lru = [];
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; maxSize: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  private touchLRU(key: string): void {
    this.lru = this.lru.filter(k => k !== key);
    this.lru.push(key);
  }
}