import type { ChainCSSConfig, CompileResult, StyleDefinition } from './types.js';
export declare class ChainCSSCompiler {
    private config;
    private atomicOptimizer;
    private prefixer;
    private styleCache;
    private classMap;
    constructor(config?: ChainCSSConfig);
    private initOptimizer;
    private initPrefixer;
    private generateCSS;
    compileStyle(styleId: string, styleDef: StyleDefinition): CompileResult;
    compileRecipe(recipeId: string, recipeFn: any): CompileResult;
    compileFile(filePath: string): Record<string, CompileResult>;
    generateTypeScriptTypes(results: Record<string, CompileResult>, outputPath: string): void;
    generateJavaScriptModule(results: Record<string, CompileResult>, outputPath: string): void;
    generateCSSFile(results: Record<string, CompileResult>, outputPath: string): void;
    compile(inputFile: string, outputDir: string): Promise<{
        cssFile: string;
        jsFile: string;
        typesFile: string;
        results: Record<string, CompileResult>;
    }>;
    compileComponents(components: string[]): Promise<void>;
    private importModule;
    private hash;
    watch(inputFile: string, outputDir: string): Promise<void>;
    getStats(): any;
    clearCache(): void;
}
export declare function compileChainCSS(inputFile: string, outputDir: string, config?: ChainCSSConfig): Promise<ReturnType<ChainCSSCompiler['compile']>>;
//# sourceMappingURL=compiler.d.ts.map