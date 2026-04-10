// chaincss/src/core/constants.ts

/**
 * ChainCSS Constants
 * Shared constants used across the codebase
 */

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
  'list-style-image'
];

// Default CSS properties that should always be atomic (high reuse)
export const ALWAYS_ATOMIC_PROPERTIES = [
  'display',
  'position',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
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
  'width',
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
export const SUPPORTED_EXTENSIONS = ['.chain.js', '.chain.ts', '.jcss'];

// Output file names
export const DEFAULT_CSS_FILENAME = 'styles.css';
export const DEFAULT_CLASS_MAP_FILENAME = 'class-map.json';
export const DEFAULT_TYPES_FILENAME = 'classes.d.ts';

// Cache configuration
export const DEFAULT_CACHE_PATH = './.chaincss-cache';
export const CACHE_VERSION = '2.0.0';

// Atomic optimizer thresholds
export const DEFAULT_ATOMIC_THRESHOLD = 3;
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
  PSEUDO_CLASS: /:[a-z-]+(\([^)]+\))?$/
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

// Default config values
export const DEFAULT_CONFIG = {
  tokens: {
    enabled: false,
    prefix: 'chain'
  },
  atomic: {
    enabled: true,           
    threshold: 3,
    naming: process.env.NODE_ENV === 'production' ? 'hash' : 'readable',      
    cache: true,
    cachePath: DEFAULT_CACHE_PATH,
    minify: true,            
    mode: 'hybrid',
    outputStrategy: 'component-first',
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
  // New: Debug & Timeline (all false by default)
  debug: false,               // ← Off by default
  sourceComments: true,       // ← On by default (helps debugging)
  timeline: false,            // ← Off by default
  framework: 'auto' as const, // ← Auto-detect framework
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