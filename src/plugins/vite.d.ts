// chaincss/src/plugins/vite.d.ts
import { Plugin } from 'vite';

/**
 * ChainCSS Vite Plugin Options
 */
export interface ChainCSSPluginOptions {
  /**
   * Enable atomic CSS optimization
   * @default true
   */
  atomic?: boolean;
  
  /**
   * Enable vendor prefixing
   * @default true
   */
  prefix?: boolean;
  
  /**
   * Output directory for generated CSS
   * @default 'public'
   */
  outputDir?: string;
  
  /**
   * Generate TypeScript type definitions
   * @default false
   */
  generateTypes?: boolean;
  
  /**
   * Minify CSS output
   * @default false in development, true in production
   */
  minify?: boolean;
  
  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;
  
  /**
   * Enable Hot Module Replacement
   * @default true
   */
  hmr?: boolean;
  
  /**
   * Inject global CSS automatically
   * @default true
   */
  injectGlobal?: boolean;
  
  /**
   * Output file for CSS (relative to outputDir)
   * @default 'global.css'
   */
  cssOutput?: string;
  
  /**
   * Output file for manifest (relative to outputDir)
   * @default 'chaincss-manifest.json'
   */
  manifestOutput?: string;
  
  /**
   * File patterns to include
   * @default ['**\/*.chain.{js,ts}', '**\/*.tsx', '**\/*.jsx']
   */
  include?: string[];
  
  /**
   * File patterns to exclude
   * @default ['node_modules/**', '**\/*.test.{js,ts}']
   */
  exclude?: string[];
  
  /**
   * Enable source maps
   * @default false
   */
  sourceMap?: boolean;
  
  /**
   * Custom CSS class name prefix
   * @default 'chain'
   */
  classPrefix?: string;
  
  /**
   * Enable style timeline tracking
   * @default false
   */
  timeline?: boolean;
  
  /**
   * Cache configuration
   */
  cache?: {
    /**
     * Enable caching
     * @default true
     */
    enabled?: boolean;
    
    /**
     * Cache directory
     * @default './.chaincss-cache'
     */
    directory?: string;
    
    /**
     * Max cache age in days
     * @default 30
     */
    maxAge?: number;
  };
  
  /**
   * Atomic CSS optimization options
   */
  atomicOptions?: {
    /**
     * Minimum usage threshold for atomic extraction
     * @default 2
     */
    threshold?: number;
    
    /**
     * Class naming strategy
     * @default 'hash'
     */
    naming?: 'hash' | 'readable';
    
    /**
     * CSS properties that should always be atomic
     */
    alwaysAtomic?: string[];
    
    /**
     * CSS properties that should never be atomic
     */
    neverAtomic?: string[];
  };
  
  /**
   * Design tokens configuration
   */
  tokens?: {
    /**
     * Enable design tokens
     * @default true
     */
    enabled?: boolean;
    
    /**
     * Token prefix
     * @default 'chain'
     */
    prefix?: string;
    
    /**
     * Custom token values
     */
    values?: Record<string, any>;
  };
  
  /**
   * Breakpoints configuration
   */
  breakpoints?: Record<string, string>;
}

/**
 * ChainCSS Vite Plugin
 * 
 * Automatically handles .chain.ts files and injects styles into your entry point.
 * Supports atomic CSS optimization, design tokens, and HMR.
 * 
 * @example
 * ```ts
 * // vite.config.ts
 * import chaincss from 'chaincss/plugins/vite';
 * 
 * export default {
 *   plugins: [
 *     chaincss({
 *       atomic: true,
 *       verbose: true,
 *       breakpoints: {
 *         mobile: '(max-width: 768px)',
 *         desktop: '(min-width: 1024px)'
 *       }
 *     })
 *   ]
 * };
 * ```
 * 
 * @example
 * ```ts
 * // Minimal configuration
 * import chaincss from 'chaincss/plugins/vite';
 * 
 * export default {
 *   plugins: [chaincss()]
 * };
 * ```
 */
declare function chaincssPlugin(options?: ChainCSSPluginOptions): Plugin;

// Default export
export default chaincssPlugin;

// Named export for direct import
export { chaincssPlugin };

// Re-export the Plugin type from Vite for convenience
export type { Plugin } from 'vite';

// Additional helper types for better IDE support
export namespace ChainCSS {
  /**
   * Injected CSS runtime interface
   */
  interface Runtime {
    /**
     * Set the atomic class manifest
     */
    setManifest(manifest: Record<string, any>): void;
    
    /**
     * Get an atomic class name by property-value pair
     */
    getAtomicClass(prop: string, value: string): string | null;
    
    /**
     * Get all atomic classes
     */
    getAllAtomicClasses(): Array<{ className: string; prop: string; value: string }>;
    
    /**
     * Update CSS dynamically
     */
    updateCSS(css: string): void;
  }
  
  /**
   * Style definition for chain() API
   */
  interface StyleDefinition {
    selectors: string[];
    [key: string]: any;
  }
  
  /**
   * Component style options
   */
  interface ComponentOptions {
    /**
     * Component name
     */
    name?: string;
    
    /**
     * Framework to generate component for
     */
    framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'auto';
    
    /**
     * Props definition for the component
     */
    props?: Record<string, any>;
  }
}

// Global augmentation for Vite's import.meta
declare module 'vite' {
  interface ImportMeta {
    /**
     * ChainCSS HMR API
     */
    hot?: {
      /**
       * Accept ChainCSS HMR updates
       */
      accept(): void;
      
      /**
       * Listen to ChainCSS HMR events
       */
      on(event: 'chaincss:update', callback: (data: { css: string; map: Record<string, any> }) => void): void;
      
      /**
       * Send ChainCSS HMR events
       */
      send(event: 'chaincss:update', data: any): void;
    };
  }
}

// Global augmentation for window object
declare global {
  interface Window {
    /**
     * ChainCSS runtime instance
     */
    __CHAINCSS__?: ChainCSS.Runtime;
  }
}

// Export all types
export type {
  Plugin as VitePlugin
};