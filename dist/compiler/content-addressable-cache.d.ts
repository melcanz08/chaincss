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
export declare class PersistentCache {
    private cacheDir;
    private options;
    private memoryCache;
    private metadataPath;
    private metadata;
    constructor(options?: PersistentCacheOptions);
    private hash;
    private hashFile;
    getByContent(source: string): Promise<any | null>;
    getByFile(filePath: string): Promise<any | null>;
    getByHash(hash: string): Promise<any | null>;
    setByContent(source: string, result: any, dependencies?: string[]): Promise<string>;
    setByFile(filePath: string, result: any, dependencies?: string[]): Promise<string>;
    setByHash(hash: string, result: any, dependencies?: string[]): Promise<string>;
    getByHashSync(hash: string): any | null;
    setByHashSync(hash: string, result: any, source: any, dependencies?: string[]): void;
    invalidateByHash(hash: string): void;
    clear(): Promise<void>;
    getStats(): Promise<{
        entryCount: number;
        totalSizeMB: number;
        totalSizeBytes: number;
        oldestEntry: number;
        newestEntry: number;
        hitRate?: number;
    }>;
    prune(): Promise<void>;
    private isExpired;
    private loadMetadata;
    private updateMetadata;
    private updateMetadataSync;
    enforceSizeLimit(): Promise<void>;
    private enforceSizeLimitSync;
    private ensureDir;
    /**
     * List all cache entries
     */
    listEntries(): Promise<Array<{
        key: string;
        size: number;
        timestamp: number;
        createdAt: number;
        lastAccessed?: number;
    }>>;
    /**
     * Get a cache entry by key
     */
    get(key: string): Promise<PersistentCacheEntry | null>;
    /**
     * Delete a cache entry by key
     */
    delete(key: string): Promise<boolean>;
    /**
     * Validate a cache entry
     */
    validate(key: string): Promise<boolean>;
}
