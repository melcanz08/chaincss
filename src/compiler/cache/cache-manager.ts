// chaincss/src/compiler/cache-manager.ts
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface CacheData {
  version: string;
  created: string;
  updated: string;
  atomic: Record<string, any>;
  usage: Record<string, any>;
  componentMap: Record<string, any>;
  stats: {
    totalStyles: number;
    atomicStyles: number;
    cacheHits: number;
    cacheMisses: number;
  };
  [key: string]: any;
}

export interface CacheOptions {
  maxAge?: number; // Maximum age in milliseconds
  maxSize?: number; // Maximum cache size in bytes
  compress?: boolean; // Compress cache data
  autoSave?: boolean; // Auto-save on changes
  saveInterval?: number; // Auto-save interval in ms
}

export class CacheManager {
  cachePath: string;
  cacheDir: string;
  cache: CacheData | Record<string, any>;
  private dirty: boolean = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private stats = {
    hits: 0,
    misses: 0,
    writes: 0,
    reads: 0
  };
  private options: Required<CacheOptions>;

  constructor(cachePath: string = './.chaincss-cache', options: CacheOptions = {}) {
    this.options = {
      maxAge: options.maxAge || 7 * 24 * 60 * 60 * 1000, // 7 days default
      maxSize: options.maxSize || 100 * 1024 * 1024, // 100MB default
      compress: options.compress || false,
      autoSave: options.autoSave !== false,
      saveInterval: options.saveInterval || 5000 // 5 seconds
    };
    
    this.cachePath = path.resolve(process.cwd(), cachePath);
    this.cacheDir = path.dirname(this.cachePath);
    this.cache = {};
    this.load();
    
    // Setup auto-save if enabled
    if (this.options.autoSave) {
      this.startAutoSave();
    }
  }

  private startAutoSave(): void {
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.saveTimer = setInterval(() => {
      if (this.dirty) {
        this.save();
      }
    }, this.options.saveInterval);
    
    // Ensure timer doesn't keep process alive
    if (this.saveTimer.unref) {
      this.saveTimer.unref();
    }
  }

  private stopAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }

  load(): void {
    try {
      if (fs.existsSync(this.cachePath)) {
        let data = fs.readFileSync(this.cachePath, 'utf8');
        
        // Decompress if needed
        if (this.options.compress && this.isCompressed(data)) {
          data = this.decompress(data);
        }
        
        this.cache = JSON.parse(data);
        
        // Check if cache is expired
        if (this.isExpired()) {
          console.log('Cache expired, clearing...');
          this.clear();
          this.cache = this.getDefaultCache();
        }
        
        // Check cache size
        this.checkAndPrune();
      } else {
        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        this.cache = this.getDefaultCache();
      }
    } catch (error) {
      console.warn('Could not load cache, starting fresh:', (error as Error).message);
      this.cache = this.getDefaultCache();
    }
  }

  private getDefaultCache(): CacheData {
    return {
      version: '2.0.0',
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      atomic: {},
      usage: {},
      componentMap: {},
      stats: {
        totalStyles: 0,
        atomicStyles: 0,
        cacheHits: 0,
        cacheMisses: 0
      }
    };
  }

  private isExpired(): boolean {
    const created = this.cache.created ? new Date(this.cache.created).getTime() : 0;
    const now = Date.now();
    return (now - created) > this.options.maxAge;
  }

  private checkAndPrune(): void {
    try {
      const stats = fs.statSync(this.cachePath);
      if (stats.size > this.options.maxSize) {
        console.log(`Cache size (${stats.size} bytes) exceeds limit (${this.options.maxSize} bytes), pruning...`);
        this.prune();
      }
    } catch (error) {
      // File might not exist yet
    }
  }

  private isCompressed(data: string): boolean {
    // Check if data looks like compressed (base64 encoded)
    return data.startsWith('COMPRESSED:');
  }

  private compress(data: string): string {
    // Simple compression - could be enhanced with zlib
    const compressed = Buffer.from(data).toString('base64');
    return `COMPRESSED:${compressed}`;
  }

  private decompress(data: string): string {
    if (data.startsWith('COMPRESSED:')) {
      const compressed = data.substring(11);
      return Buffer.from(compressed, 'base64').toString();
    }
    return data;
  }

  get(key: string): any {
    this.stats.reads++;
    
    if (this.cache[key] !== undefined) {
      // Check if this specific entry has expired
      if (this.cache[key].expires && this.cache[key].expires < Date.now()) {
        delete this.cache[key];
        this.stats.misses++;
        this.dirty = true;
        return undefined;
      }
      
      this.stats.hits++;
      if (this.cache.stats) {
        this.cache.stats.cacheHits++;
      }
      return this.cache[key];
    }
    
    this.stats.misses++;
    if (this.cache.stats) {
      this.cache.stats.cacheMisses++;
    }
    return undefined;
  }

  set(key: string, value: any, ttl?: number): void {
    const entry = {
      ...value,
      cachedAt: Date.now(),
      expires: ttl ? Date.now() + ttl : undefined
    };
    
    this.cache[key] = entry;
    this.dirty = true;
    this.stats.writes++;
    
    if (this.cache.stats && key !== 'stats') {
      // Update stats if this is atomic or component data
      if (key === 'atomic') {
        this.cache.stats.atomicStyles = Object.keys(value).length;
      }
    }
  }

  has(key: string): boolean {
    const value = this.get(key);
    return value !== undefined;
  }

  delete(key: string): boolean {
    if (this.cache[key] !== undefined) {
      delete this.cache[key];
      this.dirty = true;
      return true;
    }
    return false;
  }

  clear(): void {
    this.cache = this.getDefaultCache();
    this.dirty = true;
    this.stats = { hits: 0, misses: 0, writes: 0, reads: 0 };
    
    if (fs.existsSync(this.cachePath)) {
      try {
        fs.unlinkSync(this.cachePath);
      } catch (error) {
        console.warn('Could not delete cache file:', (error as Error).message);
      }
    }
    
    console.log('Cache cleared');
  }

  prune(): void {
    const now = Date.now();
    let prunedCount = 0;
    
    for (const [key, value] of Object.entries(this.cache)) {
      // Skip metadata keys
      if (['version', 'created', 'updated', 'stats'].includes(key)) continue;
      
      // Remove expired entries
      if (value.expires && value.expires < now) {
        delete this.cache[key];
        prunedCount++;
      }
    }
    
    // Update timestamp
    this.cache.updated = new Date().toISOString();
    this.dirty = true;
    
    if (prunedCount > 0 && this.options.autoSave) {
      console.log(`Pruned ${prunedCount} expired cache entries`);
    }
  }

  save(): void {
    if (!this.dirty) return;
    
    try {
      // Update metadata
      this.cache.updated = new Date().toISOString();
      if (this.cache.stats) {
        this.cache.stats = { ...this.cache.stats, ...this.stats };
      }
      
      let data = JSON.stringify(this.cache, null, 2);
      
      // Compress if enabled
      if (this.options.compress && data.length > 1024) {
        data = this.compress(data);
      }
      
      // Ensure directory exists
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }
      
      // Write to temp file first, then rename for atomicity
      const tempPath = `${this.cachePath}.tmp`;
      fs.writeFileSync(tempPath, data, 'utf8');
      fs.renameSync(tempPath, this.cachePath);
      
      this.dirty = false;
    } catch (error) {
      console.warn('Could not save cache:', (error as Error).message);
    }
  }

  getStats(): {
    hits: number;
    misses: number;
    reads: number;
    writes: number;
    hitRate: number;
    size: number;
    entryCount: number;
  } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    let size = 0;
    try {
      if (fs.existsSync(this.cachePath)) {
        const stats = fs.statSync(this.cachePath);
        size = stats.size;
      }
    } catch (error) {
      // Ignore
    }
    
    const entryCount = Object.keys(this.cache).filter(k => 
      !['version', 'created', 'updated', 'stats'].includes(k)
    ).length;
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      reads: this.stats.reads,
      writes: this.stats.writes,
      hitRate,
      size,
      entryCount
    };
  }

  getCacheSize(): number {
    try {
      if (fs.existsSync(this.cachePath)) {
        const stats = fs.statSync(this.cachePath);
        return stats.size;
      }
    } catch (error) {
      // Ignore
    }
    return 0;
  }

  getCacheAge(): number {
    try {
      if (fs.existsSync(this.cachePath)) {
        const stats = fs.statSync(this.cachePath);
        return Date.now() - stats.mtimeMs;
      }
    } catch (error) {
      // Ignore
    }
    return 0;
  }

  getKeys(): string[] {
    return Object.keys(this.cache).filter(k => 
      !['version', 'created', 'updated', 'stats'].includes(k)
    );
  }

  getSize(): number {
    return this.getCacheSize();
  }

  isDirty(): boolean {
    return this.dirty;
  }

  async flush(): Promise<void> {
    if (this.dirty) {
      this.save();
    }
  }

  destroy(): void {
    this.stopAutoSave();
    this.clear();
  }

  // Get cache entry with metadata
  getEntry(key: string): { value: any; cachedAt: number; expires?: number } | undefined {
    const entry = this.cache[key];
    if (entry && (!entry.expires || entry.expires > Date.now())) {
      return {
        value: entry.value !== undefined ? entry.value : entry,
        cachedAt: entry.cachedAt,
        expires: entry.expires
      };
    }
    return undefined;
  }

  // Set cache entry with custom TTL in seconds
  setWithTTL(key: string, value: any, ttlSeconds: number): void {
    this.set(key, value, ttlSeconds * 1000);
  }

  // Bulk set multiple entries
  setBulk(entries: Record<string, any>): void {
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value);
    }
  }

  // Bulk get multiple entries
  getBulk(keys: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result[key] = value;
      }
    }
    return result;
  }

  // Get or compute cache value
  async getOrCompute<T>(
    key: string, 
    compute: () => Promise<T>, 
    ttl?: number
  ): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) {
      return cached;
    }
    
    const computed = await compute();
    this.set(key, computed, ttl);
    return computed;
  }
}

// ESM Export
export { CacheManager as default };