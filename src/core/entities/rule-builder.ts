// src/core/entities/rule-builder.ts

import type { StyleObject, AtRule, NestedRule } from "@shared/types/index.js";

function hasStyles(r: AtRule): r is AtRule & { styles: StyleObject } {
  return "styles" in r;
}
function hasSteps(r: AtRule): r is AtRule & { steps: Record<string, any> } {
  return "steps" in r;
}

export interface RuleBuilderOptions {
  debug?: boolean;
  classPrefix?: string;
  tokens?: any;
}

function isPlainObject(v: any): boolean {
  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype
  );
}

// Fix #3: Shallow merge for CSS — no deep recursion for plain objects
// CSS property values are flat; nested objects mean structural keys that
// should be replaced, not deep-merged.
function shallowMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): void {
  for (const k of Object.keys(source)) {
    target[k] = source[k];
  }
}

// Fix #2: Normalize query strings for dedup keys
function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

// Fix #1: Check both underscore and non-underscore structural keys
function isStyleObjectEmpty(style: StyleObject | undefined): boolean {
  if (!style) return true;
  const anyStyle = style as any;
  if (typeof anyStyle.isEmpty === "function") return anyStyle.isEmpty();

  const hasAt =
    anyStyle.atRules?.length ||
    anyStyle._atRules?.length;
  const hasNested =
    anyStyle.nestedRules?.length ||
    anyStyle._nestedRules?.length;

  if (hasAt || hasNested) return false;

  if (anyStyle.getRaw) {
    const raw = anyStyle.getRaw();
    if (raw && Object.keys(raw).length > 0) return false;
    return true;
  }
  return Object.keys(anyStyle).every(
    (k) =>
      k === "selectors" ||
      k === "_atRules" ||
      k === "_nestedRules" ||
      k === "atRules" ||
      k === "nestedRules",
  );
}

export class RuleBuilder {
  private atRules: AtRule[] = [];
  private nestedRules: NestedRule[] = [];
  private mediaMap = new Map<string, AtRule>();
  private supportsMap = new Map<string, AtRule>();
  private containerMap = new Map<string, AtRule>();
  private layerMap = new Map<string, AtRule>();
  private keyframesMap = new Map<string, AtRule>();
  // Fix #4: Font-face dedup map
  private fontFaceMap = new Map<string, AtRule>();

  buildChild(
    fn: (childProxy: any) => void,
    createChildProxy: (opts?: RuleBuilderOptions) => any,
    opts: RuleBuilderOptions | boolean = {},
  ): StyleObject {
    const normalized: RuleBuilderOptions =
      typeof opts === "boolean" ? { debug: opts } : opts;
    const childProxy = createChildProxy({
      debug: normalized.debug ?? false,
      classPrefix: normalized.classPrefix,
      tokens: normalized.tokens,
    });
    fn(childProxy);
    return (childProxy as any).build
      ? (childProxy as any).build()
      : childProxy.$el();
  }

  addMedia(query: string, childResult: StyleObject): void {
    if (isStyleObjectEmpty(childResult)) return;
    const key = normalizeQuery(query);
    const existing = this.mediaMap.get(key);
    if (existing && hasStyles(existing)) {
      shallowMerge(existing.styles as any, childResult as any);
    } else {
      const rule: AtRule = { type: "media", query: key, styles: childResult as any };
      this.atRules.push(rule);
      this.mediaMap.set(key, rule);
    }
  }

  addSupports(condition: string, childResult: StyleObject): void {
    if (isStyleObjectEmpty(childResult)) return;
    const key = normalizeQuery(condition);
    const existing = this.supportsMap.get(key);
    if (existing && hasStyles(existing)) {
      shallowMerge(existing.styles as any, childResult as any);
    } else {
      const rule: AtRule = {
        type: "supports",
        condition: key,
        styles: childResult as any,
      };
      this.atRules.push(rule);
      this.supportsMap.set(key, rule);
    }
  }

  addContainer(condition: string, childResult: StyleObject): void {
    if (isStyleObjectEmpty(childResult)) return;
    const key = normalizeQuery(condition);
    const existing = this.containerMap.get(key);
    if (existing && hasStyles(existing)) {
      shallowMerge(existing.styles as any, childResult as any);
    } else {
      const rule: AtRule = {
        type: "container",
        condition: key,
        styles: childResult as any,
      };
      this.atRules.push(rule);
      this.containerMap.set(key, rule);
    }
  }

  addLayer(name: string, childResult: StyleObject): void {
    if (isStyleObjectEmpty(childResult)) return;
    const key = normalizeQuery(name);
    const existing = this.layerMap.get(key);
    if (existing && hasStyles(existing)) {
      shallowMerge(existing.styles as any, childResult as any);
    } else {
      const rule: AtRule = { type: "layer", name: key, styles: childResult as any };
      this.atRules.push(rule);
      this.layerMap.set(key, rule);
    }
  }

  addNested(selector: string, childResult: StyleObject): void {
    this.nestedRules.push({ selector, styles: childResult });
  }

  addKeyframes(name: string, steps: Record<string, any>): void {
    const key = normalizeQuery(name);
    const existing = this.keyframesMap.get(key);
    if (existing && hasSteps(existing)) {
      existing.steps = existing.steps || {};
      shallowMerge(existing.steps as any, steps);
    } else {
      const rule: AtRule = { type: "keyframes", name: key, steps } as any;
      this.atRules.push(rule);
      this.keyframesMap.set(key, rule);
    }
  }

  // Fix #4: Dedup font-face by properties signature
  addFontFace(properties: Record<string, string>): void {
    const signature = Object.entries(properties)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(";");

    if (this.fontFaceMap.has(signature)) return;

    const rule: AtRule = { type: "font-face", properties } as any;
    this.atRules.push(rule);
    this.fontFaceMap.set(signature, rule);
  }

  getAtRules(): AtRule[] {
    return [...this.atRules];
  }
  getNestedRules(): NestedRule[] {
    return [...this.nestedRules];
  }
  hasRules(): boolean {
    return this.atRules.length > 0 || this.nestedRules.length > 0;
  }

  reset(): void {
    this.atRules = [];
    this.nestedRules = [];
    this.mediaMap.clear();
    this.supportsMap.clear();
    this.containerMap.clear();
    this.layerMap.clear();
    this.keyframesMap.clear();
    this.fontFaceMap.clear();
  }
}