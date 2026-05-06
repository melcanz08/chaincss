export interface AtomicClass {
    className: string;
    prop: string;
    value: any;
    usageCount: number;
    rules?: string;
    createdAt?: number;
    hash?: string;
}
export interface AtomicOptimizerStats {
    totalStyles: number;
    atomicStyles: number;
    standardStyles: number;
    uniqueProperties: number;
    savings: string;
    cacheHitRate?: number;
}
export interface AtomicOptimizerOptions {
    enabled?: boolean;
    threshold?: number;
    naming?: 'hash' | 'readable';
    cache?: boolean;
    cachePath?: string;
    minify?: boolean;
    mode?: 'standard' | 'atomic' | 'hybrid';
    outputStrategy?: 'component-first' | 'utility-first';
    alwaysAtomic?: string[];
    neverAtomic?: string[];
    frameworkOutput?: {
        react?: boolean;
        vue?: boolean;
        vanilla?: boolean;
    };
    preserveSelectors?: boolean;
    verbose?: boolean;
}
export interface ComponentClassMapEntry {
    atomicClasses: string[];
    hoverAtomicClasses: string[];
    selectors: string[];
    componentClassName?: string;
}
export interface OptimizeResult {
    css: string;
    map: Record<string, string>;
    stats: AtomicOptimizerStats;
    atomicCSS: string;
    componentCSS: string;
    componentMap?: Map<string, ComponentClassMapEntry>;
}
export declare class AtomicOptimizer {
    private config;
    options: Required<AtomicOptimizerOptions>;
    private usageCount;
    private atomicClasses;
    atomicMap: Record<string, string>;
    componentClassMap: Map<string, ComponentClassMapEntry>;
    stats: {
        totalStyles: number;
        atomicStyles: number;
        standardStyles: number;
        uniqueProperties: number;
        savings: number;
        cacheHits: number;
        cacheMisses: number;
    };
    constructor(config: any);
    componentMap: Map<string, ComponentClassMapEntry>;
    /**
     * Get usage count for a specific property-value pair
     */
    getUsageCount(prop: string, value: string, context?: string): number;
    /**
     * Increment usage count for a specific property-value pair
     */
    incrementUsageCount(prop: string, value: string, context?: string): void;
    /**
     * Get the usage count map for debugging
     */
    getUsageCountMap(): Map<string, number>;
    private loadCache;
    private saveCache;
    trackStyles(styles: any[]): void;
    process(styleChain: string): void;
    private processStyleObject;
    private generateClassName;
    private incrementUsage;
    private shouldBeAtomic;
    private getOrCreateAtomic;
    getKeyFromClassName(className: string): string | null;
    generateAtomicCSS(): string;
    generateComponentCSS(style: any, selectors: string[], context?: string): {
        css: string;
        atomicClasses: string[];
    };
    /**
     * Generate a clean component name without any prefixes
     */
    private getCleanComponentName;
    private generatePseudoCSS;
    optimize(styles: Record<string, any>): OptimizeResult;
    private processPseudoState;
    reset(): void;
    getStats(): AtomicOptimizerStats;
    getAtomicClass(prop: string, value: string, context?: string): string | null;
    getAllAtomicClasses(): AtomicClass[];
    clearCache(): void;
    getComponentMapEntry(name: string): ComponentClassMapEntry | undefined;
    getAtomicMap(): Record<string, string>;
}
export { AtomicOptimizer as default };
