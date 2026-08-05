// src/compiler/services/cache-store.ts

interface CacheNode<T> {
  key: string;
  result: T;
  hash: string;
  createdAt: number;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
}

export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  invalidations: number;
  hitRate: number;
}

export class CacheStore<T> {
  private lookup = new Map<string, CacheNode<T>>();
  private head: CacheNode<T> | null = null;
  private tail: CacheNode<T> | null = null;

  private readonly maxSize: number;
  private readonly ttl: number; // 0 means disabled

  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private invalidations = 0;

  constructor(maxSize: number = 500, ttlMs: number = 0) {
    this.maxSize = Math.max(0, maxSize);
    this.ttl = Math.max(0, ttlMs);
  }

  /**
   * Retrieves an item from the cache.
   * Checks both TTL expiry and optional file content hash validity.
   */
  get(key: string, currentHash?: string): T | undefined {
    const node = this.lookup.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    // Check Time-To-Live Expiry
    if (this.ttl > 0 && Date.now() - node.createdAt > this.ttl) {
      this.evictNode(node);
      this.invalidations++;
      this.misses++;
      return undefined;
    }

    // Check File Contents / Hash Invalidation
    if (currentHash !== undefined && node.hash !== currentHash) {
      this.evictNode(node);
      this.invalidations++;
      this.misses++;
      return undefined;
    }

    this.hits++;
    this.moveToHead(node);

    return node.result;
  }

  /**
   * Inserts or updates an entry in the cache.
   */
  set(key: string, result: T, hash: string): void {
    if (this.maxSize === 0) return;
    let node = this.lookup.get(key);

    if (node) {
      node.result = result;
      node.hash = hash;
      node.createdAt = Date.now();
      this.moveToHead(node);
      return;
    }

    // Evict oldest node if at capacity
    if (this.lookup.size >= this.maxSize && this.tail) {
      this.evictNode(this.tail);
      this.evictions++;
    }

    node = {
      key,
      result,
      hash,
      createdAt: Date.now(),
      prev: null,
      next: null,
    };

    this.lookup.set(key, node);
    this.setHead(node);
  }

  /**
   * Checks if a valid key exists without mutating LRU order.
   */
  has(key: string, currentHash?: string): boolean {
    const node = this.lookup.get(key);
    if (!node) return false;

    if (this.ttl > 0 && Date.now() - node.createdAt > this.ttl) {
      this.evictNode(node);
      this.invalidations++;
      return false;
    }

    if (currentHash !== undefined && node.hash !== currentHash) {
      this.evictNode(node);
      this.invalidations++;
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const node = this.lookup.get(key);
    if (!node) return false;
    this.evictNode(node);
    return true;
  }

  /**
   * Bulk invalidates entries matching a prefix (e.g., file directory paths).
   */
  invalidatePrefix(prefix: string): number {
    let count = 0;
    for (const key of Array.from(this.lookup.keys())) {
      if (key.startsWith(prefix)) {
        if (this.delete(key)) count++;
      }
    }
    this.invalidations += count;
    return count;
  }

  /**
   * Invalidates entries matching a custom filter predicate.
   */
  invalidateWhere(predicate: (key: string, result: T) => boolean): number {
    let count = 0;
    for (const [key, node] of Array.from(this.lookup.entries())) {
      if (predicate(key, node.result)) {
        if (this.delete(key)) count++;
      }
    }
    this.invalidations += count;
    return count;
  }

  /**
   * Sweeps expired TTL items from memory.
   */
  pruneExpired(): number {
    if (this.ttl <= 0) return 0;
    const now = Date.now();
    let pruned = 0;

    for (const [key, node] of Array.from(this.lookup.entries())) {
      if (now - node.createdAt > this.ttl) {
        this.evictNode(node);
        pruned++;
      }
    }

    this.invalidations += pruned;
    return pruned;
  }

  clear(): void {
    this.lookup.clear();
    this.head = null;
    this.tail = null;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.invalidations = 0;
  }

  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.lookup.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      invalidations: this.invalidations,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  // ============================================================================
  // Pointer Mutation Engines
  // ============================================================================

  private moveToHead(node: CacheNode<T>): void {
    if (this.head === node) return; // Fast path: already MRU
    this.detach(node);
    this.setHead(node);
  }

  private setHead(node: CacheNode<T>): void {
    node.next = this.head;
    node.prev = null;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private detach(node: CacheNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    else this.head = node.next;

    if (node.next) node.next.prev = node.prev;
    else this.tail = node.prev;
  }

  private evictNode(node: CacheNode<T>): void {
    this.detach(node);
    this.lookup.delete(node.key);
    (node as any).result = null; // Detach reference for GC
    node.prev = null;
    node.next = null;
  }
}

export default CacheStore;