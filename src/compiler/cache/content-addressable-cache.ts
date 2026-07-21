// chaincss/src/compiler/cache/content-addressable-cache.ts

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Assume VERSION is exported from your local version tracking manifests
const COMPILER_VERSION = '3.1.0'; 
const CACHE_VERSION = '3.1.0';
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
      cacheDir: options.cacheDir || './.chaincss/persistent-cache',
      maxAgeDays: options.maxAgeDays || 30,
      maxSizeMB: options.maxSizeMB || 500,
      enabled: options.enabled !== false,
      verbose: options.verbose || false
    };
    
    this.cacheDir = path.resolve(process.cwd(), this.options.cacheDir);
    this.metadataPath = path.join(this.cacheDir, 'metadata.json');
    this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
    
    if (this.options.enabled) {
      this.ensureDir();
      this.loadMetadata();
    }
  }
  
  private hash(content: string | Buffer): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * Safe hashing variant that evaluates files or treats raw lines as standard key tokens.
   */
  private resolveDependencyHash(dep: string): string {
    try {
      if (fs.existsSync(dep) && fs.statSync(dep).isFile()) {
        return this.hash(fs.readFileSync(dep));
      }
    } catch {
      // Fallback if filesystem blocks standard read access
    }
    return this.hash(dep);
  }

  /**
   * Main memory cache read targeting O(1) LRU eviction tracking rules.
   */
  private touchMemoryCache(hash: string): PersistentCacheEntry | undefined {
    const entry = this.memoryCache.get(hash);
    if (entry) {
      // Re-insert to push the key to the back of the evaluation collection
      this.memoryCache.delete(hash);
      this.memoryCache.set(hash, entry);
    }
    return entry;
  }

  private writeMemoryLRU(hash: string, entry: PersistentCacheEntry): void {
    if (this.memoryCache.has(hash)) {
      this.memoryCache.delete(hash);
    } else if (this.memoryCache.size >= MAX_MEMORY_ENTRIES) {
      // The first entry is truly the Least Recently Used now
      const lruKey = this.memoryCache.keys().next().value;
      if (lruKey) this.memoryCache.delete(lruKey);
    }
    this.memoryCache.set(hash, entry);
  }
  
  // ============================================================================
  // Async Runtime Execution Methods
  // ============================================================================
  
  async getByContent(source: string): Promise<any | null> {
    if (!this.options.enabled) return null;
    return this.getByHash(this.hash(source));
  }
  
  async getByFile(filePath: string): Promise<any | null> {
    if (!this.options.enabled || !fs.existsSync(filePath)) return null;
    return this.getByContent(fs.readFileSync(filePath, 'utf8'));
  }
  
  async getByHash(hash: string): Promise<any | null> {
    if (!this.options.enabled) return null;
    
    const entry = this.touchMemoryCache(hash);
    if (entry) {
      if (!this.isExpired(entry)) {
        if (this.options.verbose) console.log(`[persistent-cache] Memory HIT: ${hash.slice(0, 8)}`);
        return entry.result;
      }
      this.memoryCache.delete(hash);
    }
    
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (fs.existsSync(cachePath)) {
      try {
        const diskEntry: PersistentCacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        
        if (!this.isExpired(diskEntry)) {
          this.writeMemoryLRU(hash, diskEntry);
          if (this.options.verbose) console.log(`[persistent-cache] Disk HIT: ${hash.slice(0, 8)}`);
          return diskEntry.result;
        } else {
          fs.unlinkSync(cachePath);
        }
      } catch {
        // Fall through on structural serialization breakage
      }
    }
    
    return null;
  }
  
  async setByContent(source: string, result: any, dependencies: string[] = []): Promise<string> {
    if (!this.options.enabled) return '';
    return this.setByHash(this.hash(source), result, dependencies);
  }
  
  async setByFile(filePath: string, result: any, dependencies: string[] = []): Promise<string> {
    if (!this.options.enabled || !fs.existsSync(filePath)) return '';
    return this.setByContent(fs.readFileSync(filePath, 'utf8'), result, dependencies);
  }
  
  async setByHash(hash: string, result: any, dependencies: string[] = []): Promise<string> {
    if (!this.options.enabled) return hash;
    
    // Deduplication optimization skip
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (this.metadata.entries[hash] && fs.existsSync(cachePath)) {
      return hash;
    }

    const depHashes: Record<string, string> = {};
    for (const dep of dependencies) {
      depHashes[dep] = this.resolveDependencyHash(dep);
    }
    
    const entry: PersistentCacheEntry = {
      hash,
      result,
      dependencies: depHashes,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      compilerVersion: COMPILER_VERSION
    };
    
    this.writeMemoryLRU(hash, entry);
    
    const stringified = JSON.stringify(entry, null, 2);
    const entrySize = Buffer.byteLength(stringified, 'utf8');
    
    fs.writeFileSync(cachePath, stringified);
    
    this.commitMetadataEntry(hash, entry.timestamp, entrySize);
    await this.enforceSizeLimit();
    
    return hash;
  }
  
  // ============================================================================
  // Sync Runtime Execution Methods
  // ============================================================================
  
  getByHashSync(hash: string): any | null {
    if (!this.options.enabled) return null;
    
    const entry = this.touchMemoryCache(hash);
    if (entry) {
      if (!this.isExpired(entry)) return entry.result;
      this.memoryCache.delete(hash);
    }
    
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (fs.existsSync(cachePath)) {
      try {
        const diskEntry: PersistentCacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (!this.isExpired(diskEntry)) {
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
  
  setByHashSync(hash: string, result: any, source: any, dependencies: string[] = []): void {
    if (!this.options.enabled) return;
    
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (this.metadata.entries[hash] && fs.existsSync(cachePath)) {
      return;
    }

    const depHashes: Record<string, string> = {};
    for (const dep of dependencies) {
      depHashes[dep] = this.resolveDependencyHash(dep);
    }
    
    const entry: PersistentCacheEntry = {
      hash,
      result,
      dependencies: depHashes,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      compilerVersion: COMPILER_VERSION
    };
    
    this.writeMemoryLRU(hash, entry);
    
    const stringified = JSON.stringify(entry, null, 2);
    const entrySize = Buffer.byteLength(stringified, 'utf8');
    
    fs.writeFileSync(cachePath, stringified);
    
    this.commitMetadataEntry(hash, entry.timestamp, entrySize);
    this.enforceSizeLimitSync();
  }
  
  invalidateByHash(hash: string): void {
    this.memoryCache.delete(hash);
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
    if (this.metadata.entries[hash]) {
      this.metadata.totalSize -= this.metadata.entries[hash].size;
      delete this.metadata.entries[hash];
    }
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  
  // ============================================================================
  // Public Cache Management Infrastructure
  // ============================================================================
  
  async clear(): Promise<void> {
    try {
      const files = fs.readdirSync(this.cacheDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          fs.unlinkSync(path.join(this.cacheDir, file));
        }
      }
    } catch {
      // Ignore reading issues on missing paths
    }
    this.memoryCache.clear();
    this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  
  async getStats() {
    const entries = Object.values(this.metadata.entries);
    if (entries.length === 0) {
      return { entryCount: 0, totalSizeMB: 0, totalSizeBytes: 0, oldestEntry: 0, newestEntry: 0, hitRate: 0 };
    }
    const timestamps = entries.map(e => e.timestamp);
    return {
      entryCount: entries.length,
      totalSizeMB: this.metadata.totalSize / 1024 / 1024,
      totalSizeBytes: this.metadata.totalSize,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
      hitRate: this.memoryCache.size / entries.length
    };
  }
  
  async prune(): Promise<void> {
    await this.enforceSizeLimit();
  }
  
  // ============================================================================
  // Internal Private Operations
  // ============================================================================
  
  private isExpired(entry: PersistentCacheEntry): boolean {
    return (Date.now() - entry.timestamp) > (this.options.maxAgeDays * 24 * 60 * 60 * 1000);
  }
  
  private loadMetadata(): void {
    if (fs.existsSync(this.metadataPath)) {
      try {
        this.metadata = JSON.parse(fs.readFileSync(this.metadataPath, 'utf8'));
      } catch {
        this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
      }
    }
  }
  
  private commitMetadataEntry(hash: string, timestamp: number, size: number): void {
    if (this.metadata.entries[hash]) {
      this.metadata.totalSize -= this.metadata.entries[hash].size;
    }
    
    this.metadata.entries[hash] = { hash, size, timestamp };
    this.metadata.totalSize += size;
    this.metadata.lastCleanup = Date.now();
    
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  
  public async enforceSizeLimit(): Promise<void> {
    this.executeEvictionLoop();
  }
  
  private enforceSizeLimitSync(): void {
    this.executeEvictionLoop();
  }

  private executeEvictionLoop(): void {
    const limitBytes = this.options.maxSizeMB * 1024 * 1024;
    if (this.metadata.totalSize <= limitBytes) return;
    
    const sorted = Object.values(this.metadata.entries).sort((a, b) => a.timestamp - b.timestamp);
    let freed = 0;
    
    for (const entry of sorted) {
      if (this.metadata.totalSize - freed <= limitBytes) break;
      
      const cachePath = path.join(this.cacheDir, `${entry.hash}.json`);
      if (fs.existsSync(cachePath)) {
        freed += entry.size;
        fs.unlinkSync(cachePath);
        delete this.metadata.entries[entry.hash];
        this.memoryCache.delete(entry.hash);
      }
    }
    
    this.metadata.totalSize -= freed;
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  
  private ensureDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  async listEntries() {
    const entries = [];
    for (const [hash, meta] of Object.entries(this.metadata.entries)) {
      const raw = this.memoryCache.get(hash);
      entries.push({
        key: hash,
        size: meta.size,
        timestamp: meta.timestamp,
        createdAt: meta.timestamp,
        lastAccessed: raw ? raw.timestamp : undefined
      });
    }
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  async get(key: string): Promise<PersistentCacheEntry | null> {
    if (this.memoryCache.has(key)) return this.memoryCache.get(key)!;
    const cachePath = path.join(this.cacheDir, `${key}.json`);
    try {
      if (fs.existsSync(cachePath)) return JSON.parse(fs.readFileSync(cachePath, 'utf8'));
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
    return entry ? !this.isExpired(entry) : false;
  }
}