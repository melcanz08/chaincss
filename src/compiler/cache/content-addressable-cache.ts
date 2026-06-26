// chaincss/src/compiler/content-addressable-cache.ts

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface PersistentCacheEntry {
  hash: string;
  result: any;
  dependencies: Record<string, string>;
  timestamp: number;
  version: string;
  compilerVersion: string;
  // Add these missing properties
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
    // Initialize metadataPath AFTER cacheDir is set
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
  
  private hashFile(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return this.hash(content);
  }
  
  // ============================================================================
  // Async Methods (Original)
  // ============================================================================
  
  async getByContent(source: string): Promise<any | null> {
    if (!this.options.enabled) return null;
    const hash = this.hash(source);
    return this.getByHash(hash);
  }
  
  async getByFile(filePath: string): Promise<any | null> {
    if (!this.options.enabled) return null;
    if (!fs.existsSync(filePath)) return null;
    const source = fs.readFileSync(filePath, 'utf8');
    return this.getByContent(source);
  }
  
  async getByHash(hash: string): Promise<any | null> {
    if (!this.options.enabled) return null;
    
    if (this.memoryCache.has(hash)) {
      const entry = this.memoryCache.get(hash)!;
      if (!this.isExpired(entry)) {
        if (this.options.verbose) {
          console.log(`[persistent-cache] Memory HIT for hash ${hash.slice(0, 8)}`);
        }
        return entry.result;
      } else {
        this.memoryCache.delete(hash);
      }
    }
    
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (fs.existsSync(cachePath)) {
      try {
        const entry: PersistentCacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        
        if (!this.isExpired(entry)) {
          this.memoryCache.set(hash, entry);
          if (this.options.verbose) {
            console.log(`[persistent-cache] Disk HIT for hash ${hash.slice(0, 8)}`);
          }
          return entry.result;
        } else {
          fs.unlinkSync(cachePath);
          if (this.options.verbose) {
            console.log(`[persistent-cache] Expired entry removed: ${hash.slice(0, 8)}`);
          }
        }
      } catch (err) {
        // Ignore
      }
    }
    
    return null;
  }
  
  async setByContent(source: string, result: any, dependencies: string[] = []): Promise<string> {
    if (!this.options.enabled) return '';
    const hash = this.hash(source);
    return this.setByHash(hash, result, dependencies);
  }
  
  async setByFile(filePath: string, result: any, dependencies: string[] = []): Promise<string> {
    if (!this.options.enabled) return '';
    if (!fs.existsSync(filePath)) return '';
    const source = fs.readFileSync(filePath, 'utf8');
    return this.setByContent(source, result, dependencies);
  }
  
  async setByHash(hash: string, result: any, dependencies: string[] = []): Promise<string> {
    if (!this.options.enabled) return hash;
    
    const depHashes: Record<string, string> = {};
    for (const dep of dependencies) {
      const depHash = this.hashFile(dep);
      if (depHash) {
        depHashes[dep] = depHash;
      }
    }
    
    const entry: PersistentCacheEntry = {
      hash,
      result,
      dependencies: depHashes,
      timestamp: Date.now(),
      version: '2.0.0',
      compilerVersion: '2.0.7'
    };
    
    this.memoryCache.set(hash, entry);
    
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
    
    await this.updateMetadata(hash, entry);
    await this.enforceSizeLimit();
    
    if (this.options.verbose) {
      console.log(`[persistent-cache] Stored hash ${hash.slice(0, 8)} (${dependencies.length} deps)`);
    }
    
    return hash;
  }
  
  // ============================================================================
  // SYNC Methods (Added for compiler.ts compatibility)
  // ============================================================================
  
  getByHashSync(hash: string): any | null {
    if (!this.options.enabled) return null;
    
    if (this.memoryCache.has(hash)) {
      const entry = this.memoryCache.get(hash)!;
      if (!this.isExpired(entry)) {
        return entry.result;
      } else {
        this.memoryCache.delete(hash);
      }
    }
    
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (fs.existsSync(cachePath)) {
      try {
        const entry: PersistentCacheEntry = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
        if (!this.isExpired(entry)) {
          this.memoryCache.set(hash, entry);
          return entry.result;
        } else {
          fs.unlinkSync(cachePath);
        }
      } catch (err) {
        // Ignore
      }
    }
    
    return null;
  }
  
  setByHashSync(hash: string, result: any, source: any, dependencies: string[] = []): void {
    if (!this.options.enabled) return;
    
    const depHashes: Record<string, string> = {};
    for (const dep of dependencies) {
      if (typeof dep === 'string' && fs.existsSync(dep)) {
        const depSource = fs.readFileSync(dep, 'utf8');
        depHashes[dep] = this.hash(depSource);
      }
    }
    
    const entry: PersistentCacheEntry = {
      hash,
      result,
      dependencies: depHashes,
      timestamp: Date.now(),
      version: '2.0.0',
      compilerVersion: '2.0.7'
    };
    
    this.memoryCache.set(hash, entry);
    
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    fs.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
    
    this.updateMetadataSync(hash, entry);
    this.enforceSizeLimitSync();
    
    if (this.options.verbose) {
      console.log(`[persistent-cache] Stored hash ${hash.slice(0, 8)} (${dependencies.length} deps)`);
    }
  }
  
  invalidateByHash(hash: string): void {
    this.memoryCache.delete(hash);
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    if (fs.existsSync(cachePath)) {
      fs.unlinkSync(cachePath);
    }
    delete this.metadata.entries[hash];
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  
  // ============================================================================
  // Public Management Methods
  // ============================================================================
  
  async clear(): Promise<void> {
    const files = fs.readdirSync(this.cacheDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(this.cacheDir, file));
      }
    }
    this.memoryCache.clear();
    this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
    
    if (this.options.verbose) {
      console.log('[persistent-cache] Cache cleared');
    }
  }
  
  async getStats(): Promise<{
    entryCount: number;
    totalSizeMB: number;
    totalSizeBytes: number;
    oldestEntry: number;
    newestEntry: number;
    hitRate?: number;
  }> {
    const entries = Object.values(this.metadata.entries);
    if (entries.length === 0) {
      return { 
        entryCount: 0, 
        totalSizeMB: 0, 
        totalSizeBytes: 0,
        oldestEntry: 0, 
        newestEntry: 0,
        hitRate: 0
      };
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
    if (this.options.verbose) {
      console.log('[persistent-cache] Prune completed');
    }
  }
  
  // ============================================================================
  // Private Methods
  // ============================================================================
  
  private isExpired(entry: PersistentCacheEntry): boolean {
    const age = Date.now() - entry.timestamp;
    const maxAge = this.options.maxAgeDays * 24 * 60 * 60 * 1000;
    return age > maxAge;
  }
  
  private loadMetadata(): void {
    if (fs.existsSync(this.metadataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.metadataPath, 'utf8'));
        this.metadata = data;
      } catch (err) {
        this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
      }
    }
  }
  
  private async updateMetadata(hash: string, entry: PersistentCacheEntry): Promise<void> {
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    const stats = fs.statSync(cachePath);
    
    this.metadata.entries[hash] = {
      hash,
      size: stats.size,
      timestamp: entry.timestamp
    };
    this.metadata.totalSize += stats.size;
    this.metadata.lastCleanup = Date.now();
    
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  
  private updateMetadataSync(hash: string, entry: PersistentCacheEntry): void {
    const cachePath = path.join(this.cacheDir, `${hash}.json`);
    const stats = fs.statSync(cachePath);
    
    this.metadata.entries[hash] = {
      hash,
      size: stats.size,
      timestamp: entry.timestamp
    };
    this.metadata.totalSize += stats.size;
    this.metadata.lastCleanup = Date.now();
    
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  
  public async enforceSizeLimit(): Promise<void> {
    const limitBytes = this.options.maxSizeMB * 1024 * 1024;
    
    if (this.metadata.totalSize <= limitBytes) {
      return;
    }
    
    if (this.options.verbose) {
      console.log(`[persistent-cache] Cache size (${(this.metadata.totalSize / 1024 / 1024).toFixed(2)}MB) exceeds limit (${this.options.maxSizeMB}MB). Cleaning...`);
    }
    
    const entries = Object.values(this.metadata.entries)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    let freedSpace = 0;
    for (const entry of entries) {
      if (this.metadata.totalSize - freedSpace <= limitBytes) break;
      
      const cachePath = path.join(this.cacheDir, `${entry.hash}.json`);
      if (fs.existsSync(cachePath)) {
        freedSpace += entry.size;
        fs.unlinkSync(cachePath);
        delete this.metadata.entries[entry.hash];
        this.memoryCache.delete(entry.hash);
      }
    }
    
    this.metadata.totalSize -= freedSpace;
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
    
    if (this.options.verbose) {
      console.log(`[persistent-cache] Cleaned ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
    }
  }
  
  private enforceSizeLimitSync(): void {
    const limitBytes = this.options.maxSizeMB * 1024 * 1024;
    
    if (this.metadata.totalSize <= limitBytes) {
      return;
    }
    
    const entries = Object.values(this.metadata.entries)
      .sort((a, b) => a.timestamp - b.timestamp);
    
    let freedSpace = 0;
    for (const entry of entries) {
      if (this.metadata.totalSize - freedSpace <= limitBytes) break;
      
      const cachePath = path.join(this.cacheDir, `${entry.hash}.json`);
      if (fs.existsSync(cachePath)) {
        freedSpace += entry.size;
        fs.unlinkSync(cachePath);
        delete this.metadata.entries[entry.hash];
        this.memoryCache.delete(entry.hash);
      }
    }
    
    this.metadata.totalSize -= freedSpace;
    fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  
  private ensureDir(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * List all cache entries
   */
  async listEntries(): Promise<Array<{ key: string; size: number; timestamp: number; createdAt: number; lastAccessed?: number }>> {
    const entries: Array<{ key: string; size: number; timestamp: number; createdAt: number; lastAccessed?: number }> = [];
    
    for (const [hash, metadata] of Object.entries(this.metadata.entries)) {
      const entry = this.memoryCache.get(hash) || await this.getByHash(hash);
      entries.push({
        key: hash,
        size: metadata.size,
        timestamp: metadata.timestamp,
        createdAt: metadata.timestamp,
        lastAccessed: entry?.timestamp
      });
    }
    
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get a cache entry by key
   */
  async get(key: string): Promise<PersistentCacheEntry | null> {
    return this.getByHash(key);
  }

  /**
   * Delete a cache entry by key
   */
  async delete(key: string): Promise<boolean> {
    try {
      this.invalidateByHash(key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Validate a cache entry
   */
  async validate(key: string): Promise<boolean> {
    const entry = await this.getByHash(key);
    if (!entry) return false;
    return !this.isExpired(entry);
  }


}