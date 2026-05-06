export interface ChainCSSLoaderOptions {
    /**
     * Mode: 'build' for production (zero-runtime), 'runtime' for development
     * @default process.env.NODE_ENV === 'production' ? 'build' : 'runtime'
     */
    mode?: 'build' | 'runtime';
    /**
     * Enable atomic CSS optimization
     * @default false
     */
    atomic?: boolean;
    /**
     * Enable CSS minification
     * @default process.env.NODE_ENV === 'production'
     */
    minify?: boolean;
    /**
     * Enable source maps
     * @default false
     */
    sourceMap?: boolean;
    /**
     * Output directory for compiled CSS
     * @default '.chaincss-cache'
     */
    outputDir?: string;
    /**
     * Verbose logging
     * @default false
     */
    verbose?: boolean;
    /**
     * Enable CSS extraction to separate file
     * @default false
     */
    extractCSS?: boolean;
    /**
     * Enable Hot Module Replacement
     * @default true in development
     */
    hmr?: boolean;
    /**
     * Custom cache key for compilation
     */
    cacheKey?: string;
    /**
     * Framework to generate components for
     * @default 'auto'
     */
    framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'auto';
}
interface LoaderContext {
    async: () => (err: Error | null, code?: string) => void;
    getOptions: () => ChainCSSLoaderOptions;
    resourcePath: string;
    context: string;
    cacheable: (flag: boolean) => void;
    addDependency: (file: string) => void;
    emitFile: (name: string, content: string, sourceMap?: any) => void;
    emitWarning: (warning: Error) => void;
    emitError: (error: Error) => void;
}
/**
 * Webpack loader for ChainCSS
 * Converts .chain.js / .chain.ts files to static CSS at build time
 */
export default function chaincssLoader(this: LoaderContext, source: string): void;
export {};
