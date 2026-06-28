// src/core/property-store.ts

/**
 * PropertyStore — Handles CSS property collection, shorthand expansion,
 * macro execution, token resolution, and unit normalization.
 * 
 * Extracted from StyleCollector to keep it focused on one responsibility.
 */

import { shorthandMap, macros } from '../compiler/utils/shorthands.js';
import { resolveToken, TokenResolver } from '../compiler/tokens/token-resolver.js';
import { classifyValue, type ValueClass } from './value-classifier.js';

export interface PropertyStoreEntry {
  realProp: string;
  value: any;
  classification: ValueClass;
}

// Unitless CSS properties that shouldn't get 'px' suffix
const UNITLESS = new Set([
  'zIndex', 'opacity', 'flex', 'flexGrow', 'flexShrink', 'order',
  'fontWeight', 'lineHeight', 'scale', 'zoom', 'animationIterationCount',
  'columnCount', 'orphans', 'widows', 'tabSize', 'fillOpacity', 'strokeOpacity',
  'flexBasis', 'aspectRatio', 'gridRow', 'gridColumn', 'gridRowStart',
  'gridRowEnd', 'gridColumnStart', 'gridColumnEnd', 'strokeWidth',
  'strokeDashoffset', 'strokeDasharray'
]);

export class PropertyStore {
  private properties: Record<string, any> = {};
  private transforms: Record<string, string> = {};
  private tokenResolver: any = null;  // TokenResolver instance

  constructor(tokens?: any) {
    if (tokens) {
      // Lazy-import TokenResolver to avoid circular deps
      this.tokenResolver = new TokenResolver(tokens);
    }
  }

  /**
   * Set a CSS property value. Handles macros, shorthands, tokens, and units.
   * Returns metadata about what was set (for debug tracking).
   */
  set(prop: string, value: any): PropertyStoreEntry {
    const valueClass = classifyValue(value);

    // 1. Macros (multi-property operations)
    if (macros[prop]) {
      macros[prop](value, this.properties, true);
      return {
        realProp: prop,
        value: '[macro]',
        classification: valueClass
      };
    }

    // 2. Transform properties — skip if dynamic (functions leak as strings)
    if (['scale', 'rotate', 'skew', 'x', 'y'].includes(prop)) {
      if (valueClass === 'dynamic') {
        // Do NOT store — partitionForBuild will pick it up from the original
        return {
          realProp: 'transform',
          value: value,
          classification: 'dynamic'
        };
      }
      this.setTransform(prop, value);
      return {
        realProp: 'transform',
        value: this.buildTransformString(),
        classification: 'static'
      };
    }

    // 3. Shorthand → real CSS property
    const realProp = (shorthandMap as any)[prop] || prop;

    // 4. Token resolution
    const resolvedValue = this.resolveValue(value);

    // 5. Unit normalization (add px to bare numbers)
    const finalValue = this.addUnit(resolvedValue, realProp);

    // 6. Store
    this.properties[realProp] = finalValue;

    return {
      realProp,
      value: finalValue,
      classification: classifyValue(value)
    };
  }

  /** Get all collected properties (including transforms). */
  getAll(): Record<string, any> {
    const result = { ...this.properties };
    if (Object.keys(this.transforms).length > 0) {
      result.transform = this.buildTransformString();
    }
    return result;
  }

  /** Get raw properties without transform compilation. */
  getRaw(): Record<string, any> {
    return { ...this.properties };
  }

  /** Check if any properties have been collected. */
  isEmpty(): boolean {
    return Object.keys(this.properties).length === 0 && Object.keys(this.transforms).length === 0;
  }

  /** Clear all collected properties. */
  reset(): void {
    this.properties = {};
    this.transforms = {};
  }

  // ========================================================================
  // Private helpers
  // ========================================================================

  private setTransform(type: string, value: any): void {
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

    this.transforms[transformName] = `${value}${unit}`;
  }

  private buildTransformString(): string {
    return Object.entries(this.transforms)
      .map(([k, v]) => `${k}(${v})`)
      .join(' ');
  }

  private resolveValue(value: any): any {
    if (typeof value === 'function') return value;
    if (typeof value === 'string' && this.isTokenReference(value)) {
      // Use per-instance TokenResolver if available (avoids global state)
      if (this.tokenResolver) {
        const resolved = this.tokenResolver.resolve(value);
        if (resolved !== undefined && resolved !== null && resolved !== value) return resolved;
      } else {
        const resolved = resolveToken(value, true, null);
        if (resolved !== undefined && resolved !== null) return resolved;
      }
    }
    return value;
  }

  private isTokenReference(value: string): boolean {
    return value.includes('$') || value.includes('theme.') || value.includes('var(--');
  }

  private addUnit(value: any, prop: string): any {
    if (typeof value !== 'number') return value;
    if (UNITLESS.has(prop)) return value;
    return `${value}px`;
  }
}