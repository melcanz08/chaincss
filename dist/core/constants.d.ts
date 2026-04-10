/**
 * ChainCSS Constants
 * Shared constants used across the codebase
 */
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
export declare const DEFAULT_ATOMIC_THRESHOLD = 3;
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
export declare const DEFAULT_CONFIG: {
    tokens: {
        enabled: boolean;
        prefix: string;
    };
    atomic: {
        enabled: boolean;
        threshold: number;
        naming: string;
        cache: boolean;
        cachePath: string;
        minify: boolean;
        mode: string;
        outputStrategy: string;
        alwaysAtomic: string[];
        neverAtomic: string[];
        verbose: boolean;
    };
    prefixer: {
        enabled: boolean;
        mode: PrefixerMode;
        browsers: string[];
        sourceMap: boolean;
        sourceMapInline: boolean;
    };
    output: {
        cssFile: string;
        classMapFile: string;
        typesFile: string;
        minify: boolean;
        generateGlobalCSS: boolean;
    };
    debug: boolean;
    sourceComments: boolean;
    timeline: boolean;
    framework: "auto";
    namespace: string;
    verbose: boolean;
};
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
//# sourceMappingURL=constants.d.ts.map