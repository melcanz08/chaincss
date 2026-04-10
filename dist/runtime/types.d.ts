/**
 * Runtime ChainCSS Type Definitions
 * Only needed if using runtime mode
 */
export interface RuntimeStyleDefinition {
    selectors: string[];
    hover?: Record<string, string | number>;
    [cssProperty: string]: any;
}
export interface UseChainStylesOptions {
    /** Cache compiled styles */
    cache?: boolean;
    /** CSS class namespace prefix */
    namespace?: string;
    /** Watch for changes (development only) */
    watch?: boolean;
}
export interface RuntimeCompiledResult {
    [key: string]: string;
}
export interface StyleInjector {
    inject(styleId: string, style: RuntimeStyleDefinition): string;
    injectMultiple(styles: Record<string, RuntimeStyleDefinition>): Record<string, string>;
    update(styleId: string, style: RuntimeStyleDefinition): string;
    remove(styleId: string): void;
    clear(): void;
    getStyleElement(): HTMLStyleElement | null;
}
export interface UseAtomicClassesReturn {
    classes: Record<string, string>;
    cx: (name: string) => string;
    cn: (...names: string[]) => string;
}
export interface HMRPayload {
    file: string;
    classes: Record<string, string>;
    timestamp: number;
}
export interface ChainCSSDebugger {
    enabled: boolean;
    log: (...args: any[]) => void;
    warn: (...args: any[]) => void;
    error: (...args: any[]) => void;
}
//# sourceMappingURL=types.d.ts.map