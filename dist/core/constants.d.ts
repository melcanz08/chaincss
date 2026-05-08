/**
 * ChainCSS Constants
 * Shared constants used across the codebase
 */
import type { ChainCSSConfig } from './types.js';
export declare const VERSION = "2.0.0";
export declare const NEVER_ATOMIC_PROPERTIES: string[];
export declare const ALWAYS_ATOMIC_PROPERTIES: string[];
export declare const DEFAULT_BROWSERS: string[];
export declare const SUPPORTED_EXTENSIONS: string[];
export declare const DEFAULT_CSS_FILENAME = "styles.css";
export declare const DEFAULT_CLASS_MAP_FILENAME = "class-map.json";
export declare const DEFAULT_TYPES_FILENAME = "classes.d.ts";
export declare const DEFAULT_CACHE_PATH = "./.chaincss-cache";
export declare const CACHE_VERSION = "2.0.0";
export declare const DEFAULT_ATOMIC_THRESHOLD = 2;
export declare const MIN_ATOMIC_THRESHOLD = 2;
export declare const MAX_ATOMIC_THRESHOLD = 10;
export declare const NAMING_SCHEMES: readonly ["hash", "readable"];
export type NamingScheme = typeof NAMING_SCHEMES[number];
export declare const ATOMIC_MODES: readonly ["standard", "atomic", "hybrid"];
export type AtomicMode = typeof ATOMIC_MODES[number];
export declare const OUTPUT_STRATEGIES: readonly ["component-first", "utility-first"];
export type OutputStrategy = typeof OUTPUT_STRATEGIES[number];
export declare const PREFIXER_MODES: readonly ["auto", "full", "lightweight"];
export type PrefixerMode = typeof PREFIXER_MODES[number];
export declare const EXIT_CODES: {
    readonly SUCCESS: 0;
    readonly ERROR: 1;
    readonly INVALID_ARGS: 2;
    readonly FILE_NOT_FOUND: 3;
    readonly COMPILE_ERROR: 4;
};
export declare const LOG_LEVELS: {
    readonly DEBUG: 0;
    readonly INFO: 1;
    readonly SUCCESS: 2;
    readonly WARN: 3;
    readonly ERROR: 4;
    readonly SILENT: 5;
};
export declare const PATTERNS: {
    CSS_PROPERTY: RegExp;
    SELECTOR: RegExp;
    MEDIA_QUERY: RegExp;
    KEYFRAMES: RegExp;
    TOKEN_REFERENCE: RegExp;
    HOVER_STATE: RegExp;
    PSEUDO_CLASS: RegExp;
    CSS_VARIABLE: RegExp;
    SHORTHAND_PROPERTY: RegExp;
    URL_REFERENCE: RegExp;
    IMPORT_STATEMENT: RegExp;
    FONT_FACE: RegExp;
    STYLE_OBJECT: RegExp;
    CHAIN_METHOD: RegExp;
    HEX_COLOR: RegExp;
    RGB_COLOR: RegExp;
    RGBA_COLOR: RegExp;
    HSL_COLOR: RegExp;
};
export declare const ERROR_MESSAGES: {
    FILE_NOT_FOUND: (file: string) => string;
    INVALID_CONFIG: (error: string) => string;
    COMPILE_FAILED: (file: string, error: string) => string;
    INVALID_SELECTOR: (selector: string) => string;
    INVALID_PROPERTY: (prop: string) => string;
    NO_INPUT_FILES: string;
    WATCH_FAILED: (error: string) => string;
};
export declare const SUCCESS_MESSAGES: {
    COMPILE_SUCCESS: (count: number, time: number) => string;
    INIT_SUCCESS: (configPath: string) => string;
    WATCH_STARTED: string;
};
export declare const DEFAULT_BREAKPOINTS: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
    '2xl': string;
    mobile: string;
    tablet: string;
    desktop: string;
};
export declare const PERFORMANCE: {
    readonly MAX_CONCURRENT_COMPILATIONS: 10;
    readonly BATCH_SIZE: 20;
    readonly CACHE_PRUNE_INTERVAL_MS: 3600000;
    readonly CACHE_MAX_ENTRIES: 1000;
    readonly MAX_MEMORY_USAGE_MB: 512;
    readonly GC_THRESHOLD_MB: 400;
    readonly COMPILE_TIMEOUT: 30000;
    readonly FILE_WATCH_TIMEOUT: 5000;
    readonly DEBOUNCE_WRITE_MS: 100;
    readonly THROTTLE_COMPILE_MS: 50;
};
export declare const FRAMEWORK_CONFIGS: {
    readonly react: {
        readonly extension: ".jsx";
        readonly componentTemplate: "React.FC";
        readonly importReact: true;
        readonly cssInJs: false;
    };
    readonly vue: {
        readonly extension: ".vue";
        readonly componentTemplate: "defineComponent";
        readonly importReact: false;
        readonly cssInJs: true;
    };
    readonly svelte: {
        readonly extension: ".svelte";
        readonly componentTemplate: "script";
        readonly importReact: false;
        readonly cssInJs: true;
    };
    readonly solid: {
        readonly extension: ".jsx";
        readonly componentTemplate: "Component";
        readonly importReact: false;
        readonly cssInJs: false;
    };
    readonly angular: {
        readonly extension: ".ts";
        readonly componentTemplate: "Component";
        readonly importReact: false;
        readonly cssInJs: true;
    };
};
export type Framework = keyof typeof FRAMEWORK_CONFIGS;
export declare const ENVIRONMENT_PRESETS: {
    readonly development: {
        readonly atomic: {
            readonly naming: NamingScheme;
            readonly minify: false;
            readonly verbose: false;
            readonly cache: true;
        };
        readonly output: {
            readonly minify: false;
            readonly sourceComments: true;
        };
        readonly debug: true;
        readonly timeline: true;
        readonly sourceComments: true;
        readonly verbose: false;
    };
    readonly production: {
        readonly atomic: {
            readonly naming: NamingScheme;
            readonly minify: true;
            readonly verbose: false;
            readonly cache: true;
        };
        readonly output: {
            readonly minify: true;
            readonly sourceComments: false;
        };
        readonly debug: false;
        readonly timeline: false;
        readonly sourceComments: false;
        readonly verbose: false;
    };
    readonly test: {
        readonly atomic: {
            readonly naming: NamingScheme;
            readonly minify: false;
            readonly verbose: false;
            readonly cache: false;
        };
        readonly output: {
            readonly minify: false;
            readonly sourceComments: true;
        };
        readonly debug: true;
        readonly timeline: true;
        readonly sourceComments: true;
        readonly verbose: false;
    };
};
export declare const VALIDATION: {
    readonly MAX_SELECTOR_LENGTH: 100;
    readonly MAX_STYLE_RULES: 10000;
    readonly MAX_NESTING_DEPTH: 10;
    readonly CLASS_NAME: {
        readonly MIN_LENGTH: 1;
        readonly MAX_LENGTH: 50;
        readonly PATTERN: RegExp;
        readonly RESERVED: readonly ["chain", "css", "style", "global", "atomic"];
    };
    readonly PROPERTY_VALUE: {
        readonly MAX_LENGTH: 5000;
        readonly ALLOWED_UNITS: readonly ["px", "rem", "em", "%", "vw", "vh", "deg", "rad", "ms", "s"];
    };
    readonly BREAKPOINT: {
        readonly MIN_VALUE: 0;
        readonly MAX_VALUE: 10000;
        readonly ALLOWED_UNITS: readonly ["px", "rem", "em", "vw"];
    };
};
export declare const MEMORY: {
    readonly CACHE_PRUNE_SIZE: number;
    readonly MAX_STRING_BUFFER: number;
    readonly BATCH_SIZE: 100;
    readonly CLEANUP_INTERVAL_MS: 300000;
    readonly CACHE_CHECK_INTERVAL_MS: 60000;
    readonly MEMORY_CHECK_INTERVAL_MS: 30000;
};
export declare const DEFAULT_CONFIG: ChainCSSConfig;
export declare const RUNTIME: {
    STYLE_ID_PREFIX: string;
    CLASS_NAME_PREFIX: string;
    HASH_LENGTH: number;
    MAX_CACHE_SIZE: number;
    INJECTION_DELAY: number;
};
export declare const DEV: {
    HOT_RELOAD_PORT: number;
    DEBOUNCE_DELAY: number;
    LOG_PREFIX: string;
};
export declare const PROD: {
    COMPRESSION_LEVEL: number;
    SOURCE_MAP_COMMENT: string;
};
export declare function isNamingScheme(value: unknown): value is NamingScheme;
export declare function isAtomicMode(value: unknown): value is AtomicMode;
export declare function isOutputStrategy(value: unknown): value is OutputStrategy;
export declare function isPrefixerMode(value: unknown): value is PrefixerMode;
export declare function isFramework(value: unknown): value is Framework;
