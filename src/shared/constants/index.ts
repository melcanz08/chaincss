// src/shared/constants/index.ts

// Keeps 100% original values to avoid cache bust & CSS snapshot changes
// Only adds Set + non-global regex fix

import type { ChainCSSConfig } from "../types/index.js";
import { defaultTokens } from "../../compiler/tokens/tokens.js";

declare const __CHAINCSS_VERSION__: string;
export const VERSION: string =
  typeof __CHAINCSS_VERSION__ !== "undefined" ? __CHAINCSS_VERSION__ : "0.0.0";

const isNode = typeof process !== "undefined" && process.env;
const isProd = isNode && process.env.NODE_ENV === "production";

export const NEVER_ATOMIC_PROPERTIES = [
  "content",
  "animation",
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-delay",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "animation-play-state",
  "transition",
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
  "keyframes",
  "counter-increment",
  "counter-reset",
  "counter-set",
  "list-style",
  "list-style-type",
  "list-style-position",
  "list-style-image",
  "will-change",
  "backface-visibility",
  "perspective",
  "transform-style",
  "mix-blend-mode",
  "isolation",
  "contain",
  "content-visibility",
  "clip-path",
  "mask",
  "filter",
  "backdrop-filter",
] as const;
export const NEVER_ATOMIC_SET = new Set<string>(
  NEVER_ATOMIC_PROPERTIES as readonly string[],
);

export const ALWAYS_ATOMIC_PROPERTIES = [
  "position",
  "display",
  "width",
  "height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "color",
  "background-color",
  "background",
  "border",
  "border-radius",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "font-size",
  "font-weight",
  "text-align",
  "cursor",
  "opacity",
  "z-index",
  "overflow",
  "flex",
  "grid",
  "gap",
] as const;
export const ALWAYS_ATOMIC_SET = new Set<string>(
  ALWAYS_ATOMIC_PROPERTIES as readonly string[],
);

export const DEFAULT_BROWSERS = [
  "> 0.5%",
  "last 2 versions",
  "not dead",
  "Firefox ESR",
  "not ie < 11",
] as const;
export const SUPPORTED_EXTENSIONS = [
  ".chain.js",
  ".chain.ts",
  ".chain.jsx",
  ".chain.tsx",
] as const; // added jsx/tsx
export const DEFAULT_CSS_FILENAME = "styles.css";
export const DEFAULT_CLASS_MAP_FILENAME = "class-map.json";
export const DEFAULT_TYPES_FILENAME = "classes.d.ts";
export const DEFAULT_CACHE_PATH = "./.chaincss-cache";
export const CACHE_VERSION = "2.8.13"; // KEEP old to avoid bust — change only on major cache format change

export const DEFAULT_ATOMIC_THRESHOLD = 2;
export const MIN_ATOMIC_THRESHOLD = 2;
export const MAX_ATOMIC_THRESHOLD = 10;

export const NAMING_SCHEMES = ["hash", "readable"] as const;
export type NamingScheme = (typeof NAMING_SCHEMES)[number];
export const ATOMIC_MODES = ["standard", "atomic", "hybrid"] as const;
export type AtomicMode = (typeof ATOMIC_MODES)[number];
export const OUTPUT_STRATEGIES = ["component-first", "utility-first"] as const;
export type OutputStrategy = (typeof OUTPUT_STRATEGIES)[number];
export const PREFIXER_MODES = ["auto", "full", "lightweight"] as const;
export type PrefixerMode = (typeof PREFIXER_MODES)[number];

export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  INVALID_ARGS: 2,
  FILE_NOT_FOUND: 3,
  COMPILE_ERROR: 4,
} as const;
export const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  SUCCESS: 2,
  WARN: 3,
  ERROR: 4,
  SILENT: 5,
} as const;

// FIX: split /g versions to avoid lastIndex bug on .test()
export const PATTERNS = {
  CSS_PROPERTY: /^[a-z][a-z-]*$/,
  SELECTOR: /^[.#][a-zA-Z][a-zA-Z0-9_-]*$/,
  MEDIA_QUERY: /^@media\s+/,
  KEYFRAMES: /^@keyframes\s+/,
  TOKEN_REFERENCE: /\$([a-zA-Z0-9.-]+)/,
  TOKEN_REFERENCE_G: /\$([a-zA-Z0-9.-]+)/g,
  HOVER_STATE: /:hover$/,
  PSEUDO_CLASS: /:[a-z-]+(\([^)]+\))?$/,
  CSS_VARIABLE: /^--[a-zA-Z0-9_-]+$/,
  SHORTHAND_PROPERTY:
    /^(m|p|b|bg|d|pos|w|h|max-w|max-h|min-w|min-h|rounded|border|flex|grid|gap|inset)$/,
  URL_REFERENCE: /url\(['"]?([^'"()]+)['"]?\)/,
  URL_REFERENCE_G: /url\(['"]?([^'"()]+)['"]?\)/g,
  IMPORT_STATEMENT: /@import\s+['"]([^'"]+)['"]/,
  IMPORT_STATEMENT_G: /@import\s+['"]([^'"]+)['"]/g,
  FONT_FACE: /@font-face\s*\{/,
  FONT_FACE_G: /@font-face\s*\{/g,
  STYLE_OBJECT: /(?:chain|\$)\(({[\s\S]*?})\)/,
  CHAIN_METHOD: /\.([a-zA-Z]+)\(([^)]*)\)/,
  HEX_COLOR: /^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/,
  RGB_COLOR:
    /^rgba?\(\s*\d+%?\s*[\s,]\s*\d+%?\s*[\s,]\s*\d+%?(?:\s*[\s,/]\s*[\d.]+%?)?\s*\)$/i,
  RGBA_COLOR:
    /^rgba?\(\s*\d+%?\s*[\s,]\s*\d+%?\s*[\s,]\s*\d+%?(?:\s*[\s,/]\s*[\d.]+%?)?\s*\)$/i,
  HSL_COLOR:
    /^hsla?\(\s*\d+(?:deg|rad|turn)?\s*[\s,]\s*\d+%\s*[\s,]\s*\d+%(?:\s*[\s,/]\s*[\d.]+%?)?\s*\)$/i,
};

export const ERROR_MESSAGES = {
  FILE_NOT_FOUND: (file: string) => `File not found: ${file}`,
  INVALID_CONFIG: (error: string) => `Invalid configuration: ${error}`,
  COMPILE_FAILED: (file: string, error: string) =>
    `Failed to compile ${file}: ${error}`,
  INVALID_SELECTOR: (selector: string) => `Invalid selector: ${selector}`,
  INVALID_PROPERTY: (prop: string) => `Invalid CSS property: ${prop}`,
  NO_INPUT_FILES: "No input files found matching the patterns",
  WATCH_FAILED: (error: string) => `Failed to start watch mode: ${error}`,
};
export const SUCCESS_MESSAGES = {
  COMPILE_SUCCESS: (count: number, time: number) =>
    `Compiled ${count} file(s) in ${time}ms`,
  INIT_SUCCESS: (configPath: string) =>
    `Initialized ChainCSS config at ${configPath}`,
  WATCH_STARTED: "Watching for changes... (press Ctrl+C to stop)",
};

export const DEFAULT_BREAKPOINTS = {
  sm: `(min-width: ${defaultTokens.breakpoints.sm})`,
  md: `(min-width: ${defaultTokens.breakpoints.md})`,
  lg: `(min-width: ${defaultTokens.breakpoints.lg})`,
  xl: `(min-width: ${defaultTokens.breakpoints.xl})`,
  "2xl": `(min-width: ${defaultTokens.breakpoints["2xl"]})`,
  mobile: `(max-width: ${defaultTokens.breakpoints.md})`,
  tablet: `(min-width: ${defaultTokens.breakpoints.md}) and (max-width: ${defaultTokens.breakpoints.lg})`,
  desktop: `(min-width: ${defaultTokens.breakpoints.lg})`,
} as const;

export const PERFORMANCE = {
  MAX_CONCURRENT_COMPILATIONS: 16, // was 10, now matches your 16-concurrency compiler
  COMPILATION_BATCH_SIZE: 20,
  CACHE_PRUNE_INTERVAL_MS: 3600000,
  CACHE_MAX_ENTRIES: 1000,
  MAX_MEMORY_USAGE_MB: 512,
  GC_THRESHOLD_MB: 400,
  COMPILE_TIMEOUT: 30000,
  FILE_WATCH_TIMEOUT: 5000,
  DEBOUNCE_WRITE_MS: 100,
  THROTTLE_COMPILE_MS: 50,
} as const;

export const FRAMEWORK_CONFIGS = {
  react: {
    extension: ".jsx",
    componentTemplate: "React.FC",
    importReact: true,
    cssInJs: false,
  },
  vue: {
    extension: ".vue",
    componentTemplate: "defineComponent",
    importReact: false,
    cssInJs: true,
  },
  svelte: {
    extension: ".svelte",
    componentTemplate: "script",
    importReact: false,
    cssInJs: true,
  },
  solid: {
    extension: ".jsx",
    componentTemplate: "Component",
    importReact: false,
    cssInJs: false,
  },
  angular: {
    extension: ".ts",
    componentTemplate: "Component",
    importReact: false,
    cssInJs: true,
  },
} as const;
export type Framework = keyof typeof FRAMEWORK_CONFIGS;

export const ENVIRONMENT_PRESETS = {
  development: {
    atomic: {
      naming: "readable" as NamingScheme,
      minify: false,
      verbose: false,
      cache: true,
    },
    output: { minify: false, sourceComments: true },
    debug: true,
    timeline: true,
    sourceComments: true,
    verbose: false,
  },
  production: {
    atomic: {
      naming: "hash" as NamingScheme,
      minify: true,
      verbose: false,
      cache: true,
    },
    output: { minify: true, sourceComments: false },
    debug: false,
    timeline: false,
    sourceComments: false,
    verbose: false,
  },
  test: {
    atomic: {
      naming: "readable" as NamingScheme,
      minify: false,
      verbose: false,
      cache: false,
    },
    output: { minify: false, sourceComments: true },
    debug: true,
    timeline: true,
    sourceComments: true,
    verbose: false,
  },
} as const;

export const VALIDATION = {
  MAX_SELECTOR_LENGTH: 100,
  MAX_STYLE_RULES: 10000,
  MAX_NESTING_DEPTH: 10,
  CLASS_NAME: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 50,
    PATTERN: /^[a-zA-Z][a-zA-Z0-9_-]*$/,
    RESERVED: ["chain", "css", "style", "global", "atomic"],
  },
  PROPERTY_VALUE: {
    MAX_LENGTH: 5000,
    ALLOWED_UNITS: [
      "px",
      "cm",
      "mm",
      "in",
      "pt",
      "pc",
      "rem",
      "em",
      "ex",
      "ch",
      "lh",
      "rlh",
      "%",
      "vw",
      "vh",
      "vmin",
      "vmax",
      "dvw",
      "dvh",
      "svw",
      "svh",
      "lvw",
      "lvh",
      "cqw",
      "cqh",
      "cqi",
      "cqb",
      "cqmin",
      "cqmax",
      "fr",
      "deg",
      "rad",
      "grad",
      "turn",
      "ms",
      "s",
      "dpi",
      "dpcm",
      "dppx",
      "x",
    ],
  },
  BREAKPOINT: {
    MIN_VALUE: 0,
    MAX_VALUE: 10000,
    ALLOWED_UNITS: ["px", "rem", "em", "vw"],
  },
} as const;

export const MEMORY = {
  CACHE_PRUNE_SIZE: 100 * 1024 * 1024,
  MAX_STRING_BUFFER: 10 * 1024 * 1024,
  WRITE_BATCH_SIZE: 100,
  CLEANUP_INTERVAL_MS: 300000,
  CACHE_CHECK_INTERVAL_MS: 60000,
  MEMORY_CHECK_INTERVAL_MS: 30000,
} as const;

export const DEFAULT_CONFIG: ChainCSSConfig = {
  inputs: ["src/**/*.chain.{js,ts}", "src/**/*.tsx"],
  tokens: {
    tokens: {},
    relationships: [],
  },
  atomic: {
    enabled: true,
    threshold: 2,
    naming: isProd ? "hash" : "readable",
    minify: true,
    mode: "hybrid",
    verbose: false,
  },
  prefixer: {
    enabled: true,
    mode: "lightweight",
    browsers: ["> 0.5%", "last 2 versions", "not dead"],
    sourceMap: true,
    sourceMapInline: false,
    remove: true,
    add: true,
  },
  output: {
    cssFile: "styles.css",
    minify: true,
    generateGlobalCSS: true,
  },
  cache: {
    enabled: true,
    maxAgeDays: 30,
    maxSizeMB: 500,
    path: ".chaincss-cache",
  },
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
  },
  debug: false,
  sourceComments: true,
  timeline: false,
  framework: "auto",
  namespace: "chain",
  verbose: false,
};
export const RUNTIME = {
  STYLE_ID_PREFIX: "chaincss-runtime",
  CLASS_NAME_PREFIX: "c",
  HASH_LENGTH: 6,
  MAX_CACHE_SIZE: 100,
  INJECTION_DELAY: 16,
} as const;
export const DEV = {
  HOT_RELOAD_PORT: 3000,
  DEBOUNCE_DELAY: 100,
  LOG_PREFIX: "[ChainCSS]",
} as const;
export const PROD = {
  COMPRESSION_LEVEL: 6,
  SOURCE_MAP_COMMENT: "/*# sourceMappingURL=styles.css.map */",
} as const;

export function isNamingScheme(v: unknown): v is NamingScheme {
  return typeof v === "string" && (NAMING_SCHEMES as any).includes(v);
}
export function isAtomicMode(v: unknown): v is AtomicMode {
  return typeof v === "string" && (ATOMIC_MODES as any).includes(v);
}
export function isOutputStrategy(v: unknown): v is OutputStrategy {
  return typeof v === "string" && (OUTPUT_STRATEGIES as any).includes(v);
}
export function isPrefixerMode(v: unknown): v is PrefixerMode {
  return typeof v === "string" && (PREFIXER_MODES as any).includes(v);
}
export function isFramework(v: unknown): v is Framework {
  return typeof v === "string" && v in FRAMEWORK_CONFIGS;
}
