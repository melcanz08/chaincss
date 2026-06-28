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
// Types
// ============================================================================

export type { Explanation } from './debug-collector.js';

export interface StyleObject {
  [property: string]: any;
  _classes?: string[];
  _transforms?: Record<string, any>;
  _atRules?: AtRule[];
  _nestedRules?: NestedRule[];
  _mixed?: boolean;
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

// ============================================================================
// StyleCollector
// ============================================================================

export class StyleCollector {
  // Delegated components
  private props: PropertyStore;
  private rules: RuleBuilder;
  private debugger: DebugCollector;

  // State
  private hoverStore: PropertyStore | null = null;
  private classes: string[] = [];
  private componentName_: string = '';
  private _mixed: boolean = false;

  constructor(options?: { debug?: boolean }) {
    this.props = new PropertyStore();
    this.rules = new RuleBuilder();
    this.debugger = new DebugCollector(options?.debug ?? false);
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
    const target = this.hoverStore || this.props;
    const entry: PropertyStoreEntry = target.set(prop, value);

    this.debugger.log(prop, entry, value, this.hoverStore ? 'hover' : 'root');
    return this;
  }

  // ========================================================================
  // Context Management (hover)
  // ========================================================================

  hover(): this {
    this.hoverStore = new PropertyStore();
    return this;
  }

  end(): this {
    if (this.hoverStore && !this.hoverStore.isEmpty()) {
      const hoverProps = this.hoverStore.getAll();
      this.props.set('&:hover', hoverProps);
      this.hoverStore = null;
    }
    return this;
  }

  // ========================================================================
  // At-Rules & Nesting (delegate to RuleBuilder)
  // ========================================================================

  media(query: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, createStyleProxyForChild, this.debugger.isEnabled());
    this.rules.addMedia(query, childResult);
    return this;
  }

  supports(condition: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, createStyleProxyForChild, this.debugger.isEnabled());
    this.rules.addSupports(condition, childResult);
    return this;
  }

  container(query: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, createStyleProxyForChild, this.debugger.isEnabled());
    this.rules.addContainer(query, childResult);
    return this;
  }

  layer(name: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, createStyleProxyForChild, this.debugger.isEnabled());
    this.rules.addLayer(name, childResult);
    return this;
  }

  nest(selector: string, fn: (c: any) => void): this {
    const childResult = this.rules.buildChild(fn, createStyleProxyForChild, this.debugger.isEnabled());
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
      const childResult = this.rules.buildChild(fn, createStyleProxyForChild, this.debugger.isEnabled());
      for (const [key, value] of Object.entries(childResult)) {
        if (key !== 'selectors' && key !== '_atRules' && key !== '_nestedRules') {
          (this.hoverStore || this.props).set(key, value);
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

  componentName(name: string): this {
    this.componentName_ = name;
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
    // Collect all properties (including any pending hover)
    if (this.hoverStore && !this.hoverStore.isEmpty()) {
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
            return '.chain-' + s;
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
    this.hoverStore = null;
    this.classes = [];
    this.componentName_ = '';
    // Note: _mixed is NOT reset — set once per chain
  }
}

// ============================================================================
// Proxy Creation Helper (used internally for child builders)
// ============================================================================

function createStyleProxyForChild(debug: boolean): StyleCollector & Record<string, any> {
  const collector = new StyleCollector({ debug });
  return createStyleProxy(collector, macroRegistry as Record<string, Function>) as any;
}

// ============================================================================
// Public API
// ============================================================================

export function chain(options?: { debug?: boolean }): StyleCollector & Record<string, any> {
  const collector = new StyleCollector(options);
  return createStyleProxy(collector, macroRegistry as Record<string, Function>) as any;
}

chain.dynamic = function (options?: { debug?: boolean }): StyleCollector & Record<string, any> {
  const collector = new StyleCollector(options);
  collector.markMixed();
  return createStyleProxy(collector, macroRegistry as Record<string, Function>) as any;
};

export default chain;