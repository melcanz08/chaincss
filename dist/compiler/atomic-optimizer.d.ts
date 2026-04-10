export interface AtomicClass {
    className: string;
    prop: string;
    value: string;
    usageCount: number;
}
export interface AtomicOptimizerStats {
    totalStyles: number;
    atomicStyles: number;
    standardStyles: number;
    uniqueProperties: number;
    savings: string;
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
    options: Required<AtomicOptimizerOptions>;
    usageCount: Map<string, number>;
    atomicClasses: Map<string, AtomicClass>;
    componentClassMap: Map<string, ComponentClassMapEntry>;
    stats: {
        totalStyles: number;
        atomicStyles: number;
        standardStyles: number;
        uniqueProperties: number;
        savings: number;
    };
    constructor(options?: AtomicOptimizerOptions);
    private loadCache;
    private saveCache;
    private trackStyles;
    private incrementUsage;
    private shouldBeAtomic;
    private generateClassName;
    private getOrCreateAtomic;
    private getKeyFromClassName;
    private generateAtomicCSS;
    private generateComponentCSS;
    optimize(stylesInput: any[] | Record<string, any>): OptimizeResult;
    getStats(): AtomicOptimizerStats;
    getAtomicClass(prop: string, value: string): string | null;
    getAllAtomicClasses(): AtomicClass[];
    clearCache(): void;
}
export { AtomicOptimizer as default };
//# sourceMappingURL=atomic-optimizer.d.ts.map