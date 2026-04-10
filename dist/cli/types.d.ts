export interface CLIOptions {
    input?: string;
    output?: string;
    watch?: boolean;
    atomic?: boolean;
    minify?: boolean;
    prefix?: boolean;
    sourceMap?: boolean;
    verbose?: boolean;
    config?: string;
    help?: boolean;
    version?: boolean;
}
export interface CompileOptions {
    input: string;
    output: string;
    watch?: boolean;
    atomic?: boolean;
    minify?: boolean;
    prefix?: boolean;
    sourceMap?: boolean;
    verbose?: boolean;
}
export interface BuildOptions {
    config?: string;
    watch?: boolean;
    verbose?: boolean;
}
export interface ChainCSSConfig {
    inputs?: string[];
    output?: string;
    tokens?: {
        enabled?: boolean;
        prefix?: string;
    };
    atomic?: {
        enabled?: boolean;
        threshold?: number;
        naming?: 'hash' | 'readable';
        minify?: boolean;
        mode?: 'standard' | 'atomic' | 'hybrid';
        verbose?: boolean;
    };
    prefixer?: {
        enabled?: boolean;
        browsers?: string[];
    };
    watch?: boolean;
    verbose?: boolean;
}
//# sourceMappingURL=types.d.ts.map