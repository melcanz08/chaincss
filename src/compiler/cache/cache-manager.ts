// chaincss/src/compiler/cache/cache-manager.ts
// High-performance, concurrent-safe compilation cache subsystem with precise boundary controls

import fs from "fs";
import path from "path";

export interface CacheEntry<T = any> {
  value: T;
  cachedAt: number;
  expires?: number;
}

export interface CacheStats {
  totalStyles: number;
  atomicStyles: number;
  cacheHits: number;
  cacheMisses: number;
}

export interface CacheData {
  version: string;
  created: string;
  updated: string;
  stats: CacheStats;
  entries: Record<string, CacheEntry>;
}

export interface CacheOptions {
  maxAge?: number;
  maxSize?: number;
  autoSave?: boolean;
  saveInterval?: number;
}

export class CacheManager {
  readonly cachePath: string;
  readonly cacheDir: string;
  cache!: CacheData;
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private stats = { hits: 0, misses: 0, writes: 0, reads: 0 };
  private options: Required<CacheOptions>;
  private lastSize = 0;
  private lastSizeCheck = 0;
  private inFlight = new Map<string, Promise<any>>();

  constructor(
    cachePath: string = "./.chaincss-cache",
    options: CacheOptions = {},
  ) {
    this.options = {
      maxAge: options.maxAge ?? 7 * 24 * 60 * 60 * 1000,
      maxSize: options.maxSize ?? 100 * 1024 * 1024,
      autoSave: options.autoSave !== false,
      saveInterval: options.saveInterval ?? 5000,
    };
    this.cachePath = path.resolve(process.cwd(), cachePath);
    this.cacheDir = path.dirname(this.cachePath);

    this.load();
    if (this.options.autoSave) {
      this.startAutoSave();
    }
  }

  private startAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
    this.saveTimer = setInterval(() => {
      if (this.dirty) {
        this.save();
      }
    }, this.options.saveInterval);

    if (this.saveTimer && typeof this.saveTimer.unref === "function") {
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
        try {
          const stat = fs.statSync(this.cachePath);
          if (stat.isDirectory()) {
            fs.rmSync(this.cachePath, { recursive: true, force: true });
            this.cache = this.getDefaultCache();
            this.dirty = true;
            return;
          }
          this.lastSize = stat.size;
          this.lastSizeCheck = Date.now();
        } catch {
          // Fallback if stat checks fail during system locks
        }

        const rawData = fs.readFileSync(this.cachePath, "utf8");
        const parsed = JSON.parse(rawData);
        if (!parsed || !parsed.entries) {
          this.cache = this.getDefaultCache();
          this.dirty = true;
          return;
        }

        this.cache = {
          ...this.getDefaultCache(),
          ...parsed,
          stats: {
            ...this.getDefaultCache().stats,
            ...(parsed.stats || {}),
          },
        };

        if (this.isExpired()) {
          this.clear();
        } else {
          this.checkAndPrune();
        }
      } else {
        if (!fs.existsSync(this.cacheDir)) {
          fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        this.cache = this.getDefaultCache();
        this.dirty = true;
      }
    } catch (error) {
      console.warn(
        "Could not load compiler cache, starting fresh:",
        (error as Error).message,
      );
      this.cache = this.getDefaultCache();
      this.dirty = true;
    }
  }

  private getDefaultCache(): CacheData {
    return {
      version: "2.14.0",
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      stats: { totalStyles: 0, atomicStyles: 0, cacheHits: 0, cacheMisses: 0 },
      entries: {},
    };
  }

  private isExpired(): boolean {
    const createdTime = new Date(this.cache.created || "").getTime();
    if (Number.isNaN(createdTime)) return true;
    return Date.now() - createdTime > this.options.maxAge;
  }

  private checkAndPrune(): void {
    const size = this.getCacheSize();
    if (size > this.options.maxSize) {
      this.prune();
    }
  }

  get<T = any>(key: string): T | undefined {
    this.stats.reads++;
    const entry = this.cache.entries[key];

    if (entry !== undefined) {
      if (entry.expires && entry.expires < Date.now()) {
        delete this.cache.entries[key];
        this.stats.misses++;
        this.dirty = true;
        return undefined;
      }
      this.stats.hits++;
      return entry.value as T;
    }

    this.stats.misses++;
    return undefined;
  }

  set(key: string, value: any, ttl?: number): void {
    this.cache.entries[key] = {
      value,
      cachedAt: Date.now(),
      expires: ttl ? Date.now() + ttl : undefined,
    };
    this.dirty = true;
    this.stats.writes++;

    if (this.cache.stats) {
      if (key === "atomic" && value && typeof value === "object") {
        this.cache.stats.atomicStyles = Object.keys(value).length;
      }
      this.cache.stats.totalStyles = Object.keys(this.cache.entries).length;
    }
  }

  has(key: string): boolean {
    const e = this.cache.entries[key];
    if (!e) return false;
    if (e.expires && e.expires < Date.now()) {
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    if (this.cache.entries[key] !== undefined) {
      delete this.cache.entries[key];
      this.dirty = true;
      if (this.cache.stats) {
        this.cache.stats.totalStyles = Object.keys(this.cache.entries).length;
      }
      return true;
    }
    return false;
  }

  clear(): void {
    this.cache = this.getDefaultCache();
    this.dirty = true;
    this.stats = { hits: 0, misses: 0, writes: 0, reads: 0 };
    this.lastSize = 0;
    this.lastSizeCheck = 0;
    this.inFlight.clear();
    if (fs.existsSync(this.cachePath)) {
      try {
        const stats = fs.statSync(this.cachePath);
        if (stats.isDirectory()) {
          fs.rmSync(this.cachePath, { recursive: true, force: true });
        } else {
          fs.unlinkSync(this.cachePath);
        }
      } catch (e) {
        console.warn("Could not delete cache file:", (e as Error).message);
      }
    }
  }

  prune(): void {
    const now = Date.now();
    let prunedCount = 0;

    for (const k in this.cache.entries) {
      if (!Object.prototype.hasOwnProperty.call(this.cache.entries, k))
        continue;
      if (
        this.cache.entries[k].expires &&
        this.cache.entries[k].expires! < now
      ) {
        delete this.cache.entries[k];
        prunedCount++;
      }
    }

    const currentSize = this.getCacheSize(true);
    if (currentSize > this.options.maxSize) {
      const entries = Object.entries(this.cache.entries);
      entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);

      const toEvict = Math.ceil(entries.length * 0.3);
      for (let i = 0; i < toEvict && i < entries.length; i++) {
        delete this.cache.entries[entries[i][0]];
        prunedCount++;
      }
    }

    this.cache.updated = new Date().toISOString();
    if (this.cache.stats) {
      this.cache.stats.totalStyles = Object.keys(this.cache.entries).length;
    }
    this.dirty = true;

    if (prunedCount > 0 && this.options.autoSave) {
      console.log(
        `[ChainCSS Cache] Pruned ${prunedCount} entries to fit within footprint layout.`,
      );
    }
  }

  save(): void {
    if (!this.dirty) return;
    try {
      this.cache.updated = new Date().toISOString();

      if (this.cache.stats) {
        this.cache.stats.cacheHits =
          (this.cache.stats.cacheHits || 0) + this.stats.hits;
        this.cache.stats.cacheMisses =
          (this.cache.stats.cacheMisses || 0) + this.stats.misses;
      }

      this.stats.hits = 0;
      this.stats.misses = 0;

      const data = JSON.stringify(this.cache);
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      const tmp = `${this.cachePath}.tmp`;
      fs.writeFileSync(tmp, data, "utf8");
      fs.renameSync(tmp, this.cachePath);

      this.lastSize = Buffer.byteLength(data, "utf8");
      this.lastSizeCheck = Date.now();
      this.dirty = false;
    } catch (error) {
      console.warn("Could not save cache to disk:", (error as Error).message);
    }
  }

  getStats() {
    const hits = (this.cache.stats?.cacheHits || 0) + this.stats.hits;
    const misses = (this.cache.stats?.cacheMisses || 0) + this.stats.misses;
    const total = hits + misses;
    const hitRate = total > 0 ? (hits / total) * 100 : 0;

    return {
      hits,
      misses,
      reads: this.stats.reads,
      writes: this.stats.writes,
      hitRate,
      size: this.getCacheSize(this.dirty),
      entryCount: Object.keys(this.cache.entries).length,
    };
  }

  getCacheSize(force = false): number {
    const now = Date.now();
    if (!force && now - this.lastSizeCheck < 1000 && this.lastSize > 0) {
      return this.lastSize;
    }

    if (this.dirty || force || this.lastSize === 0) {
      try {
        const structuralWeight = Buffer.byteLength(
          JSON.stringify(this.cache),
          "utf8",
        );
        this.lastSize = structuralWeight;
        this.lastSizeCheck = now;
        return structuralWeight;
      } catch {}
    }

    try {
      if (fs.existsSync(this.cachePath)) {
        const s = fs.statSync(this.cachePath).size;
        this.lastSize = s;
        this.lastSizeCheck = now;
        return s;
      }
    } catch {}

    return this.lastSize;
  }

  getCacheAge(): number {
    try {
      if (fs.existsSync(this.cachePath)) {
        return Date.now() - fs.statSync(this.cachePath).mtimeMs;
      }
    } catch {}
    return 0;
  }

  getKeys(): string[] {
    return Object.keys(this.cache.entries);
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
    if (this.dirty) {
      this.save();
    }
  }

  getEntry(key: string): CacheEntry | undefined {
    const entry = this.cache.entries[key];
    if (entry && (!entry.expires || entry.expires > Date.now())) {
      return entry;
    }
    return undefined;
  }

  setWithTTL(key: string, value: any, ttlSeconds: number): void {
    this.set(key, value, ttlSeconds * 1000);
  }

  setBulk(entries: Record<string, any>): void {
    const now = Date.now();
    let changed = false;
    let newWrites = 0;

    for (const k in entries) {
      if (!Object.prototype.hasOwnProperty.call(entries, k)) continue;
      this.cache.entries[k] = { value: entries[k], cachedAt: now };
      changed = true;
      newWrites++;
    }

    if (changed) {
      this.dirty = true;
      this.stats.writes += newWrites;
      if (this.cache.stats) {
        this.cache.stats.totalStyles = Object.keys(this.cache.entries).length;
      }
    }
  }

  getBulk(keys: string[]): Record<string, any> {
    const result: Record<string, any> = {};
    for (const key of keys) {
      const v = this.get(key);
      if (v !== undefined) {
        result[key] = v;
      }
    }
    return result;
  }

  async getOrCompute<T>(
    key: string,
    compute: () => Promise<T>,
    ttl?: number,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== undefined) return cached;

    if (this.inFlight.has(key)) {
      return this.inFlight.get(key) as Promise<T>;
    }

    const task = (async () => {
      try {
        const computed = await compute();
        this.set(key, computed, ttl);
        return computed;
      } finally {
        this.inFlight.delete(key);
      }
    })();

    this.inFlight.set(key, task);
    return task;
  }
}

export { CacheManager as default };