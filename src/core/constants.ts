// chaincss/src/core/constants.ts
/**
 * ChainCSS Constants
 * Shared constants used across the codebase
 */

import type { ChainCSSConfig } from './types.js';

// Version
export const VERSION = '2.0.0';

// Default CSS properties that should never be atomic
export const NEVER_ATOMIC_PROPERTIES = [
  'content',
  'animation',
  'animation-name',
  'animation-duration',
  'animation-timing-function',
  'animation-delay',
  'animation-iteration-count',
  'animation-direction',
  'animation-fill-mode',
  'animation-play-state',
  'transition',
  'transition-property',
  'transition-duration',
  'transition-timing-function',
  'transition-delay',
  'keyframes',
  'counter-increment',
  'counter-reset',
  'counter-set',
  'list-style',
  'list-style-type',
  'list-style-position',
  'list-style-image',
  // Critical properties that should never be atomic
  'will-change',
  'backface-visibility',
  'perspective',
  'transform-style',
  'mix-blend-mode',
  'isolation',
  'contain',
  'content-visibility',
  'clip-path',
  'mask',
  'filter',
  'display',
  'backdrop-filter',
  'display',
  'width',
  'margin-left',
];

// Default CSS properties that should always be atomic (high reuse)
export const ALWAYS_ATOMIC_PROPERTIES = [
  'position',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'color',
  'background-color',
  'background',
  'border',
  'border-radius',
  'height',
  'max-width',
  'max-height',
  'min-width',
  'min-height',
  'font-size',
  'font-weight',
  'text-align',
  'cursor',
  'opacity',
  'z-index',
  'overflow',
  'flex',
  'grid',
  'gap'
];

// Default browsers for autoprefixer
export const DEFAULT_BROWSERS = [
  '> 0.5%',
  'last 2 versions',
  'not dead',
  'Firefox ESR',
  'not ie < 11'
];

// File extensions to process
export const SUPPORTED_EXTENSIONS = ['.chain.js', '.chain.ts'];

// Output file names
export const DEFAULT_CSS_FILENAME = 'styles.css';
export const DEFAULT_CLASS_MAP_FILENAME = 'class-map.json';
export const DEFAULT_TYPES_FILENAME = 'classes.d.ts';

// Cache configuration
export const DEFAULT_CACHE_PATH = './.chaincss-cache';
export const CACHE_VERSION = '2.0.0';

// Atomic optimizer thresholds
export const DEFAULT_ATOMIC_THRESHOLD = 2;
export const MIN_ATOMIC_THRESHOLD = 2;
export const MAX_ATOMIC_THRESHOLD = 10;

// Class name naming schemes
export const NAMING_SCHEMES = ['hash', 'readable'] as const;
export type NamingScheme = typeof NAMING_SCHEMES[number];

// Atomic optimizer modes
export const ATOMIC_MODES = ['standard', 'atomic', 'hybrid'] as const;
export type AtomicMode = typeof ATOMIC_MODES[number];

// Output strategies
export const OUTPUT_STRATEGIES = ['component-first', 'utility-first'] as const;
export type OutputStrategy = typeof OUTPUT_STRATEGIES[number];

// Prefixer modes
export const PREFIXER_MODES = ['auto', 'full', 'lightweight'] as const;
export type PrefixerMode = typeof PREFIXER_MODES[number];

// CLI exit codes
export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
  FILE_NOT_FOUND: 3,
  COMPILE_ERROR: 4
} as const;

// Log levels
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5
} as const;

// Regex patterns
export const PATTERNS = {
  CSS_PROPERTY: /^[a-z][a-z-]*$/,
  SELECTOR: /^[.#][a-zA-Z][a-zA-Z0-9_-]*$/,
  MEDIA_QUERY: /^@media\s+/,
  KEYFRAMES: /^@keyframes\s+/,
  TOKEN_REFERENCE: /\$([a-zA-Z0-9.-]+)/g,
  HOVER_STATE: /:hover$/,
  PSEUDO_CLASS: /:[a-z-]+(\([^)]+\))?$/,
  CSS_VARIABLE: /^--[a-zA-Z][a-zA-Z0-9-]*$/,
  SHORTHAND_PROPERTY: /^(m|p|b|bg|d|pos|w|h|max-w|max-h|min-w|min-h|rounded|border|flex|grid|gap|inset)$/,
  URL_REFERENCE: /url\(['"]?([^'"()]+)['"]?\)/g,
  IMPORT_STATEMENT: /@import\s+['"]([^'"]+)['"]/g,
  FONT_FACE: /@font-face\s*\{/g,
  STYLE_OBJECT: /(?:chain|\$)\(({[\s\S]*?})\)/g,
  CHAIN_METHOD: /\.([a-zA-Z]+)\(([^)]*)\)/g,
  HEX_COLOR: /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  RGB_COLOR: /^rgb\((\d{1,3},\s*\d{1,3},\s*\d{1,3})\)$/,
  RGBA_COLOR: /^rgba\((\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*(0|1|0?\.\d+))\)$/,
  HSL_COLOR: /^hsl\((\d{1,3},\s*\d{1,3}%,\s*\d{1,3}%)\)$/
};

// Error messages
export const ERROR_MESSAGES = {
  FILE_NOT_FOUND: (file: string) => `File not found: ${file}`,
  INVALID_CONFIG: (error: string) => `Invalid configuration: ${error}`,
  COMPILE_FAILED: (file: string, error: string) => `Failed to compile ${file}: ${error}`,
  INVALID_SELECTOR: (selector: string) => `Invalid selector: ${selector}`,
  INVALID_PROPERTY: (prop: string) => `Invalid CSS property: ${prop}`,
  NO_INPUT_FILES: 'No input files found matching the patterns',
  WATCH_FAILED: (error: string) => `Failed to start watch mode: ${error}`
};

// Success messages
export const SUCCESS_MESSAGES = {
  COMPILE_SUCCESS: (count: number, time: number) => `Compiled ${count} file(s) in ${time}ms`,
  INIT_SUCCESS: (configPath: string) => `Initialized ChainCSS config at ${configPath}`,
  WATCH_STARTED: 'Watching for changes... (press Ctrl+C to stop)'
};

// Default responsive breakpoints
export const DEFAULT_BREAKPOINTS = {
  sm: '(max-width: 640px)',
  md: '(min-width: 641px) and (max-width: 768px)',
  lg: '(min-width: 769px) and (max-width: 1024px)',
  xl: '(min-width: 1025px)',
  '2xl': '(min-width: 1280px)',
  mobile: '(max-width: 768px)',
  tablet: '(min-width: 769px) and (max-width: 1024px)',
  desktop: '(min-width: 1025px)',
};

// Performance optimization constants
export const PERFORMANCE = {
  MAX_CONCURRENT_COMPILATIONS: 10,
  BATCH_SIZE: 20,
  CACHE_PRUNE_INTERVAL_MS: 3600000, // 1 hour
  CACHE_MAX_ENTRIES: 1000,
  MAX_MEMORY_USAGE_MB: 512,
  GC_THRESHOLD_MB: 400,
  COMPILE_TIMEOUT: 30000,
  FILE_WATCH_TIMEOUT: 5000,
  DEBOUNCE_WRITE_MS: 100,
  THROTTLE_COMPILE_MS: 50
} as const;

// Framework-specific configurations
export const FRAMEWORK_CONFIGS = {
  react: {
    extension: '.jsx',
    componentTemplate: 'React.FC',
    importReact: true,
    cssInJs: false
  },
  vue: {
    extension: '.vue',
    componentTemplate: 'defineComponent',
    importReact: false,
    cssInJs: true
  },
  svelte: {
    extension: '.svelte',
    componentTemplate: 'script',
    importReact: false,
    cssInJs: true
  },
  solid: {
    extension: '.jsx',
    componentTemplate: 'Component',
    importReact: false,
    cssInJs: false
  },
  angular: {
    extension: '.ts',
    componentTemplate: 'Component',
    importReact: false,
    cssInJs: true
  }
} as const;

export type Framework = keyof typeof FRAMEWORK_CONFIGS;

// Environment presets
export const ENVIRONMENT_PRESETS = {
  development: {
    atomic: {
      naming: 'readable' as NamingScheme,
      minify: false,
      verbose: false,
      cache: true
    },
    output: {
      minify: false,
      sourceComments: true
    },
    debug: true,
    timeline: true,
    sourceComments: true,
    verbose: false
  },
  production: {
    atomic: {
      naming: 'hash' as NamingScheme,
      minify: true,
      verbose: false,
      cache: true
    },
    output: {
      minify: true,
      sourceComments: false
    },
    debug: false,
    timeline: false,
    sourceComments: false,
    verbose: false
  },
  test: {
    atomic: {
      naming: 'readable' as NamingScheme,
      minify: false,
      verbose: false,
      cache: false
    },
    output: {
      minify: false,
      sourceComments: true
    },
    debug: true,
    timeline: true,
    sourceComments: true,
    verbose: false
  }
} as const;

// Validation rules
export const VALIDATION = {
  MAX_SELECTOR_LENGTH: 100,
  MAX_STYLE_RULES: 10000,
  MAX_NESTING_DEPTH: 10,
  CLASS_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
    RESERVED: ['chain', 'css', 'style', 'global', 'atomic']
  },
  PROPERTY_VALUE: {
    MAX_LENGTH: 5000,
    ALLOWED_UNITS: ['px', 'rem', 'em', '%', 'vw', 'vh', 'deg', 'rad', 'ms', 's']
  },
  BREAKPOINT: {
    MIN_VALUE: 0,
    MAX_VALUE: 10000,
    ALLOWED_UNITS: ['px', 'rem', 'em', 'vw']
  }
} as const;

// Memory management
export const MEMORY = {
  CACHE_PRUNE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_STRING_BUFFER: 10 * 1024 * 1024, // 10MB
  BATCH_SIZE: 100,
  CLEANUP_INTERVAL_MS: 300000, // 5 minutes
  CACHE_CHECK_INTERVAL_MS: 60000, // 1 minute
  MEMORY_CHECK_INTERVAL_MS: 30000 // 30 seconds
} as const;

// Default config values
export const DEFAULT_CONFIG: ChainCSSConfig = {
  inputs: ['src/**/*.chain.{js,ts}', 'src/**/*.tsx'],
  tokens: {
    enabled: true,
    prefix: 'chain'
  },
  atomic: {
    enabled: true,           
    threshold: 2,
    naming: (process.env.NODE_ENV === 'production' ? 'hash' : 'readable') as NamingScheme,      
    cache: true,
    cachePath: DEFAULT_CACHE_PATH,
    minify: true,            
    mode: 'hybrid' as AtomicMode,
    outputStrategy: 'component-first' as OutputStrategy,
    alwaysAtomic: ALWAYS_ATOMIC_PROPERTIES,
    neverAtomic: NEVER_ATOMIC_PROPERTIES,
    verbose: false           
  },
  prefixer: {
    enabled: true,           
    mode: 'auto' as PrefixerMode,
    browsers: DEFAULT_BROWSERS,
    sourceMap: true,
    sourceMapInline: false
  },
  output: {
    cssFile: DEFAULT_CSS_FILENAME,
    classMapFile: DEFAULT_CLASS_MAP_FILENAME,
    typesFile: DEFAULT_TYPES_FILENAME,
    minify: true,
    generateGlobalCSS: true   
  },
  cachePath: DEFAULT_CACHE_PATH,
  cacheEnabled: true,
  persistentCachePath: './.chaincss/persistent-cache',
  cacheMaxAgeDays: 30,
  cacheMaxSizeMB: 500,
  debug: false,
  sourceComments: true,
  timeline: false,
  framework: 'auto',
  namespace: 'chain',
  verbose: false
};

// Runtime constants
export const RUNTIME = {
  STYLE_ID_PREFIX: 'chaincss-runtime',
  CLASS_NAME_PREFIX: 'c',
  HASH_LENGTH: 6,
  MAX_CACHE_SIZE: 100,
  INJECTION_DELAY: 16 // ~1 frame at 60fps
};

// Development-only constants
export const DEV = {
  HOT_RELOAD_PORT: 3000,
  DEBOUNCE_DELAY: 100,
  LOG_PREFIX: '[ChainCSS]'
};

// Production constants
export const PROD = {
  COMPRESSION_LEVEL: 6,
  SOURCE_MAP_COMMENT: '/*# sourceMappingURL=styles.css.map */'
};

// Type guard functions
export function isNamingScheme(value: unknown): value is NamingScheme {
  return typeof value === 'string' && NAMING_SCHEMES.includes(value as any);
}

export function isAtomicMode(value: unknown): value is AtomicMode {
  return typeof value === 'string' && ATOMIC_MODES.includes(value as any);
}

export function isOutputStrategy(value: unknown): value is OutputStrategy {
  return typeof value === 'string' && OUTPUT_STRATEGIES.includes(value as any);
}

export function isPrefixerMode(value: unknown): value is PrefixerMode {
  return typeof value === 'string' && PREFIXER_MODES.includes(value as any);
}

export function isFramework(value: unknown): value is Framework {
  return typeof value === 'string' && value in FRAMEWORK_CONFIGS;
}