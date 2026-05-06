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
    maxAge?: number;
    maxSize?: number;
    compress?: boolean;
    autoSave?: boolean;
    saveInterval?: number;
}
export declare class CacheManager {
    cachePath: string;
    cacheDir: string;
    cache: CacheData | Record<string, any>;
    private dirty;
    private saveTimer;
    private stats;
    private options;
    constructor(cachePath?: string, options?: CacheOptions);
    private startAutoSave;
    private stopAutoSave;
    load(): void;
    private getDefaultCache;
    private isExpired;
    private checkAndPrune;
    private isCompressed;
    private compress;
    private decompress;
    get(key: string): any;
    set(key: string, value: any, ttl?: number): void;
    has(key: string): boolean;
    delete(key: string): boolean;
    clear(): void;
    prune(): void;
    save(): void;
    getStats(): {
        hits: number;
        misses: number;
        reads: number;
        writes: number;
        hitRate: number;
        size: number;
        entryCount: number;
    };
    getCacheSize(): number;
    getCacheAge(): number;
    getKeys(): string[];
    getSize(): number;
    isDirty(): boolean;
    flush(): Promise<void>;
    destroy(): void;
    getEntry(key: string): {
        value: any;
        cachedAt: number;
        expires?: number;
    } | undefined;
    setWithTTL(key: string, value: any, ttlSeconds: number): void;
    setBulk(entries: Record<string, any>): void;
    getBulk(keys: string[]): Record<string, any>;
    getOrCompute<T>(key: string, compute: () => Promise<T>, ttl?: number): Promise<T>;
}
export { CacheManager as default };
