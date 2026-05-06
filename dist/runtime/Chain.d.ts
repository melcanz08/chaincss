export declare function enableDebug(enabled?: boolean): void;
export declare const setManifest: (manifest: any) => void;
export declare const setTokens: (tokens: any) => void;
export declare class RuntimeChain {
    private useTokens;
    private catcher;
    private componentName;
    proxy: any;
    constructor(useTokens?: boolean);
    use(plugin: any): any;
    hover(): any;
    /**
     * Set the component name for class generation
     */
    $name(name: string): this;
    /**
     * Finalizes the chain. Returns the style object and resets the catcher.
     */
    $el(name?: string): Record<string, any>;
    end(name?: string): Record<string, any>;
    /**
     * Get the current catcher (for debugging)
     */
    getCatcher(): Record<string, any>;
}
/**
 * --- EXPORTS ---
 */
export declare const $: () => any;
export declare const $t: () => any;
export declare const chain: (useTokens?: boolean) => any;
export default chain;
