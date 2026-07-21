// src/compiler/services/cache-store.ts

interface CacheNode<T> {
  key: string;
  result: T;
  hash: string;
  createdAt: number;
  prev: CacheNode<T> | null;
  next: CacheNode<T> | null;
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
    this.maxSize = Math.max(0, maxSize)
    this.ttl = Math.max(0, ttlMs)
  }

  get(key: string, currentHash?: string): T | undefined {
    const node = this.lookup.get(key);
    if (!node) {
      this.misses++;
      return undefined;
    }

    // Check Time-To-Live Expiry
    if (this.ttl > 0 && Date.now() - node.createdAt > this.ttl) {
      this.removeNode(node);
      this.lookup.delete(key);
      this.invalidations++;
      this.misses++;
      return undefined;
    }

    // Check File Contents Invalidation
    if (currentHash !== undefined && node.hash !== currentHash) {
      this.removeNode(node);
      this.lookup.delete(key);
      this.invalidations++;
      this.misses++;
      return undefined;
    }

    this.hits++;
    
    // True O(1) Touch: detach pointers and move to head (no garbage generated)
    this.detach(node);
    this.setHead(node);

    return node.result;
  }

  set(key: string, result: T, hash: string): void {
    if (this.maxSize === 0) return
    let node = this.lookup.get(key);

    if (node) {
      // Update existing entry configuration
      node.result = result;
      node.hash = hash;
      node.createdAt = Date.now();
      this.detach(node);
      this.setHead(node);
      return;
    }

    // Create a new entry node
    node = {
      key,
      result,
      hash,
      createdAt: Date.now(),
      prev: null,
      next: null
    };

    if (this.lookup.size >= this.maxSize && this.tail) {
      // Evict oldest node (tail element)
      const oldestKey = this.tail.key;
      this.lookup.delete(oldestKey);
      this.removeNode(this.tail);
      this.evictions++;
    }

    this.lookup.set(key, node);
    this.setHead(node);
  }

  has(key: string): boolean {
    const n = this.lookup.get(key)
    if (!n) return false
    if (this.ttl>0 && Date.now()-n.createdAt>this.ttl) {
      this.delete(key); this.invalidations++; return false
    }
    return true
  }

  delete(key: string): boolean {
    const node = this.lookup.get(key);
    if (!node) return false;
    this.removeNode(node);
    return this.lookup.delete(key);
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

  // ============================================================================
  // Pointer Mutation Engines
  // ============================================================================

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

  private removeNode(node: CacheNode<T>) {
    this.detach(node)
    ;(node as any).result = null // clear ref
    node.prev=null; node.next=null
  }

  getStats() {
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
}

export default CacheStore;