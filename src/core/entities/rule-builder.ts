// src/core/entities/rule-builder.ts

import type { StyleObject, AtRule, NestedRule } from "@shared/types/index.js";

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

// Fast shallow merge for CSS objects — no Reflect, no defineProperty
function shallowMerge(
  target: Record<string, any>,
  source: Record<string, any>,
): void {
  for (const k in source) {
    if (!Object.prototype.hasOwnProperty.call(source, k)) continue;
    const sv = source[k];
    const tv = target[k];
    if (isPlainObject(sv) && isPlainObject(tv)) {
      shallowMerge(tv, sv);
    } else {
      target[k] = sv;
    }
  }
}

function isStyleObjectEmpty(style: StyleObject | undefined): boolean {
  if (!style) return true;
  const anyStyle = style as any;
  if (typeof anyStyle.isEmpty === "function") return anyStyle.isEmpty();
  // getRaw may return { } even when style has atRules — check both
  if (anyStyle.getRaw) {
    const raw = anyStyle.getRaw();
    if (raw && Object.keys(raw).length > 0) return false;
    // if raw empty but has atRules/nestedRules, not empty
    if (anyStyle.atRules?.length || anyStyle.nestedRules?.length) return false;
    return true;
  }
  return Object.keys(anyStyle).length === 0;
}

export class RuleBuilder {
  private atRules: AtRule[] = [];
  private nestedRules: NestedRule[] = [];
  // Only media/supports/container/layer/keyframes benefit from dedup — nested should NOT dedup for compound components
  private mediaMap = new Map<string, AtRule>();
  private supportsMap = new Map<string, AtRule>();
  private containerMap = new Map<string, AtRule>();
  private layerMap = new Map<string, AtRule>();
  private keyframesMap = new Map<string, AtRule>();

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
    const existing = this.mediaMap.get(query);
    if (existing && existing.styles) {
      shallowMerge(existing.styles as any, childResult as any);
    } else {
      const rule: AtRule = { type: "media", query, styles: childResult as any };
      this.atRules.push(rule);
      this.mediaMap.set(query, rule);
    }
  }

  addSupports(condition: string, childResult: StyleObject): void {
    if (isStyleObjectEmpty(childResult)) return;
    const existing = this.supportsMap.get(condition);
    if (existing && existing.styles) {
      shallowMerge(existing.styles as any, childResult as any);
    } else {
      const rule: AtRule = {
        type: "supports",
        condition,
        styles: childResult as any,
      };
      this.atRules.push(rule);
      this.supportsMap.set(condition, rule);
    }
  }

  addContainer(condition: string, childResult: StyleObject): void {
    if (isStyleObjectEmpty(childResult)) return;
    const existing = this.containerMap.get(condition);
    if (existing && existing.styles) {
      shallowMerge(existing.styles as any, childResult as any);
    } else {
      const rule: AtRule = {
        type: "container",
        condition,
        styles: childResult as any,
      };
      this.atRules.push(rule);
      this.containerMap.set(condition, rule);
    }
  }

  addLayer(name: string, childResult: StyleObject): void {
    if (isStyleObjectEmpty(childResult)) return;
    const existing = this.layerMap.get(name);
    if (existing && existing.styles) {
      shallowMerge(existing.styles as any, childResult as any);
    } else {
      const rule: AtRule = { type: "layer", name, styles: childResult as any };
      this.atRules.push(rule);
      this.layerMap.set(name, rule);
    }
  }

  // FIX: Do NOT merge nested selectors — react compound test expects 2 entries for '& .child' + '& .child:hover'
  // This also matches original pre-merge behavior that gave you 608 passing
  addNested(selector: string, childResult: StyleObject): void {
    this.nestedRules.push({ selector, styles: childResult });
  }

  addKeyframes(name: string, steps: Record<string, any>): void {
    const existing = this.keyframesMap.get(name);
    if (existing) {
      existing.steps = existing.steps || {};
      shallowMerge(existing.steps as any, steps);
    } else {
      const rule: AtRule = { type: "keyframes", name, steps } as any;
      this.atRules.push(rule);
      this.keyframesMap.set(name, rule);
    }
  }

  addFontFace(properties: Record<string, string>): void {
    this.atRules.push({ type: "font-face", properties } as any);
  }

  // FIX: No deep clone — shallow copy is enough and 10x faster. Deep clone was causing 12.41s collect
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
  }
}
