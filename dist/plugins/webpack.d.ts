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
}
interface LoaderContext {
    async: () => (err: Error | null, code?: string) => void;
    getOptions: () => ChainCSSLoaderOptions;
    resourcePath: string;
    context: string;
}
/**
 * Webpack loader for ChainCSS
 * Converts .chain.js / .chain.ts files to static CSS at build time
 */
export default function chaincssLoader(this: LoaderContext, source: string): void;
export {};
//# sourceMappingURL=webpack.d.ts.map