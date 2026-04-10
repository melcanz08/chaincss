/**
 * Internal types for the ChainCSS compiler
 * Not exported to users
 */
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
    enabled: boolean;
    threshold: number;
    naming: 'hash' | 'readable';
    cache: boolean;
    cachePath: string;
    minify: boolean;
    mode: 'standard' | 'atomic' | 'hybrid';
    outputStrategy: 'component-first' | 'utility-first';
    alwaysAtomic: string[];
    neverAtomic: string[];
    preserveSelectors: boolean;
    verbose: boolean;
    frameworkOutput?: {
        react: boolean;
        vue: boolean;
        vanilla: boolean;
    };
}
export interface PrefixerOptions {
    enabled: boolean;
    mode: 'auto' | 'full' | 'lightweight';
    browsers: string[];
    sourceMap: boolean;
    sourceMapInline: boolean;
}
export interface CacheData {
    version: string;
    timestamp: number;
    atomicClasses: [string, AtomicClass][];
    componentClassMap: [string, any][];
    stats: AtomicOptimizerStats;
    config: {
        threshold: number;
        naming: string;
        mode: string;
        outputStrategy: string;
    };
}
//# sourceMappingURL=types.d.ts.map