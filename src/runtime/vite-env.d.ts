// src/runtime/vite-env.d.ts (enhanced version)

/// <reference types="vite/client" />

/**
 * Vite HMR API Type Extensions
 * Provides full type support for import.meta.hot
 */

interface ImportMeta {
  readonly hot?: {
    /**
     * Accept updates for this module
     */
    accept(cb?: (mod: any) => void): void;
    
    /**
     * Accept updates for specific dependencies
     */
    accept(deps: string[], cb: (modules: any[]) => void): void;
    
    /**
     * Handle disposal of this module
     */
    dispose(cb: (data: any) => void): void;
    
    /**
     * Listen to custom HMR events
     */
    on(event: string, cb: (data: any) => void): void;
    
    /**
     * Send custom HMR events
     */
    send(event: string, data: any): void;
    
    /**
     * Decline updates for this module
     */
    decline(): void;
    
    /**
     * Invalidate this module (force reload)
     */
    invalidate(): void;
    
    /**
     * Check if HMR is available
     */
    hot: boolean;
    
    /**
     * Current module data
     */
    data: any;
  };
}

/**
 * Webpack HMR API Type Extensions
 * For Webpack compatibility
 */
declare module 'webpack' {
  interface HotModule {
    accept(callback?: (modules?: any[]) => void): void;
    accept(dependencies: string[], callback?: (updatedDependencies: string[]) => void): void;
    decline(): void;
    dispose(callback: (data: any) => void): void;
    addStatusHandler(callback: (status: string) => void): void;
    removeStatusHandler(callback: (status: string) => void): void;
    data: any;
    status: () => string;
  }
  
  interface NodeModule {
    hot?: HotModule;
  }
}

/**
 * Global HMR utilities for ChainCSS
 */
declare namespace ChainCSSHMR {
  interface HMREventMap {
    'chaincss:update': {
      file: string;
      css?: string;
      map?: Record<string, string>;
      styles?: Record<string, any>;
      timestamp?: number;
    };
    'vite:beforeUpdate': void;
    'vite:afterUpdate': void;
  }
  
  interface HMRUtils {
    /**
     * Setup HMR for the current environment
     */
    setupHMR(): void;
    
    /**
     * Register a module for HMR updates
     */
    registerForHMR(moduleId: string, styles?: Record<string, any>, callback?: (newStyles: Record<string, any>) => void): void;
    
    /**
     * Check if HMR is supported
     */
    isHMRSupported(): boolean;
    
    /**
     * Get the current HMR environment type
     */
    getHMRType(): 'vite' | 'webpack' | 'none';
  }
}

// Export types for use in other files
export type { ChainCSSHMR };