// src/core/property-store.ts

/**
 * PropertyStore — Handles CSS property collection, shorthand expansion,
 * macro execution, token resolution, and unit normalization.
 * 
 * Extracted from StyleCollector to keep it focused on one responsibility.
 */

import { shorthandMap, macros } from '../compiler/utils/shorthands.js';
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
  'aspectRatio', 'gridRow', 'gridColumn', 'gridRowStart',
  'gridRowEnd', 'gridColumnStart', 'gridColumnEnd', 'strokeWidth',
  'strokeDashoffset', 'strokeDasharray'
]);

export class PropertyStore {
  private properties: Record<string, any> = {};
  private transforms: Record<string, string> = {};
  // TokenResolver removed — $token resolution moved to pipeline token-lowering pass

  constructor(tokens?: any) {
    // TokenResolver removed — $token values stored raw, resolved in pipeline
  }

  /**
   * Set a CSS property value. Handles macros, shorthands, tokens, and units.
   * Returns metadata about what was set (for debug tracking).
   */
  
  set(prop: string, value: any): PropertyStoreEntry {
    const valueClass = classifyValue(value);

    // 1. Macros
    if (macros[prop]) {
      macros[prop](value, this.properties, true);
      return {
        realProp: prop,
        value: '[macro]',
        classification: valueClass
      };
    }

    // 2. Transform properties
    if (['scale', 'rotate', 'skew', 'x', 'y'].includes(prop)) {
      if (valueClass === 'dynamic') {
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
        classification: valueClass
      };
    }

    // 3. Shorthand → real CSS property
    const realProp = (shorthandMap as any)[prop] || prop;

    // 4. Token resolution
    const resolvedValue = this.resolveValue(value);

    // 5. Unit normalization — normalize prop to camelCase for UNITLESS lookup
    const normalizedProp = realProp.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
    const finalValue = UNITLESS.has(normalizedProp) ? resolvedValue : this.addUnit(resolvedValue, realProp);

    // 6. Store
    this.properties[realProp] = finalValue;

    return {
      realProp,
      value: finalValue,
      classification: valueClass
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
    // $token values stored raw — resolved in pipeline token-lowering pass
    return value;
  }

  private isTokenReference(value: string): boolean {
    return value.includes('$') || value.includes('theme.') || value.includes('var(--');
  }

  private addUnit(value: any, prop: string): any {
    if (typeof value !== 'number') return value;
    const normalized = prop.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
    if (UNITLESS.has(normalized)) return value;
    return `${value}px`;
  }
}