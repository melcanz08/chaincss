// chaincss/src/runtime/Chain.ts

import { macros as coreMacros, shorthandMap } from '../compiler/shorthands.js';

let debugMode = false;

export function enableDebug(enabled: boolean = true): void {
  debugMode = enabled;
}


/**
 * The mutable registry for runtime plugins.
 */
const runtimeMacros: Record<string, any> = { ...coreMacros };

/**
 * HYDRATION BRIDGE
 * This stores the mapping between "prop:value" and "atomic-class-name".
 * It is populated at app-start by the user.
 */
let globalManifest: Record<string, string> = {};

// Update setManifest to use debug flag
export const setManifest = (manifest: any) => {
  if (manifest.atomicMap) {
    globalManifest = manifest.atomicMap;
  } else if (manifest.atomicClasses) {
    globalManifest = manifest.atomicClasses;
  } else {
    globalManifest = manifest || {};
  }
  
  if (debugMode) {
    console.log('[ChainCSS] Manifest loaded with', Object.keys(globalManifest).length, 'entries');
  }
};

/**
 * THE TOKEN STORE
 * Stores user-defined design tokens (colors, spacing, etc.)
 */
let globalTokens: Record<string, any> = {};

// Update setTokens to use debug flag
export const setTokens = (tokens: any) => {
  globalTokens = tokens;
  if (debugMode) {
    console.log('[ChainCSS] Tokens updated:', Object.keys(globalTokens));
  }
};

export class RuntimeChain {
  // catcher now tracks both raw styles and pre-baked class names
  private catcher: Record<string, any> = { _classes: [] };
  private componentName: string = '';
  public proxy: any;

  constructor(private useTokens: boolean = false) {
    // Only these methods are public API
    const PUBLIC_METHODS = new Set([
      'use', 'hover', '$el', '$name', 'end', 'getCatcher'
    ]);
    
    this.proxy = new Proxy(this, {
      /**
       * 1. TRAPS FOR EXTERNAL TOOLS (React, DevTools, JSON.stringify)
       * This prevents the "cyclic object value" error.
       */
      get: (target, prop: string | symbol) => {
        // Handle standard JS/React internal checks
        if (prop === 'toJSON') return () => target.catcher;
        if (prop === 'constructor') return RuntimeChain;
        if (prop === Symbol.toStringTag) return 'RuntimeChain';
        if (prop === '_isChain') return true; // Secret handshake for the hook

        // If it's a symbol we don't handle, return it from the target
        if (typeof prop !== 'string') return (target as any)[prop];

        // 2. PUBLIC METHODS only ($el, use, hover, $name, end, getCatcher)
        if (prop in target && PUBLIC_METHODS.has(prop)) {
          const val = (target as any)[prop];
          return typeof val === 'function' ? val.bind(target) : val;
        }
        
        // Block internal methods from being called directly
        if (prop in target && typeof (target as any)[prop] === 'function') {
          if (debugMode) {
            console.warn(`[ChainCSS] '${prop}' is an internal method, not part of the public API`);
          }
          return undefined;
        }

        // 3. SHORTHAND RESOLUTION (e.g., 'bg' -> 'backgroundColor')
        const realProp = (shorthandMap as any)[prop] || prop;

        // 4. MACRO CHECK (.center, .glass, etc.)
        if (runtimeMacros[prop]) {
          return (val: any) => {
            runtimeMacros[prop](val, target.catcher, target.useTokens);
            return target.proxy;
          };
        }

        // 5. THE "BREAD AND BUTTER" CSS HANDLER
        return (val: any) => {
          // --- TOKEN RESOLUTION ---
          let finalVal = val;
          let valueWithUnit = val;
          const unitless = ['opacity', 'zIndex', 'flex', 'fontWeight', 'flexGrow', 'flexShrink', 'flexBasis', 'order', 'lineHeight', 'animationIterationCount', 'orphans', 'widows', 'columnCount'];
          if (typeof finalVal === 'number' && !unitless.includes(realProp)) {
            valueWithUnit = `${val}px`;
            finalVal = valueWithUnit; // Ensure the dynamic style also has px
          }

          // --- HYBRID LOOKUP (Static vs Dynamic) ---
          // Match the compiler's format "property:value"
          const lookupKey = `${realProp}:${valueWithUnit}`; 
          const staticClass = globalManifest[lookupKey];

          // In the RuntimeChain class, when adding to _classes, add debug
          if (staticClass) {
            if (!target.catcher._classes.includes(staticClass)) {
              target.catcher._classes.push(staticClass);
              if (debugMode) {
                console.log(`[ChainCSS] Using atomic class: ${staticClass} for ${lookupKey}`);
              }
            }
          } else {
            if (debugMode) {
              console.log(`[ChainCSS] No atomic class for ${lookupKey}, will inject at runtime`);
            }
            target.catcher[realProp] = finalVal;
          }

          // Return the proxy so we can keep chaining: .bg().color().br()
          return target.proxy;
        };
      }
    });
  }

  

  use(plugin: any): any {
    const { selectors, atRules, ...styles } = plugin;
    
    // Resolve shorthands for incoming plugin styles
    Object.entries(styles).forEach(([key, val]) => {
      const realProp = (shorthandMap as any)[key] || key;
      this.catcher[realProp] = val;
    });
    
    return this.proxy;
  }

  hover(): any {
    const hoverCatcher: Record<string, any> = { _classes: [] };
    const hoverHandler: ProxyHandler<object> = {
      get: (_, prop: string) => {
        if (prop === 'end') {
          return () => {
            this.catcher.hover = { ...this.catcher.hover, ...hoverCatcher };
            return this.proxy;
          };
        }

        const realProp = (shorthandMap as any)[prop] || prop;

        return (val: any) => {
          // ✅ FIXED: Use hover: prefix for hover state keys
          const lookupKey = `hover:${realProp}:${val}`;
          const staticClass = globalManifest[lookupKey];

          if (staticClass) {
            if (!hoverCatcher._classes.includes(staticClass)) {
              hoverCatcher._classes.push(staticClass);
            }
          } else if (runtimeMacros[prop]) {
            runtimeMacros[prop](val, hoverCatcher, this.useTokens);
          } else {
            hoverCatcher[realProp] = val;
          }
          return hoverProxy;
        };
      }
    };
    const hoverProxy = new Proxy({}, hoverHandler);
    return hoverProxy;
  }

  /**
   * Set the component name for class generation
   */
  $name(name: string): this {
    this.componentName = name;
    return this;
  }

  /**
   * Finalizes the chain. Returns the style object and resets the catcher.
   */
  $el(name?: string): Record<string, any> {
  // Deep clone to prevent reference sharing
  const result = structuredClone(this.catcher);
  
  // Set component name
  result._name = name || this.componentName || 'element';
  
  // Strip internal metadata
  delete result._componentName;
  delete result._generateComponent;
  delete result._framework;
  delete result._propsDefinition;
  
  // Full reset
  this.catcher = { _classes: [] };
  this.componentName = '';
  
  return result;
}

  end(name?: string) {
    return this.$el(name);
  }
  
  /**
   * Get the current catcher (for debugging)
   */
  getCatcher(): Record<string, any> {
    return { ...this.catcher };
  }
}

/**
 * --- EXPORTS ---
 */

export const $ = () => new RuntimeChain(false).proxy;
export const $t = () => new RuntimeChain(true).proxy;
export const chain = (useTokens: boolean = false) => new RuntimeChain(useTokens).proxy;
export default chain;