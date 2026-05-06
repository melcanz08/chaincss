import type { ChainCSSConfig, CompileResult, StyleDefinition } from './types.js';
import { AtomicOptimizer } from '../compiler/atomic-optimizer.js';
export declare class ChainCSSCompiler {
    private config;
    private prefixer;
    atomicOptimizer: AtomicOptimizer | null;
    private sharedStyles;
    private styleCache;
    private classMap;
    private runtimeCache;
    private persistentCache;
    private readonly MAX_STYLE_CACHE_SIZE;
    private importedModules;
    private dependencyGraph;
    private generatedCSS;
    private accumulatedCSS;
    private compileInProgress;
    private compileQueue;
    private lruList;
    constructor(config: ChainCSSConfig);
    hasStyles(): boolean;
    private processStyleObject;
    private addToCache;
    /**
     * Scans a raw source string (from Vite) for useChainStyles patterns
     * and registers them with the optimizer.
     * Uses brace-counting parser instead of fragile regex.
     */
    compileSource(source: string, id: string): Promise<void>;
    /**
     * Safely parse a style object string without using eval.
     * Supports JSON-like syntax and token references.
     */
    private safeParseStyleObject;
    /**
     * Parse a limited subset of JavaScript object literal syntax.
     * Handles: strings, numbers, booleans, null, nested objects, arrays.
     * Does NOT execute code.
     */
    private parseObjectLiteral;
    private restoreTokens;
    /**
     * @deprecated Use safeParseStyleObject instead.
     * Kept for backward compatibility during migration.
     */
    private looseParse;
    private setupCompilerGlobals;
    private hashStyleDef;
    private importModule;
    compileStyle(styleId: string, styleDef: StyleDefinition): CompileResult;
    compileRecipe(recipeId: string, recipeValue: any): CompileResult;
    compile(inputFile: string, outputDir: string): Promise<any>;
    compileFile(filePath: string): Promise<Record<string, CompileResult>>;
    compileComponents(components: string[]): Promise<void>;
    /**
     * Drains the compile queue safely, handling items added during draining.
     */
    private drainCompileQueue;
    getCombinedCSS(): string;
    clearCSS(): void;
    getStats(): {
        totalStyles: number;
        atomicStyles: any;
        uniqueProperties: any;
        savings: string;
    };
    private generateCSSFile;
    getAtomicMap(): Record<string, string>;
    private initOptimizer;
    private initPrefixer;
}
export declare function compileChainCSS(inputFile: string, outputDir: string, config?: ChainCSSConfig): Promise<any>;
