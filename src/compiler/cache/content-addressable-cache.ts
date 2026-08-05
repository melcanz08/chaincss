// ============================================================================
// FILE: chaincss/src/compiler/cache/content-addressable-cache.ts
// ============================================================================

import crypto from "crypto";
import fs from "fs";
import path from "path";

const COMPILER_VERSION = "3.1.0";
const CACHE_VERSION = "3.1.0";
const MAX_MEMORY_ENTRIES = 100;

export interface PersistentCacheEntry {
  hash: string;
  result: any;
  dependencies: Record<string, string>;
  timestamp: number;
  version: string;
  compilerVersion: string;
  createdAt?: number;
  lastAccessed?: number;
  accessCount?: number;
  size?: number;
  value?: any;
}

export interface PersistentCacheOptions {
  cacheDir?: string;
  maxAgeDays?: number;
  maxSizeMB?: number;
  enabled?: boolean;
  verbose?: boolean;
}

export class PersistentCache {
  private cacheDir: string;
  private options: Required<PersistentCacheOptions>;
  private memoryCache = new Map<string, PersistentCacheEntry>();
  private metadataPath: string;
  private metadata: {
    entries: Record<string, { hash: string; size: number; timestamp: number }>;
    totalSize: number;
    lastCleanup: number;
  };

  constructor(options: PersistentCacheOptions = {}) {
    this.options = {
      cacheDir: options.cacheDir || "./.chaincss/persistent-cache",
      maxAgeDays: options.maxAgeDays || 30,
      maxSizeMB: options.maxSizeMB || 500,
      enabled: options.enabled !== false,
      verbose: options.verbose || false,
    };

    this.cacheDir = path.resolve(process.cwd(), this.options.cacheDir);
    this.metadataPath = path.join(this.cacheDir, "metadata.json");
    this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };

    if (this.options.enabled) {
      this.ensureDirSync();
      this.loadMetadataSync();
    }
  }

  // ==========================================================================
  // Hashing
  // ==========================================================================

  private hash(content: string | Buffer): string {
    return crypto.createHash("sha256").update(content).digest("hex");
  }

  private async resolveDependencyHash(dep: string): Promise<string> {
    try {
      await fs.promises.access(dep);
      const stat = await fs.promises.stat(dep);
      if (stat.isFile()) {
        const content = await fs.promises.readFile(dep);
        return this.hash(content);
      }
    } catch {
      // Fallback if filesystem blocks access — hash the path string itself
    }
    return this.hash(dep);
  }

  private resolveDependencyHashSync(dep: string): string {
    try {
      if (fs.existsSync(dep) && fs.statSync(dep).isFile()) {
        return this.hash(fs.readFileSync(dep));
      }
    } catch {}
    return this.hash(dep);
  }

  // ==========================================================================
  // Memory Cache (LRU)
  // ==========================================================================

  private touchMemoryCache(hash: string): PersistentCacheEntry | undefined {
    const entry = this.memoryCache.get(hash);
    if (entry) {
      this.memoryCache.delete(hash);
      this.memoryCache.set(hash, entry);
    }
    return entry;
  }

  private writeMemoryLRU(hash: string, entry: PersistentCacheEntry): void {
    if (this.memoryCache.has(hash)) {
      this.memoryCache.delete(hash);
    } else if (this.memoryCache.size >= MAX_MEMORY_ENTRIES) {
      const lruKey = this.memoryCache.keys().next().value;
      if (lruKey) this.memoryCache.delete(lruKey);
    }
    this.memoryCache.set(hash, entry);
  }

  // ==========================================================================
  // Public API — Async
  // ==========================================================================

  async getByContent(source: string): Promise<any | null> {
    if (!this.options.enabled) return null;
    return this.getByHash(this.hash(source));
  }

  async getByFile(filePath: string): Promise<any | null> {
    if (!this.options.enabled) return null;
    try {
      await fs.promises.access(filePath);
      const content = await fs.promises.readFile(filePath, "utf8");
      return this.getByContent(content);
    } catch {
      return null;
    }
  }

  async getByHash(hash: string): Promise<any | null> {
    if (!this.options.enabled) return null;

    const entry = this.touchMemoryCache(hash);
    if (entry) {
      if (!this.isExpired(entry) && (await this.checkDependenciesValid(entry))) {
        if (this.options.verbose)
          console.log(`[persistent-cache] Memory HIT: ${hash.slice(0, 8)}`);
        return entry.result;
      }
      this.memoryCache.delete(hash);
    }

    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    try {
      await fs.promises.access(cachePath);
      const raw = await fs.promises.readFile(cachePath, "utf8");
      const diskEntry: PersistentCacheEntry = JSON.parse(raw);

      if (!this.isExpired(diskEntry) && (await this.checkDependenciesValid(diskEntry))) {
        this.writeMemoryLRU(hash, diskEntry);
        if (this.options.verbose)
          console.log(`[persistent-cache] Disk HIT: ${hash.slice(0, 8)}`);
        return diskEntry.result;
      }

      await fs.promises.unlink(cachePath).catch(() => {});
    } catch {
      // Cache miss
    }

    return null;
  }

  async setByContent(
    source: string,
    result: any,
    dependencies: string[] = [],
  ): Promise<string> {
    if (!this.options.enabled) return "";
    return this.setByHash(this.hash(source), result, dependencies);
  }

  async setByFile(
    filePath: string,
    result: any,
    dependencies: string[] = [],
  ): Promise<string> {
    if (!this.options.enabled) return "";
    try {
      await fs.promises.access(filePath);
      const content = await fs.promises.readFile(filePath, "utf8");
      return this.setByContent(content, result, dependencies);
    } catch {
      return "";
    }
  }

  async setByHash(
    hash: string,
    result: any,
    dependencies: string[] = [],
  ): Promise<string> {
    if (!this.options.enabled) return hash;
    await this.ensureDirAsync();

    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (this.metadata.entries[hash]) {
      try {
        await fs.promises.access(cachePath);
        return hash;
      } catch {
        // File missing — re-create
      }
    }

    // Parallel dependency hash resolution
    const depHashEntries = await Promise.all(
      dependencies.map(async (dep) => [dep, await this.resolveDependencyHash(dep)] as const)
    );
    const depHashes = Object.fromEntries(depHashEntries);

    const entry: PersistentCacheEntry = {
      hash,
      result,
      dependencies: depHashes,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      compilerVersion: COMPILER_VERSION,
    };

    this.writeMemoryLRU(hash, entry);

    const stringified = JSON.stringify(entry, null, 2);
    const entrySize = Buffer.byteLength(stringified, "utf8");

    const tmpPath = `${cachePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await fs.promises.writeFile(tmpPath, stringified, "utf8");
    await fs.promises.rename(tmpPath, cachePath);

    await this.commitMetadataEntry(hash, entry.timestamp, entrySize);
    await this.enforceSizeLimit();

    return hash;
  }

  // ==========================================================================
  // Public API — Sync (for legacy consumers)
  // ==========================================================================

  getByHashSync(hash: string): any | null {
    if (!this.options.enabled) return null;

    const entry = this.touchMemoryCache(hash);
    if (entry) {
      if (!this.isExpired(entry) && this.checkDependenciesValidSync(entry)) {
        return entry.result;
      }
      this.memoryCache.delete(hash);
    }

    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (fs.existsSync(cachePath)) {
      try {
        const diskEntry: PersistentCacheEntry = JSON.parse(
          fs.readFileSync(cachePath, "utf8"),
        );
        if (!this.isExpired(diskEntry) && this.checkDependenciesValidSync(diskEntry)) {
          this.writeMemoryLRU(hash, diskEntry);
          return diskEntry.result;
        }
        fs.unlinkSync(cachePath);
      } catch {
        // Fall through
      }
    }

    return null;
  }

  setByHashSync(
    hash: string,
    result: any,
    dependencies: string[] = [],
  ): void {
    if (!this.options.enabled) return;
    this.ensureDirSync();

    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (this.metadata.entries[hash] && fs.existsSync(cachePath)) {
      return;
    }

    const depHashes: Record<string, string> = {};
    for (const dep of dependencies) {
      depHashes[dep] = this.resolveDependencyHashSync(dep);
    }

    const entry: PersistentCacheEntry = {
      hash,
      result,
      dependencies: depHashes,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      compilerVersion: COMPILER_VERSION,
    };

    this.writeMemoryLRU(hash, entry);

    const stringified = JSON.stringify(entry, null, 2);
    const entrySize = Buffer.byteLength(stringified, "utf8");

    const tmpPath = `${cachePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    fs.writeFileSync(tmpPath, stringified, "utf8");
    fs.renameSync(tmpPath, cachePath);

    this.commitMetadataEntrySync(hash, entry.timestamp, entrySize);
    this.enforceSizeLimitSync();
  }

  invalidateByHash(hash: string): void {
    this.memoryCache.delete(hash);
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (fs.existsSync(cachePath)) {
      try {
        fs.unlinkSync(cachePath);
      } catch {}
    }
    if (this.metadata.entries[hash]) {
      delete this.metadata.entries[hash];
      this.recalculateTotalSize();
    }
    this.saveMetadataSync();
  }

  // ==========================================================================
  // Cache Management
  // ==========================================================================

  async clear(): Promise<void> {
    try {
      const files = await fs.promises.readdir(this.cacheDir);
      await Promise.all(
        files
          .filter((f) => f.endsWith(".json"))
          .map((f) => fs.promises.unlink(path.join(this.cacheDir, f)).catch(() => {}))
      );
    } catch {
      // Ignore missing directory
    }
    this.memoryCache.clear();
    this.metadata = { entries: {}, totalSize: 0, lastCleanup: Date.now() };
    await this.saveMetadataAsync();
  }

  async getStats() {
    const entries = Object.values(this.metadata.entries);
    if (entries.length === 0) {
      return {
        entryCount: 0,
        totalSizeMB: 0,
        totalSizeBytes: 0,
        oldestEntry: 0,
        newestEntry: 0,
        hitRate: 0,
      };
    }
    const timestamps = entries.map((e) => e.timestamp);
    return {
      entryCount: entries.length,
      totalSizeMB: this.metadata.totalSize / 1024 / 1024,
      totalSizeBytes: this.metadata.totalSize,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
      hitRate: this.memoryCache.size / entries.length,
    };
  }

  async prune(): Promise<void> {
    await this.enforceSizeLimit();
  }

  // ==========================================================================
  // Internal: Metadata & Validation
  // ==========================================================================

  private isExpired(entry: PersistentCacheEntry): boolean {
    return (
      Date.now() - entry.timestamp >
      this.options.maxAgeDays * 24 * 60 * 60 * 1000
    );
  }

  private async checkDependenciesValid(entry: PersistentCacheEntry): Promise<boolean> {
    if (!entry.dependencies || Object.keys(entry.dependencies).length === 0) {
      return true;
    }

    const checks = await Promise.all(
      Object.entries(entry.dependencies).map(async ([depPath, expectedHash]) => {
        const currentHash = await this.resolveDependencyHash(depPath);
        return currentHash === expectedHash;
      })
    );

    return checks.every(Boolean);
  }

  private checkDependenciesValidSync(entry: PersistentCacheEntry): boolean {
    if (!entry.dependencies || Object.keys(entry.dependencies).length === 0) {
      return true;
    }
    for (const [depPath, expectedHash] of Object.entries(entry.dependencies)) {
      const currentHash = this.resolveDependencyHashSync(depPath);
      if (currentHash !== expectedHash) {
        return false;
      }
    }
    return true;
  }

  private loadMetadataSync(): void {
    if (fs.existsSync(this.metadataPath)) {
      try {
        const diskMeta = JSON.parse(fs.readFileSync(this.metadataPath, "utf8"));
        this.metadata.entries = diskMeta.entries || {};
        this.recalculateTotalSize();
      } catch {
        this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
      }
    }
  }

  private recalculateTotalSize(): void {
    this.metadata.totalSize = Object.values(this.metadata.entries).reduce(
      (sum, entry) => sum + entry.size,
      0,
    );
  }

  private async commitMetadataEntry(
    hash: string,
    timestamp: number,
    size: number,
  ): Promise<void> {
    this.metadata.entries[hash] = { hash, size, timestamp };
    this.metadata.lastCleanup = Date.now();
    this.recalculateTotalSize();
    await this.saveMetadataAsync();
  }

  private commitMetadataEntrySync(
    hash: string,
    timestamp: number,
    size: number,
  ): void {
    this.metadata.entries[hash] = { hash, size, timestamp };
    this.metadata.lastCleanup = Date.now();
    this.recalculateTotalSize();
    this.saveMetadataSync();
  }

  private async saveMetadataAsync(): Promise<void> {
    await this.ensureDirAsync();

    // Read disk state, overlay local entries, but exclude keys deleted in memory
    if (fs.existsSync(this.metadataPath)) {
      try {
        const diskMeta = JSON.parse(
          await fs.promises.readFile(this.metadataPath, "utf8"),
        );
        const mergedEntries = { ...diskMeta.entries, ...this.metadata.entries };

        // Clean up keys deleted from memory metadata
        for (const key of Object.keys(diskMeta.entries || {})) {
          if (!this.metadata.entries[key]) {
            delete mergedEntries[key];
          }
        }
        this.metadata.entries = mergedEntries;
        this.recalculateTotalSize();
      } catch {}
    }

    const data = JSON.stringify(this.metadata, null, 2);
    const tmpPath = `${this.metadataPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;

    await fs.promises.writeFile(tmpPath, data, "utf8");
    await fs.promises.rename(tmpPath, this.metadataPath);
  }

  private saveMetadataSync(): void {
    this.ensureDirSync();

    if (fs.existsSync(this.metadataPath)) {
      try {
        const diskMeta = JSON.parse(fs.readFileSync(this.metadataPath, "utf8"));
        const mergedEntries = { ...diskMeta.entries, ...this.metadata.entries };

        for (const key of Object.keys(diskMeta.entries || {})) {
          if (!this.metadata.entries[key]) {
            delete mergedEntries[key];
          }
        }
        this.metadata.entries = mergedEntries;
        this.recalculateTotalSize();
      } catch {}
    }

    const data = JSON.stringify(this.metadata, null, 2);
    const tmpPath = `${this.metadataPath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;

    fs.writeFileSync(tmpPath, data, "utf8");
    fs.renameSync(tmpPath, this.metadataPath);
  }

  // ==========================================================================
  // Internal: Size Management
  // ==========================================================================

  async enforceSizeLimit(): Promise<void> {
    this.executeEvictionLoop();
  }

  private enforceSizeLimitSync(): void {
    this.executeEvictionLoop();
  }

  private executeEvictionLoop(): void {
    const limitBytes = this.options.maxSizeMB * 1024 * 1024;
    if (this.metadata.totalSize <= limitBytes) return;

    const sorted = Object.values(this.metadata.entries).sort(
      (a, b) => a.timestamp - b.timestamp,
    );

    for (const entry of sorted) {
      if (this.metadata.totalSize <= limitBytes) break;

      const cachePath = path.join(this.cacheDir, `${entry.hash}.json`);
      if (fs.existsSync(cachePath)) {
        try {
          fs.unlinkSync(cachePath);
        } catch {}
      }

      delete this.metadata.entries[entry.hash];
      this.memoryCache.delete(entry.hash);
      this.recalculateTotalSize();
    }

    this.saveMetadataSync();
  }

  // ==========================================================================
  // Internal: Helpers
  // ==========================================================================

  private ensureDirSync(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private async ensureDirAsync(): Promise<void> {
    try {
      await fs.promises.access(this.cacheDir);
    } catch {
      await fs.promises.mkdir(this.cacheDir, { recursive: true });
    }
  }

  // ==========================================================================
  // Query Helpers
  // ==========================================================================

  async listEntries() {
    const entries = [];
    for (const [hash, meta] of Object.entries(this.metadata.entries)) {
      const raw = this.memoryCache.get(hash);
      entries.push({
        key: hash,
        size: meta.size,
        timestamp: meta.timestamp,
        createdAt: meta.timestamp,
        lastAccessed: raw ? raw.timestamp : undefined,
      });
    }
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  async get(key: string): Promise<PersistentCacheEntry | null> {
    const memoryEntry = this.touchMemoryCache(key);
    if (memoryEntry) return memoryEntry;

    const cachePath = path.join(this.cacheDir, `${key}.json`);
    try {
      await fs.promises.access(cachePath);
      const entry: PersistentCacheEntry = JSON.parse(
        await fs.promises.readFile(cachePath, "utf8"),
      );
      this.writeMemoryLRU(key, entry);
      return entry;
    } catch {}
    return null;
  }

  async delete(key: string): Promise<boolean> {
    try {
      this.invalidateByHash(key);
      return true;
    } catch {
      return false;
    }
  }

  async validate(key: string): Promise<boolean> {
    const entry = await this.get(key);
    return entry ? !this.isExpired(entry) && (await this.checkDependenciesValid(entry)) : false;
  }
}

export { PersistentCache as default };