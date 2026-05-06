import { Plugin } from 'vite';
export interface ChainCSSPluginOptions {
    atomic?: boolean;
    minify?: boolean;
    verbose?: boolean;
    hmr?: boolean;
    injectGlobal?: boolean;
    cssOutput?: string;
    manifestOutput?: string;
    include?: string[];
    exclude?: string[];
}
export default function chaincssPlugin(options?: ChainCSSPluginOptions): Plugin;
