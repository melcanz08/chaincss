// src/core/style-collector.ts

/**
 * ChainCSS Style Collector
 * 
 * The unified style collection API. All chain() calls flow through this class.
 * 
 * Supports two modes:
 *   chain()         — static-only (all values compiled to CSS at build time)
 *   chain.dynamic() — mixed mode (static → CSS, dynamic functions → runtime)
 * 
 * Responsibilities (delegated):
 *   PropertyStore  — property collection, shorthands, macros, units, tokens
 *   RuleBuilder    — context switching, nesting, at-rules
 *   DebugCollector — debug logging, explanation, visualization
 *   StyleProxy     — proxy creation and method dispatch
 */

import { macros as macroRegistry } from '../compiler/utils/shorthands.js';
import { PropertyStore, type PropertyStoreEntry } from './property-store.js';
import { RuleBuilder } from './rule-builder.js';
import { DebugCollector, type Explanation } from './debug-collector.js';
import { createStyleProxy } from './style-proxy.js';
import { classifyValue } from './value-classifier.js';

// ============================================================================
// Types — Re-export from canonical source to eliminate duplicates
// ============================================================================

export type { Explanation } from './debug-collector.js';

// Import canonical types from types.ts
import type { 
  StyleObject as _StyleObject, 
  AtRule as _AtRule, 
  NestedRule as _NestedRule 
} from './types.js';

// Re-export so existing consumers still work
export type StyleObject = _StyleObject;
export type AtRule = _AtRule;
export type NestedRule = _NestedRule;

// ============================================================================
// StyleCollector
// ============================================================================

export class StyleCollector {
  // Delegated components
  private props: PropertyStore;
  private rules: RuleBuilder;
  private debugger: DebugCollector;

  // State
  private classes: string[] = [];
  private _mixed: boolean = false;

  private classPrefix: string;

  private pseudoStore: PropertyStore | null = null;
  private pseudoName: string = '';

  constructor(private options?: { debug?: boolean; classPrefix?: string; tokens?: any }) {
    this.props = new PropertyStore(options?.tokens);
    this.rules = new RuleBuilder();
    this.debugger = new DebugCollector(options?.debug ?? false);
     this.classPrefix = options?.classPrefix || 'chain-';
  }

  // ========================================================================
  // Mixed Mode
  // ========================================================================

  markMixed(): this {
    this._mixed = true;
    return this;
  }

  isMixed(): boolean {
    return this._mixed;
  }

  // ========================================================================
  // Property Setting (delegates to PropertyStore)
  // ========================================================================

  set(prop: string, value: any): this {
    const target = this.pseudoStore || this.props;
    const entry: PropertyStoreEntry = target.set(prop, value);
    this.debugger.log(prop, entry, value, this.pseudoStore ? this.pseudoName : 'root');
    return this;
  }

  // ========================================================================
  // Context Management (hover)
  // ========================================================================

  hover(): this { return this.pseudo('hover'); }
  focus(): this { return this.pseudo('focus'); }
  active(): this { return this.pseudo('active'); }
  checked(): this { return this.pseudo('checked'); }
  disabled(): this { return this.pseudo('disabled'); }
  before(): this { return this.pseudo('before'); }
  after(): this { return this.pseudo('after'); }
  placeholder(): this { return this.pseudo(':placeholder'); }

  private pseudo(name: string): this {
    // Auto-close any open pseudo before switching to prevent silent data loss
    if (this.pseudoStore && !this.pseudoStore.isEmpty()) {
      this.end();
    }
    this.pseudoStore = new PropertyStore(this.options?.tokens);  // Forward tokens to pseudo
    this.pseudoName = name;
    return this;
  }

  end(): this {
    if (this.pseudoStore && !this.pseudoStore.isEmpty()) {
      const pseudoProps = this.pseudoStore.getAll();
      this.props.set(`&:${this.pseudoName}`, pseudoProps);
      this.pseudoStore = null;
      this.pseudoName = '';
    }
    return this;
  }

  // ========================================================================
  // At-Rules & Nesting (delegate to RuleBuilder)
  // ========================================================================

  media(query: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addMedia(query, childResult);
    return this;
  }

  supports(condition: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addSupports(condition, childResult);
    return this;
  }

  container(query: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addContainer(query, childResult);
    return this;
  }

  layer(name: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addLayer(name, childResult);
    return this;
  }

  nest(selector: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addNested(selector, childResult);
    return this;
  }

  children(fn: (c: any) => void): this {
    return this.nest('& > *', fn);
  }

  keyframes(name: string, steps: Record<string, any>): this {
    this.rules.addKeyframes(name, steps);
    return this;
  }

  fontFace(properties: Record<string, string>): this {
    this.rules.addFontFace(properties);
    return this;
  }

  when(condition: boolean, fn: (c: any) => void): this {
    if (condition) {
      const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
      for (const [key, value] of Object.entries(childResult)) {
        if (key !== 'selectors' && key !== '_atRules' && key !== '_nestedRules' && !key.startsWith('_')) {
          this.set(key, value);
        }
      }
    }
    return this;
  }

  // ========================================================================
  // Class & Component Management
  // ========================================================================

  addClass(className: string): this {
    if (!this.classes.includes(className)) {
      this.classes.push(className);
    }
    return this;
  }

  // ========================================================================
  // Debug
  // ========================================================================

  enableDebug(): this {
    this.debugger.setEnabled(true);
    return this;
  }

  explain(): Explanation {
    return this.debugger.explain();
  }

  // ========================================================================
  // Build Output
  // ========================================================================

  build(selectors?: string[] | string): StyleObject & { selectors?: string[] } {
    if (this.pseudoStore && !this.pseudoStore.isEmpty()) {
      this.end();
    }

    const result: StyleObject & { selectors?: string[] } = {
      ...this.props.getAll(),
    };

    // Preserve mixed mode flag
    if (this._mixed) {
      result._mixed = true;
    }

    // Attach class list
    if (this.classes.length > 0) {
      result._classes = [...this.classes];
    }

    // Attach at-rules
    const atRules = this.rules.getAtRules();
    if (atRules.length > 0) {
      result._atRules = atRules;
    }

    // Attach nested rules
    const nestedRules = this.rules.getNestedRules();
    if (nestedRules.length > 0) {
      result._nestedRules = nestedRules;
    }

    // Normalize selectors
    if (selectors) {
      const selectorArray = Array.isArray(selectors) ? selectors : [selectors];
      if (selectorArray.length > 0) {
        result.selectors = selectorArray.map(s => {
          if (typeof s !== 'string') return String(s);
          if (!s.startsWith('.') && !s.startsWith('#') &&
              !s.startsWith('[') && !s.startsWith(':') && s !== '*') {
            return '.' + this.classPrefix + s;  // NEW
          }
          return s;
        });
      }
    }

    // Reset for potential reuse
    this.reset();

    return result;
  }

  $el(...selectors: string[]): StyleObject & { selectors?: string[] } {
    return this.build(selectors);
  }

  // ========================================================================
  // Reset
  // ========================================================================

  /**
   * Reset all state for reuse.
   * 
   * IMPORTANT: _mixed is intentionally NOT reset.
   * Each proxy is short-lived (created per chain() call) and the mixed flag
   * is set once during construction via chain.dynamic().
   * If you reuse a collector instance directly (not through chain()),
   * call markMixed() again if needed.
   */
  private reset(): void {
    this.props.reset();
    this.rules.reset();
    this.debugger.reset();
    this.pseudoStore = null;
    this.pseudoName = '';
    this.classes = [];
  }
}

// ============================================================================
// Proxy Creation Helper (used internally for child builders)
// ============================================================================

function createStyleProxyForChild(opts: { debug: boolean; classPrefix?: string; tokens?: any }): StyleCollector & Record<string, any> {
  const collector = new StyleCollector(opts);
  return createStyleProxy(collector, macroRegistry as Record<string, Function>) as any;
}

// ============================================================================
// Public API
// ============================================================================

export function chain(options?: { debug?: boolean; classPrefix?: string; tokens?: any }): StyleCollector & Record<string, any> {
  const collector = new StyleCollector(options);
  return createStyleProxy(collector, macroRegistry as Record<string, Function>) as any;
}

chain.dynamic = function (options?: { debug?: boolean; classPrefix?: string; tokens?: any }): StyleCollector & Record<string, any> {
  const collector = new StyleCollector(options);
  collector.markMixed();
  return createStyleProxy(collector, macroRegistry as Record<string, Function>) as any;
};

export default chain;