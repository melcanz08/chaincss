// src/runtime/hmr.ts (fixed version)

import { styleInjector, compileRuntime } from './injector.js';

interface HMRPayload {
  file: string;
  css?: string;
  map?: Record<string, string>;
  styles?: Record<string, any>;
  timestamp?: number;
}

// Type detection for different bundlers
function getHMREnvironment(): 'vite' | 'webpack' | 'none' {
  if (typeof window === 'undefined') return 'none';
  
  // Check for Vite HMR
  if (typeof import.meta !== 'undefined' && (import.meta as any).hot) {
    return 'vite';
  }
  
  // Check for Webpack HMR
  if ((module as any).hot) {
    return 'webpack';
  }
  
  return 'none';
}

export function setupHMR(): void {
  const env = getHMREnvironment();
  
  if (env === 'vite') {
    setupViteHMR();
  } else if (env === 'webpack') {
    setupWebpackHMR();
  }
}

function setupViteHMR(): void {
  if (typeof window === 'undefined') return;
  
  const hot = (import.meta as any).hot;
  if (!hot) return;
  
  // Listen for ChainCSS update events
  hot.on('chaincss:update', (payload: HMRPayload) => {
    console.log(`[ChainCSS HMR] 🔄 Updating styles for ${payload.file}`);
    
    // If new CSS is provided, inject it
    if (payload.css) {
      const styleId = 'chaincss-hmr-styles';
      let styleElement = document.getElementById(styleId) as HTMLStyleElement;
      
      if (!styleElement) {
        styleElement = document.createElement('style');
        styleElement.id = styleId;
        styleElement.setAttribute('data-chaincss', 'hmr');
        document.head.appendChild(styleElement);
      }
      
      styleElement.textContent = payload.css;
      console.log(`[ChainCSS HMR] ✅ Injected ${payload.css.length} bytes of CSS`);
    }
    
    // If new manifest is provided, update atomic mapping
    if (payload.map) {
      // Update manifest (would be handled by manifest system)
      if (typeof window !== 'undefined') {
        (window as any).__CHAINCSS_MANIFEST__ = payload.map;
      }
      console.log(`[ChainCSS HMR] ✅ Updated manifest with ${Object.keys(payload.map).length} entries`);
    }
    
    // If full styles are provided, recompile and inject
    if (payload.styles) {
      const moduleId = `hmr-${payload.file}-${payload.timestamp || Date.now()}`;
      const result = compileRuntime(payload.styles, moduleId);
      console.log(`[ChainCSS HMR] ✅ Recompiled ${Object.keys(result).length} styles`);
    }
  });
  
  // Listen for before update to clean up
  hot.on('vite:beforeUpdate', () => {
    console.log('[ChainCSS HMR] 🧹 Clearing runtime styles before update');
    styleInjector.removeAll();
  });
  
  console.log('[ChainCSS HMR] ✅ Vite HMR setup complete');
}

function setupWebpackHMR(): void {
  if (typeof window === 'undefined') return;
  
  const hot = (module as any).hot;
  if (!hot) return;
  
  // Webpack HMR uses accept() pattern
  hot.accept((err: Error | null) => {
    if (err) {
      console.error('[ChainCSS HMR] ❌ Update failed:', err);
      return;
    }
    
    console.log('[ChainCSS HMR] 🔄 Webpack HMR update');
    styleInjector.removeAll();
  });
  
  hot.dispose(() => {
    console.log('[ChainCSS HMR] 🧹 Cleaning up styles');
    styleInjector.removeAll();
  });
  
  console.log('[ChainCSS HMR] ✅ Webpack HMR setup complete');
}

/**
 * Register a module for HMR updates
 * @param moduleId - Unique identifier for the module
 * @param styles - Current styles object (optional)
 * @param callback - Callback when module updates (optional)
 */
export function registerForHMR(
  moduleId: string, 
  styles?: Record<string, any>,
  callback?: (newStyles: Record<string, any>) => void
): void {
  const env = getHMREnvironment();
  
  if (env === 'vite') {
    registerViteHMR(moduleId, styles, callback);
  } else if (env === 'webpack') {
    registerWebpackHMR(moduleId, styles, callback);
  }
}

function registerViteHMR(
  moduleId: string, 
  styles?: Record<string, any>,
  callback?: (newStyles: Record<string, any>) => void
): void {
  const hot = (import.meta as any).hot;
  if (!hot) return;
  
  // Accept updates for this module
  hot.accept(() => {
    console.log(`[ChainCSS HMR] 🔄 Accepting update for ${moduleId}`);
    
    // Clean up old styles
    styleInjector.removeModule(moduleId);
    
    // If callback provided, call it with new styles
    if (callback && styles) {
      callback(styles);
    }
  });
  
  // Handle disposal
  hot.dispose(() => {
    console.log(`[ChainCSS HMR] 🧹 Disposing module: ${moduleId}`);
    styleInjector.removeModule(moduleId);
  });
}

function registerWebpackHMR(
  moduleId: string, 
  styles?: Record<string, any>,
  callback?: (newStyles: Record<string, any>) => void
): void {
  const hot = (module as any).hot;
  if (!hot) return;
  
  hot.accept(() => {
    console.log(`[ChainCSS HMR] 🔄 Webpack HMR accept for ${moduleId}`);
    
    if (callback && styles) {
      callback(styles);
    }
  });
  
  hot.dispose(() => {
    console.log(`[ChainCSS HMR] 🧹 Webpack HMR dispose for ${moduleId}`);
    styleInjector.removeModule(moduleId);
  });
}

/**
 * Get HMR status
 */
export function isHMRSupported(): boolean {
  return getHMREnvironment() !== 'none';
}

/**
 * Get current HMR environment
 */
export function getHMRType(): string {
  return getHMREnvironment();
}

// Auto-setup in browser
if (typeof window !== 'undefined') {
  setupHMR();
}

// Export utilities
export default {
  setupHMR,
  registerForHMR,
  isHMRSupported,
  getHMRType
};