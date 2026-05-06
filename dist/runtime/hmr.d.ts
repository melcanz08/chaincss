export declare function setupHMR(): void;
/**
 * Register a module for HMR updates
 * @param moduleId - Unique identifier for the module
 * @param styles - Current styles object (optional)
 * @param callback - Callback when module updates (optional)
 */
export declare function registerForHMR(moduleId: string, styles?: Record<string, any>, callback?: (newStyles: Record<string, any>) => void): void;
/**
 * Get HMR status
 */
export declare function isHMRSupported(): boolean;
/**
 * Get current HMR environment
 */
export declare function getHMRType(): string;
declare const _default: {
    setupHMR: typeof setupHMR;
    registerForHMR: typeof registerForHMR;
    isHMRSupported: typeof isHMRSupported;
    getHMRType: typeof getHMRType;
};
export default _default;
