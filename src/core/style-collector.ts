// src/core/style-collector.ts

/**
 * ChainCSS Style Collector
 * 
 * The unified style collection API. All chain() calls flow through this one class.
 * 
 * Supports two modes:
 *   chain()         — static-only (all values compiled to CSS at build time)
 *   chain.dynamic() — mixed mode (static → CSS, dynamic functions → runtime)
 */

import { shorthandMap, macros } from '../compiler/shorthands.js';
import { resolveToken } from '../compiler/token-resolver.js';
import { classifyValue, type ValueClass } from './value-classifier.js';

// ============================================================================
// Types
// ============================================================================

export interface StyleObject {
  [property: string]: any;
  _classes?: string[];
  _transforms?: Record<string, any>;
  _atRules?: AtRule[];
  _nestedRules?: NestedRule[];
}

export interface AtRule {
  type: 'media' | 'keyframes' | 'font-face' | 'supports' | 'container' | 'layer';
  query?: string;
  name?: string;
  condition?: string;
  styles?: Record<string, any>;
  steps?: Record<string, any>;
  properties?: Record<string, string>;
}

export interface NestedRule {
  selector: string;
  styles: Record<string, any>;
}

export interface DebugEntry {
  prop: string;
  realProp: string;
  originalValue: any;
  resolvedValue: any;
  classification: ValueClass;
  context: 'root' | 'hover';
}

export interface Explanation {
  summary: {
    totalNodes: number;
    staticNodes: number;
    dynamicNodes: number;
    estimatedPerformance: 'fast' | 'medium' | 'slow';
  };
  nodes: Array<{
    prop: string;
    cssProperty: string;
    value: string;
    resolved: any;
    mode: string;
    context: string;
    reasoning: string;
  }>;
  visualization: string;
}

// ============================================================================
// StyleCollector
// ============================================================================

export class StyleCollector {
  private styles: StyleObject = {};
  private hoverStyles: Record<string, any> | null = null;
  private debugMode: boolean;
  private debugLog: DebugEntry[] = [];
  
  /**
   * Mixed mode flag. When true, this chain supports dynamic function values
   * that will be resolved at runtime via useChainStyles().
   * Set via chain.dynamic().
   */
  private _mixed: boolean = false;
  
  // Unitless CSS properties that shouldn't get 'px' suffix
  private static UNITLESS = new Set([
    'zIndex', 'opacity', 'flex', 'flexGrow', 'flexShrink', 'order',
    'fontWeight', 'lineHeight', 'scale', 'zoom', 'animationIterationCount',
    'columnCount', 'orphans', 'widows', 'tabSize', 'fillOpacity', 'strokeOpacity'
  ]);
  
  constructor(options?: { debug?: boolean }) {
    this.debugMode = options?.debug ?? false;
  }

  // ==========================================================================
  // Mixed Mode
  // ==========================================================================

  /**
   * Mark this chain as mixed-mode.
   * Static values → extracted to CSS at build time.
   * Dynamic functions → resolved at runtime via useChainStyles().
   */
  markMixed(): this {
    this._mixed = true;
    return this;
  }

  /**
   * Check if this chain is in mixed mode.
   */
  isMixed(): boolean {
    return this._mixed;
  }
  
  // ==========================================================================
  // Core Property Setting
  // ==========================================================================
  
  /**
   * Set a CSS property value.
   * Every chain() call flows through this one method.
   */
  set(prop: string, value: any): this {
    // Handle macros (multi-property operations like center(), glass(), pill())
    if (macros[prop]) {
      const target = this.hoverStyles || this.styles;
      macros[prop](value, target, true);
      this.logDebug(prop, prop, '[macro]', '[macro]', classifyValue('[macro]'));
      return this;
    }
    
    // Handle transform properties
    if (['scale', 'rotate', 'skew', 'x', 'y'].includes(prop)) {
      this.setTransform(prop, value);
      return this;
    }
    
    // Resolve shorthand to real CSS property (m→margin, bg→backgroundColor, etc.)
    const realProp = (shorthandMap as any)[prop] || prop;
    
    // Resolve value (tokens, functions)
    const resolvedValue = this.resolveValue(value);
    
    // Add px units to numbers where appropriate
    const finalValue = this.addUnit(resolvedValue, realProp);
    
    // Store in current context (hover or root)
    const target = this.hoverStyles || this.styles;
    target[realProp] = finalValue;
    
    // Debug logging
    this.logDebug(prop, realProp, value, finalValue, classifyValue(value));
    
    return this;
  }
  
  private setTransform(type: string, value: any): void {
    if (!this.styles._transforms) this.styles._transforms = {};
    
    const transformMap: Record<string, string> = {
      scale: 'scale',
      rotate: 'rotate', 
      skew: 'skew',
      x: 'translateX',
      y: 'translateY'
    };
    
    const transformName = transformMap[type] || type;
    const needsUnit = ['x', 'y'].includes(type) && typeof value === 'number';
    const unit = needsUnit ? 'px' : '';
    
    this.styles._transforms[transformName] = `${value}${unit}`;
    
    this.logDebug(type, 'transform', value, `${transformName}(${value}${unit})`, classifyValue(value));
  }
  
  // ==========================================================================
  // Value Resolution
  // ==========================================================================
  
  private resolveValue(value: any): any {
    // Keep functions as-is (they'll be resolved at runtime)
    if (typeof value === 'function') {
      return value;
    }
    
    // Resolve token references
    if (typeof value === 'string' && this.isTokenReference(value)) {
      const resolved = resolveToken(value, true, null);
      if (resolved !== undefined && resolved !== null) {
        return resolved;
      }
    }
    
    return value;
  }
  
  private isTokenReference(value: string): boolean {
    return value.includes('$') || value.includes('theme.') || value.includes('var(--');
  }
  
  private addUnit(value: any, prop: string): any {
    if (typeof value !== 'number') return value;
    if (StyleCollector.UNITLESS.has(prop)) return value;
    return `${value}px`;
  }
  
  // ==========================================================================
  // Context Management (hover, nesting)
  // ==========================================================================
  
  hover(): this {
    this.hoverStyles = {};
    return this;
  }
  
  end(): this {
    if (this.hoverStyles) {
      this.styles['&:hover'] = { ...this.hoverStyles };
      this.hoverStyles = null;
    }
    return this;
  }
  
  // ==========================================================================
  // At-Rules
  // ==========================================================================
  
  media(query: string, fn: (c: StyleCollector & Record<string, any>) => void): this {
    const childProxy = StyleCollector.createProxy(this.debugMode);
    fn(childProxy);
    const childResult = (childProxy as any).build 
      ? (childProxy as any).build() 
      : childProxy.$el();
    
    if (!this.styles._atRules) this.styles._atRules = [];
    this.styles._atRules.push({ type: 'media', query, styles: childResult });
    return this;
  }
  
  supports(condition: string, fn: (c: StyleCollector & Record<string, any>) => void): this {
    const childProxy = StyleCollector.createProxy(this.debugMode);
    fn(childProxy);
    const childResult = (childProxy as any).build 
      ? (childProxy as any).build() 
      : childProxy.$el();
    
    if (!this.styles._atRules) this.styles._atRules = [];
    this.styles._atRules.push({ type: 'supports', condition, styles: childResult });
    return this;
  }
  
  container(query: string, fn: (c: StyleCollector & Record<string, any>) => void): this {
    const childProxy = StyleCollector.createProxy(this.debugMode);
    fn(childProxy);
    const childResult = (childProxy as any).build 
      ? (childProxy as any).build() 
      : childProxy.$el();
    
    if (!this.styles._atRules) this.styles._atRules = [];
    this.styles._atRules.push({ type: 'container', condition: query, styles: childResult });
    return this;
  }
  
  layer(name: string, fn: (c: StyleCollector & Record<string, any>) => void): this {
    const childProxy = StyleCollector.createProxy(this.debugMode);
    fn(childProxy);
    const childResult = (childProxy as any).build 
      ? (childProxy as any).build() 
      : childProxy.$el();
    
    if (!this.styles._atRules) this.styles._atRules = [];
    this.styles._atRules.push({ type: 'layer', name, styles: childResult });
    return this;
  }
  
  // ==========================================================================
  // Nesting
  // ==========================================================================
  
  nest(selector: string, fn: (c: StyleCollector & Record<string, any>) => void): this {
    const childProxy = StyleCollector.createProxy(this.debugMode);
    fn(childProxy);
    const childResult = (childProxy as any).build 
      ? (childProxy as any).build() 
      : childProxy.$el();
    
    if (!this.styles._nestedRules) this.styles._nestedRules = [];
    this.styles._nestedRules.push({ selector, styles: childResult });
    return this;
  }
  
  children(fn: (c: StyleCollector & Record<string, any>) => void): this {
    return this.nest('& > *', fn);
  }
  
  // ==========================================================================
  // Keyframes & Fonts
  // ==========================================================================
  
  keyframes(name: string, steps: Record<string, any>): this {
    if (!this.styles._atRules) this.styles._atRules = [];
    this.styles._atRules.push({ type: 'keyframes', name, steps });
    return this;
  }
  
  fontFace(properties: Record<string, string>): this {
    if (!this.styles._atRules) this.styles._atRules = [];
    this.styles._atRules.push({ type: 'font-face', properties });
    return this;
  }
  
  // ==========================================================================
  // Conditional Application
  // ==========================================================================
  
  when(condition: boolean, fn: (c: StyleCollector & Record<string, any>) => void): this {
    if (condition) {
      const childProxy = StyleCollector.createProxy(this.debugMode);
      fn(childProxy);
      const childResult = (childProxy as any).build 
        ? (childProxy as any).build() 
        : childProxy.$el();
      
      for (const [key, value] of Object.entries(childResult)) {
        if (key !== 'selectors' && key !== '_atRules' && key !== '_nestedRules') {
          (this.hoverStyles || this.styles)[key] = value;
        }
      }
    }
    return this;
  }
  
  // ==========================================================================
  // Class Management
  // ==========================================================================
  
  addClass(className: string): this {
    if (!this.styles._classes) this.styles._classes = [];
    if (!this.styles._classes.includes(className)) {
      this.styles._classes.push(className);
    }
    return this;
  }
  
  componentName(name: string): this {
    this.styles._name = name;
    return this;
  }
  
  // ==========================================================================
  // Build Output
  // ==========================================================================
  
  /**
   * Build and return the final style object.
   */
  build(selectors?: string[] | string): StyleObject & { selectors?: string[] } {
    const result: StyleObject & { selectors?: string[] } = { ...this.styles };
    
    // Preserve mixed mode flag on the output
    if (this._mixed) {
      (result as any)._mixed = true;
    }
    
    // Compile transforms
    if (result._transforms) {
      const transforms = Object.entries(result._transforms)
        .map(([k, v]) => `${k}(${v})`)
        .join(' ');
      result.transform = transforms;
      delete result._transforms;
    }
    
    // Normalize selectors
    let normalizedSelectors: string[] | undefined;
    if (selectors) {
      const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
      if (selectorArray.length > 0) {
        normalizedSelectors = selectorArray.map(s => {
          if (typeof s !== 'string') return String(s);
          if (!s.startsWith('.') && !s.startsWith('#') && 
              !s.startsWith('[') && !s.startsWith(':') && s !== '*') {
            return '.chain-' + s;
          }
          return s;
        });
      }
    }
    
    if (normalizedSelectors) {
      result.selectors = normalizedSelectors;
    }
    
    // Reset for reuse
    const output = { ...result };
    this.reset();
    
    return output;
  }
  
  /**
   * Alias for build() — chain-friendly.
   * chain().bg('red').$el('button')
   */
  $el(...selectors: string[]): StyleObject & { selectors?: string[] } {
    return this.build(selectors);
  }
  
  private reset(): void {
    this.styles = {};
    this.hoverStyles = null;
    this.debugLog = [];
    // Note: _mixed is NOT reset — it's set once per chain
  }
  
  // ==========================================================================
  // Debug / Explain
  // ==========================================================================
  
  private logDebug(prop: string, realProp: string, original: any, resolved: any, classification: ValueClass): void {
    if (!this.debugMode) return;
    
    this.debugLog.push({
      prop,
      realProp,
      originalValue: original,
      resolvedValue: resolved,
      classification,
      context: this.hoverStyles ? 'hover' : 'root'
    });
  }
  
  /**
   * Explain what this chain does.
   * Only populates data when debug mode is enabled.
   */
  explain(): Explanation {
    const entries = this.debugLog;
    
    if (entries.length === 0) {
      return {
        summary: { totalNodes: 0, staticNodes: 0, dynamicNodes: 0, estimatedPerformance: 'fast' },
        nodes: [],
        visualization: this.debugMode 
          ? 'No styles recorded yet.' 
          : 'Enable debug mode to see explanations: chain({ debug: true })'
      };
    }
    
    const staticCount = entries.filter(e => e.classification === 'static').length;
    const dynamicCount = entries.filter(e => e.classification === 'dynamic').length;
    
    const summary = {
      totalNodes: entries.length,
      staticNodes: staticCount,
      dynamicNodes: dynamicCount,
      estimatedPerformance: (dynamicCount === 0 ? 'fast' :
                              dynamicCount <= 3 ? 'medium' : 'slow') as 'fast' | 'medium' | 'slow'
    };
    
    const nodes = entries.map(e => ({
      prop: e.prop,
      cssProperty: e.realProp,
      value: typeof e.originalValue === 'function' 
        ? '[Function]' 
        : JSON.stringify(e.originalValue),
      resolved: e.resolvedValue,
      mode: e.classification === 'static' ? '📦 build' : '🏃 runtime',
      context: e.context,
      reasoning: e.classification === 'static'
        ? 'Static — extracted at build time'
        : typeof e.originalValue === 'function'
          ? 'Function — resolved at runtime'
          : 'Dynamic reference — resolved at runtime'
    }));
    
    const visualization = this.renderVisualization(entries, summary);
    
    return { summary, nodes, visualization };
  }
  
  private renderVisualization(entries: DebugEntry[], summary: Explanation['summary']): string {
    const lines: string[] = [];
    const width = 64;
    
    lines.push('┌' + '─'.repeat(width - 2) + '┐');
    lines.push('│' + ' ChainCSS Style Explanation '.padEnd(width - 2) + '│');
    lines.push('├' + '─'.repeat(width - 2) + '┤');
    
    for (const e of entries) {
      const icon = e.classification === 'static' ? '📦' : '🏃';
      const ctx = e.context === 'hover' ? ' (hover)' : '';
      let val = typeof e.originalValue === 'function'
        ? '<function>'
        : typeof e.originalValue === 'string' && e.originalValue.length > 22
          ? e.originalValue.substring(0, 19) + '...'
          : String(e.originalValue);
      
      const left = `${icon} ${e.prop}${ctx}`.padEnd(22);
      const right = val.padEnd(30);
      const line = `│ ${left}→ ${right}│`;
      lines.push(line);
    }
    
    lines.push('├' + '─'.repeat(width - 2) + '┤');
    const perf = summary.estimatedPerformance.toUpperCase();
    lines.push(`│ Performance: ${perf.padEnd(width - 17)}│`);
    lines.push(`│ Static: ${summary.staticNodes} | Dynamic: ${summary.dynamicNodes}${' '.repeat(width - 26 - String(summary.staticNodes).length - String(summary.dynamicNodes).length)}│`);
    lines.push('└' + '─'.repeat(width - 2) + '┘');
    
    return lines.join('\n');
  }
  
  // ==========================================================================
  // Proxy — Makes chain().property(value) work
  // ==========================================================================
  
  /**
   * Create a Proxy that makes the StyleCollector chainable.
   * 
   * chain().bg('red').color('blue').hover().opacity(0.5).end().$el('button')
   */
  static createProxy(debug: boolean = false): StyleCollector & Record<string, any> {
    const collector = new StyleCollector({ debug });
    
    let proxy: any;
    
    proxy = new Proxy(collector, {
      get(target: StyleCollector, prop: string) {
        // Terminal methods — return their result directly
        if (prop === '$el') return (...args: string[]) => target.$el(...args);
        if (prop === 'build') return (...args: any[]) => {
          const selectors = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
          return target.build(selectors);
        };
        if (prop === 'explain') return () => target.explain();
        
        // Mixed mode API
        if (prop === 'isMixed') return () => target.isMixed();
        if (prop === '_mixed') return target.isMixed();
        
        // Context methods — return the proxy for continued chaining
        if (prop === 'hover') return () => { target.hover(); return proxy; };
        if (prop === 'end') return () => { target.end(); return proxy; };
        
        // At-rule methods
        if (prop === 'media') return (query: string, fn: Function) => { 
          target.media(query, fn as any); 
          return proxy; 
        };
        if (prop === 'supports') return (condition: string, fn: Function) => { 
          target.supports(condition, fn as any); 
          return proxy; 
        };
        if (prop === 'container') return (query: string, fn: Function) => { 
          target.container(query, fn as any); 
          return proxy; 
        };
        if (prop === 'layer') return (name: string, fn: Function) => { 
          target.layer(name, fn as any); 
          return proxy; 
        };
        
        // Nesting methods
        if (prop === 'nest') return (selector: string, fn: Function) => { 
          target.nest(selector, fn as any); 
          return proxy; 
        };
        if (prop === 'children') return (fn: Function) => { 
          target.children(fn as any); 
          return proxy; 
        };
        
        // Keyframes and fonts
        if (prop === 'keyframes') return (name: string, steps: any) => { 
          target.keyframes(name, steps); 
          return proxy; 
        };
        if (prop === 'fontFace') return (props: any) => { 
          target.fontFace(props); 
          return proxy; 
        };
        
        // Conditional
        if (prop === 'when') return (condition: boolean, fn: Function) => { 
          target.when(condition, fn as any); 
          return proxy; 
        };
        
        // Utilities
        if (prop === 'addClass') return (name: string) => { 
          target.addClass(name); 
          return proxy; 
        };
        if (prop === 'componentName') return (name: string) => { 
          target.componentName(name); 
          return proxy; 
        };
        if (prop === 'debug') return () => { 
          (target as any).debugMode = true; 
          return proxy; 
        };
        
        // Prevent Promise-like behavior (React and other frameworks check .then)
        if (prop === 'then') return undefined;
        
        // Check if it's a registered macro (gridList, hero, pill, etc.)
        if (macros[prop]) {
          return (value: any) => {
            target.set(prop, value);
            return proxy;
          };
        }
        
        // Check if it's a method on the collector itself
        if (typeof (target as any)[prop] === 'function' && 
            !['set', 'build', '$el', 'hover', 'end'].includes(prop)) {
          return (...args: any[]) => {
            (target as any)[prop](...args);
            return proxy;
          };
        }
        
        // Everything else → CSS property
        return (value: any) => {
          target.set(prop, value);
          return proxy;
        };
      }
    });
    
    return proxy;
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a new chainable style collector (static-only mode).
 * All values are compiled to CSS at build time.
 * 
 * @example
 * const styles = chain()
 *   .bg('red')
 *   .color('white')
 *   .padding(16)
 *   .$el('button')
 */
export function chain(options?: { debug?: boolean }): StyleCollector & Record<string, any> {
  return StyleCollector.createProxy(options?.debug ?? false);
}

/**
 * Create a mixed-mode chain. Static values go to CSS, dynamic functions
 * stay in JS and are resolved at runtime via useChainStyles().
 * 
 * @example
 * const styles = chain.dynamic()
 *   .bg('#6366f1')                           // static → CSS
 *   .opacity(() => isActive ? 1 : 0.5)        // dynamic → runtime
 *   .$el('btn')
 * 
 * // In your component:
 * // import { useChainStyles } from 'chaincss/runtime'
 * // const classes = useChainStyles({ btn: styles }, [isActive])
 */
chain.dynamic = function(options?: { debug?: boolean }): StyleCollector & Record<string, any> {
  const proxy = StyleCollector.createProxy(options?.debug ?? false);
  (proxy as any).markMixed();
  return proxy;
};

export default chain;