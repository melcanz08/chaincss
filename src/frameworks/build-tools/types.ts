// ============================================================================
// FILE: src/plugins/types.ts
// ============================================================================
export type Plugin = any;
import type { ChainCSSConfig } from "@shared/types/index.js";

export interface ChainCSSPluginOptions {
  /**
   * Enables or disables atomic utility class generation.
   * @default true
   */
  atomic?: boolean;

  /**
   * Enables verbose logging for compilation updates.
   * @default false
   */
  verbose?: boolean;

  /**
   * Silences all log outputs from the plugin.
   * @default false
   */
  silent?: boolean;

  /**
   * Generates extended pipeline transformation metrics.
   * @default false
   */
  pipelineReport?: boolean;

  /**
   * Minifies generated CSS output sheets.
   * @default false in dev, true in prod
   */
  minify?: boolean;

  /** Custom media query responsive breakpoints */
  breakpoints?: Record<string, string>;

  /** Direct token maps for variable substitution mapping */
  tokens?: ChainCSSConfig["tokens"];

  intents?: ChainCSSConfig["intents"];

  /** Explicit file inclusion paths */
  include?: string[];

  /** Explicit file exclusion paths */
  exclude?: string[];

  // Legacy / forward-compat flags to safeguard existing integrations
  prefix?: boolean;
  outputDir?: string;
  generateTypes?: boolean;
  hmr?: boolean;
  injectGlobal?: boolean;
  cssOutput?: string;
  manifestOutput?: string;
  sourceMap?: boolean;
  classPrefix?: string;
  timeline?: boolean;
  cache?: {
    enabled?: boolean;
    directory?: string;
    maxAge?: number;
  };
  atomicOptions?: {
    threshold?: number;
    naming?: "hash" | "readable";
    alwaysAtomic?: string[];
    neverAtomic?: string[];
  };
}

/**
 * Vite integration plugin for the ChainCSS high-performance zero-runtime engine.
 */
declare function chaincssPlugin(options?: ChainCSSPluginOptions): Plugin;

export { chaincssPlugin };
export default chaincssPlugin;
