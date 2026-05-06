// chaincss/src/plugins/webpack.d.ts

import { LoaderDefinition } from 'webpack';

/**
 * ChainCSS Webpack Loader Options
 */
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
  
  /**
   * Generate TypeScript type definitions
   * @default false
   */
  generateTypes?: boolean;
  
  /**
   * Enable design tokens
   * @default true
   */
  tokens?: boolean;
  
  /**
   * Custom breakpoint definitions
   */
  breakpoints?: Record<string, string>;
  
  /**
   * CSS class name prefix
   * @default 'chain'
   */
  classPrefix?: string;
  
  /**
   * Enable style timeline tracking
   * @default false
   */
  timeline?: boolean;
}

/**
 * ChainCSS Webpack Loader
 * 
 * A webpack loader that processes ChainCSS files (.chain.js/.chain.ts)
 * and converts them to static CSS at build time.
 * 
 * @example
 * ```js
 * // webpack.config.js
 * module.exports = {
 *   module: {
 *     rules: [
 *       {
 *         test: /\.chain\.(js|ts)$/,
 *         use: [
 *           'babel-loader',
 *           {
 *             loader: 'chaincss/plugin/webpack',
 *             options: {
 *               mode: process.env.NODE_ENV === 'production' ? 'build' : 'runtime',
 *               atomic: true,
 *               minify: process.env.NODE_ENV === 'production',
 *               verbose: process.env.NODE_ENV === 'development'
 *             }
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * };
 * ```
 * 
 * @example
 * ```js
 * // With custom output directory
 * {
 *   loader: 'chaincss/plugin/webpack',
 *   options: {
 *     outputDir: 'dist/styles',
 *     extractCSS: true,
 *     framework: 'react'
 *   }
 * }
 * ```
 */
declare const loader: LoaderDefinition<ChainCSSLoaderOptions>;

// Default export
export default loader;

// Named export for direct import
export { loader as chaincssLoader };

// Re-export LoaderDefinition for convenience
export type { LoaderDefinition } from 'webpack';

/**
 * ChainCSS Runtime API for webpack
 */
export namespace ChainCSSWebpack {
  /**
   * Generated styles interface
   */
  interface Styles {
    [key: string]: string;
  }
  
  /**
   * CSS extraction plugin options
   */
  interface ExtractCSSPluginOptions {
    /**
     * Output filename for extracted CSS
     * @default '[name].css'
     */
    filename?: string;
    
    /**
     * Enable chunk CSS extraction
     * @default true
     */
    chunkFilename?: string;
    
    /**
     * Enable source maps
     * @default false
     */
    sourceMap?: boolean;
    
    /**
     * Ignore order warnings
     * @default false
     */
    ignoreOrder?: boolean;
  }
  
  /**
   * ChainCSS Webpack Plugin (for full builds)
   */
  interface ChainCSSWebpackPlugin {
    /**
     * Apply the plugin to webpack compiler
     */
    apply(compiler: any): void;
  }
  
  /**
   * Create a ChainCSS webpack plugin
   */
  function createPlugin(options?: {
    /**
     * Enable atomic CSS
     * @default true
     */
    atomic?: boolean;
    
    /**
     * Output directory for CSS files
     * @default 'dist/css'
     */
    outputDir?: string;
    
    /**
     * Enable CSS minification
     * @default process.env.NODE_ENV === 'production'
     */
    minify?: boolean;
    
    /**
     * Generate TypeScript types
     * @default false
     */
    generateTypes?: boolean;
  }): ChainCSSWebpackPlugin;
}

// Augment webpack module types
declare module 'webpack' {
  interface Configuration {
    /**
     * ChainCSS specific configuration
     */
    chaincss?: {
      /**
       * Enable ChainCSS processing
       */
      enabled?: boolean;
      
      /**
       * ChainCSS loader options
       */
      loaderOptions?: ChainCSSLoaderOptions;
      
      /**
       * Files to include
       */
      include?: RegExp | RegExp[];
      
      /**
       * Files to exclude
       */
      exclude?: RegExp | RegExp[];
    };
  }
  
  interface LoaderContext {
    /**
     * ChainCSS specific properties
     */
    chaincss?: {
      /**
       * Whether the file has been processed
       */
      processed: boolean;
      
      /**
       * Compiled CSS content
       */
      css?: string;
      
      /**
       * Compiled class map
       */
      classMap?: Record<string, string>;
    };
  }
}

// Export all types
export type {
  LoaderDefinition as WebpackLoaderDefinition
};