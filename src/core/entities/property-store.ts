// src/core/entities/property-store.ts

import { shorthandMap, macros } from "@compiler/utils/shorthands.js";
import {
  classifyValue,
  type ValueClass,
} from "../usecases/value-classifier.js";

export interface PropertyStoreEntry {
  realProp: string;
  value: any;
  classification: ValueClass;
}
interface TransformEntry {
  value: string;
  rawValue: any;
  classification: ValueClass;
}

// Fix #1: Single source of truth — import from shared constants
// (If you don't have UNITLESS in shared/constants yet, move this Set there
//  and import it. For now, keep it here as canonical.)
const UNITLESS = new Set([
  "zIndex", "opacity", "flex", "flexGrow", "flexShrink", "order",
  "fontWeight", "lineHeight", "scale", "zoom", "animationIterationCount",
  "columnCount", "orphans", "widows", "tabSize", "fillOpacity",
  "strokeOpacity", "aspectRatio", "gridRow", "gridColumn",
  "gridRowStart", "gridRowEnd", "gridColumnStart", "gridColumnEnd",
  "strokeWidth", "strokeDashoffset", "strokeDasharray", "gridArea",
  "lineClamp", "WebkitLineClamp",
]);

const TRANSFORM_ORDER = [
  "translateX", "translateY", "rotate", "scale", "skew",
] as const;
const TRANSFORM_ALIAS: Record<string, string> = {
  x: "translateX",
  y: "translateY",
  scale: "scale",
  rotate: "rotate",
  skew: "skew",
};
const TRANSFORM_PROPS = new Set([
  "scale", "rotate", "skew", "x", "y", "translateX", "translateY",
]);

// Fix #3: Max depth for macro recursion
const MAX_MACRO_DEPTH = 8;

export class PropertyStore {
  private properties: Record<string, any> = {};
  private transforms: Record<string, TransformEntry> = {};
  // Fix #5: Cache transform string — invalidate in setTransform
  private cachedTransformString: string | null = null;
  // Fix #6: tokens arg retained for future use, documented as reserved
  private tokens: any;

  constructor(tokens?: any) {
    this.tokens = tokens;
  }

  set(prop: string, value: any, depth = 0): PropertyStoreEntry {
    // Fix #3: Circular macro recursion guard
    if (depth > MAX_MACRO_DEPTH) {
      throw new Error(
        `[ChainCSS] Circular macro reference detected at "${prop}". Max depth ${MAX_MACRO_DEPTH} exceeded.`,
      );
    }

    const valueClass = classifyValue(value);

    if (valueClass === "invalid") {
      if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
        console.warn(`[ChainCSS] Invalid value for "${prop}":`, value);
      }
      return { realProp: prop, value: "[invalid]", classification: "invalid" };
    }

    const macroFn = (macros as any)[prop];
    if (macroFn) {
      const tmp: Record<string, any> = {};
      macroFn(value, tmp, true);
      if (tmp[prop] === value) delete tmp[prop];
      let overall: ValueClass = "static";
      for (const [k, v] of Object.entries(tmp)) {
        const r = this.set(k, v, depth + 1); // Pass depth to recursive calls
        if (r.classification === "dynamic") overall = "dynamic";
      }
      return { realProp: prop, value: "[macro]", classification: overall };
    }

    if (TRANSFORM_PROPS.has(prop)) {
      this.setTransform(prop, value, valueClass);
      const isDyn = Object.values(this.transforms).some(
        (t) => t.classification === "dynamic",
      )
        ? "dynamic"
        : "static";
      return {
        realProp: "transform",
        value: this.buildTransformString(),
        classification: isDyn,
      };
    }

    const realProp = (shorthandMap as any)[prop] || prop;

    const camel = realProp.includes("-")
      ? realProp.replace(/-([a-z])/g, (_match: string, c: string) =>
          c.toUpperCase(),
        )
      : realProp;

    // Fix #2: Don't format dynamic values — keep raw function
    let finalValue = value;
    if (valueClass === "dynamic") {
      // Keep function as-is for runtime resolution
      finalValue = value;
    } else if (typeof value === "number" && !UNITLESS.has(camel)) {
      finalValue = `${value}px`;
    }

    this.properties[realProp] = finalValue;
    // Fix #4: Store both kebab and camel keys for lookups
    this.properties[prop] = finalValue;
    return { realProp, value: finalValue, classification: valueClass };
  }

  get(prop: string): any {
    // Fix #4: Check both original and normalized keys
    if (prop in this.properties) return this.properties[prop];
    const tName = (TRANSFORM_ALIAS as any)[prop] || prop;
    if (tName in this.transforms) return this.transforms[tName].rawValue;
    if (prop === "transform" && Object.keys(this.transforms).length)
      return this.buildTransformString();
    return undefined;
  }

  getAll(): Record<string, any> {
    const r = { ...this.properties };
    if (Object.keys(this.transforms).length)
      r.transform = this.buildTransformString();
    return r;
  }

  getRaw(): Record<string, any> {
    return { ...this.properties };
  }
  isEmpty(): boolean {
    return (
      Object.keys(this.properties).length === 0 &&
      Object.keys(this.transforms).length === 0
    );
  }
  reset(): void {
    this.properties = {};
    this.transforms = {};
    this.cachedTransformString = null;
  }

  private setTransform(
    type: string,
    value: any,
    classification: ValueClass,
  ): void {
    const name = (TRANSFORM_ALIAS as any)[type] || type;

    // Fix #2: Don't stringify dynamic values — keep raw for runtime
    if (classification === "dynamic") {
      this.transforms[name] = {
        value: "",
        rawValue: value,
        classification,
      };
      this.cachedTransformString = null;
      return;
    }

    let formatted = String(value);
    if (typeof value === "number") {
      if (type === "x" || type === "y") formatted = `${value}px`;
      else if (type === "rotate" || type === "skew") formatted = `${value}deg`;
    }
    this.transforms[name] = {
      value: formatted,
      rawValue: value,
      classification,
    };
    this.cachedTransformString = null;
  }

  private buildTransformString(): string {
    // Fix #5: Return cached value if available
    if (this.cachedTransformString !== null) {
      return this.cachedTransformString;
    }

    const ordered: string[] = [];
    for (const k of TRANSFORM_ORDER) {
      if (k in this.transforms) {
        const entry = this.transforms[k];
        if (entry.classification === "dynamic") {
          ordered.push(`${k}(var(--chain-transform-${k}))`);
        } else {
          ordered.push(`${k}(${entry.value})`);
        }
      }
    }
    for (const [k, v] of Object.entries(this.transforms)) {
      if (!(TRANSFORM_ORDER as readonly string[]).includes(k)) {
        if (v.classification === "dynamic") {
          ordered.push(`${k}(var(--chain-transform-${k}))`);
        } else {
          ordered.push(`${k}(${v.value})`);
        }
      }
    }
    this.cachedTransformString = ordered.join(" ");
    return this.cachedTransformString;
  }
}