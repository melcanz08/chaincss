// src/shared/config/index.ts
// Pure configuration types and defineConfig helper.
// No Node.js dependencies. Safe for browser and server.

// ============================================================================
// Configuration Types
// ============================================================================

export interface ChainCSSConfig {
  /** Glob patterns for .chain.ts files */
  inputs?: string[];

  /** Output configuration */
  output?: {
    /** Path for the combined CSS file */
    cssFile?: string;
    /** Minify CSS output */
    minify?: boolean;
    /** Generate a global CSS file */
    generateGlobalCSS?: boolean;
    /** Emission targets: css, atomic-css, tailwind, design-tokens, figma, graph-json */
    targets?: string[];
  };

  /** Atomic CSS extraction */
  atomic?: {
    /** Enable atomic CSS extraction */
    enabled?: boolean;
    /** Minimum usages before extracting to utility class */
    threshold?: number;
    /** Class naming strategy */
    naming?: 'hash' | 'readable';
    /** Extraction mode */
    mode?: 'standard' | 'hybrid' | 'atomic-only';
    /** Minify atomic class names */
    minify?: boolean;
    /** Log extraction statistics */
    verbose?: boolean;
  };

  /** Design tokens */
  tokens?: {
    /** Custom token values (merged with ChainCSS defaults) */
    tokens?: Record<string, any>;
    /** Token relationships for entanglement */
    relationships?: TokenRelationship[];
  };

  /** Token entanglement (alias for tokens.relationships) */
  entanglement?: {
    relationships?: TokenRelationship[];
  };

  /** Responsive breakpoints */
  breakpoints?: Record<string, string>;

  /** Vendor prefixing */
  prefixer?: {
    /** Enable prefixing */
    enabled?: boolean;
    /** Prefixing mode */
    mode?: 'auto' | 'full' | 'lightweight';
    /** Browserslist query (full mode only) */
    browsers?: string[];
    /** Add flexbox prefixes (full mode only) */
    flexbox?: boolean | 'no-2009';
    /** Add grid prefixes (full mode only) */
    grid?: 'autoplace' | 'no-autoplace' | false;
    /** Remove unnecessary prefixes */
    remove?: boolean;
    /** Add missing prefixes */
    add?: boolean;
    /** Generate source maps */
    sourceMap?: boolean;
    /** Inline source maps */
    sourceMapInline?: boolean;
    /** Log prefixing activity */
    verbose?: boolean;
  };

  /** Accessibility auditing */
  a11y?: {
    /** Manual contrast pairs for audit */
    pairs?: Array<{
      foreground: string;
      background: string;
      label?: string;
    }>;
  };

  /** Compilation cache */
  cache?: {
    /** Enable caching */
    enabled?: boolean;
    /** Max age for cache entries in days */
    maxAgeDays?: number;
    /** Max cache size in MB */
    maxSizeMB?: number;
    /** Cache directory path */
    path?: string;
  };

  /** Dev server */
  dev?: {
    /** Port number */
    port?: number;
    /** Public directory for static files */
    publicDir?: string;
  };

  /** Custom shorthands (CSS property aliases) */
  shorthands?: Record<string, string>;

  /** Custom macros */
  macros?: Record<string, MacroHandler>;

  /** Custom design intents */
  intents?: Record<string, IntentDefinition>;

  /** Preset configurations to merge before user config */
  presets?: Array<ChainCSSUserConfig | ((base: ChainCSSUserConfig) => ChainCSSUserConfig | Promise<ChainCSSUserConfig>)>;

  /** Allow overriding built-in macros/shorthands */
  allowOverride?: boolean;

  /** Custom plugins */
  plugins?: ChainCSSPlugin[];

  /** Framework detection override */
  framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'auto';

  /** Enable verbose logging */
  verbose?: boolean;

  /** Suppress all console output */
  silent?: boolean;

  /** Enable debug mode */
  debug?: boolean;

  /** Record compilation timeline for snapshots */
  timeline?: boolean;

  /** Add source file comments in CSS output */
  sourceComments?: boolean;

  /** Enable watch mode */
  watch?: boolean;

  /** Enable HMR */
  hmr?: boolean;

  /** Class name prefix */
  namespace?: string;
}

export type ChainCSSUserConfig = ChainCSSConfig;

// ============================================================================
// Token Relationship Types
// ============================================================================

export type DerivedMethod =
  | `mix-white ${number}%`
  | `mix-black ${number}%`
  | `lighten ${number}`
  | `darken ${number}`
  | `alpha ${number}`
  | `tint ${number}%`
  | `shade ${number}%`
  | `saturate ${number}`
  | `desaturate ${number}`;

export interface DerivedRelationship {
  type: 'derived';
  source: string;
  target: string;
  method: DerivedMethod;
}

export interface ContrastRelationship {
  type: 'contrast';
  foreground: string;
  background: string | string[];
  target?: number;
  autoFix?: 'auto' | 'darken' | 'lighten';
  priority?: number;
}

export interface HarmonyRelationship {
  type: 'harmony';
  source: string;
  targets: string[];
  rule: 'complementary' | 'analogous' | 'triadic' | 'same-lightness';
}

export type TokenRelationship = DerivedRelationship | ContrastRelationship | HarmonyRelationship;

// ============================================================================
// Extension Types
// ============================================================================

export type MacroHandler = (value: any, catcher: Record<string, any>, useTokens: boolean) => void;

export interface IntentDefinition {
  name?: string;
  category?: 'layout' | 'component' | 'semantic' | 'interaction' | string;
  description?: string;
  semantics?: Array<{ category: string; intent: string }>;
  properties?: Record<string, string | number>;
  states?: Record<string, Record<string, string | number>>;
  responsive?: Record<string, Record<string, string | number>>;
  a11y?: string[];
}

export interface ChainCSSPlugin {
  name: string;
  setup?: (compiler: any) => void;
  transform?: (code: string, id: string) => string | null;
  transformCSS?: (css: string, filePath: string) => string;
}

// ============================================================================
// defineConfig Helper
// ============================================================================

/**
 * Type-safe config helper. Provides autocompletion and validation.
 * Pure identity function — safe for browser and Node.js.
 */
export function defineConfig<T extends ChainCSSUserConfig>(config: T): T {
  return config;
}

export default defineConfig;