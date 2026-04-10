export interface CacheData {
    version: string;
    created: string;
    atomic: Record<string, any>;
    usage: Record<string, any>;
    [key: string]: any;
}
export declare class CacheManager {
    cachePath: string;
    cacheDir: string;
    cache: CacheData | Record<string, any>;
    constructor(cachePath?: string);
    load(): void;
    get(key: string): any;
    set(key: string, value: any): void;
    save(): void;
    clear(): void;
}
export { CacheManager as default };
//# sourceMappingURL=cache-manager.d.ts.map