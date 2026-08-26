// src/core/entities/browser-style-collector.ts

import { createStyleProxy } from "@core/entities/style-proxy.js";
import { PropertyStore, type PropertyStoreEntry } from "@core/entities/property-store.js";
import { RuleBuilder } from "@core/entities/rule-builder.js";
import { classifyValue } from "@core/usecases/value-classifier.js";
import { DebugCollector, type Explanation } from "@core/entities/debug-collector.js";
export type { Explanation } from "@core/entities/debug-collector.js";
import { macros as macroRegistry } from "@compiler/utils/shorthands.js";
import type {
  ChainProxy,
  StyleObject as _StyleObject,
  AtRule as _AtRule,
  NestedRule as _NestedRule,
} from "@shared/types/index.js";
import { getBreakpoint } from "@compiler/breakpoints.js";
import { hashString } from "@shared/utils/browser.js";
import type {
  GridOptions,
  FlexOptions,
  AnimationOptions,
  BackgroundOptions,
  TypographyOptions,
  BoxOptions,
  PositionOptions,
  TransitionOptions,
  TransformOptions,
  FilterOptions,
  ShadowOptions,
  ContainerOptions,
  OutlineOptions,
  ScrollOptions,
  ListOptions,
} from "@shared/types/shorthand-types.js";

export type StyleObject = _StyleObject;
export type AtRule = _AtRule;
export type NestedRule = _NestedRule;

function px(v: any): string {
  if (typeof v === "number") return `${v}px`;
  return v as string;
}

// Fix #3: Hoisted UNITLESS sets — no more re-creation per set() call
const UNITLESS_BASE = new Set([
  "zIndex", "opacity", "flex", "flexGrow", "flexShrink", "order",
  "fontWeight", "lineHeight", "scale", "zoom", "animationIterationCount",
]);

const UNITLESS_RESPONSIVE_EXTRAS = new Set([
  "columnCount", "orphans", "widows", "tabSize", "fillOpacity",
  "strokeOpacity", "aspectRatio", "gridRow", "gridColumn",
]);

function isUnitless(prop: string, includeResponsive = false): boolean {
  if (UNITLESS_BASE.has(prop)) return true;
  if (includeResponsive && UNITLESS_RESPONSIVE_EXTRAS.has(prop)) return true;
  return false;
}

export class StyleCollector {
  private props: PropertyStore;
  private rules: RuleBuilder;
  private debugger: DebugCollector;
  private classes: string[] = [];
  private _mixed = false;
  private classPrefix: string;
  private pseudoStore: PropertyStore | null = null;
  private pseudoName: string = "";
  private _intents: string[] = [];

  constructor(
  private options?: { debug?: boolean; classPrefix?: string; tokens?: any },
  ) {
    this.props = new PropertyStore(options?.tokens);
    this.rules = new RuleBuilder();
    this.debugger = new DebugCollector(options?.debug ?? false);
    this.classPrefix = options?.classPrefix || "chain-";
  }

  markMixed(): this {
    this._mixed = true;
    return this;
  }
  isMixed(): boolean {
    return this._mixed;
  }

  set(prop: string, value: any): this {
    // Responsive named breakpoints / theme variants
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const bpKeys = Object.keys(value);

      // Theme variants with explicit wrapper
      if (
        "theme" in value &&
        typeof value.theme === "object" &&
        value.theme !== null
      ) {
        const themeValues = value.theme as Record<string, any>;
        const themeValueKeys = Object.keys(themeValues); // Fix #1: renamed from shadowed themeKeys
        const firstKey = themeValueKeys[0];

        // Fix #5: Mark mixed if base theme value is dynamic
        if (firstKey && classifyValue(themeValues[firstKey]) === "dynamic") {
          this.markMixed();
        }
        this.props.set(prop, themeValues[firstKey]);

        for (const [theme, themeValue] of Object.entries(themeValues)) {
          if (theme === firstKey) continue;
          if (themeValue !== undefined && themeValue !== null) {
            let finalValue = themeValue;
            if (typeof themeValue === "number" && !isUnitless(prop)) {
              finalValue = px(themeValue);
            }
            this.rules.addNested(`[data-theme="${theme}"] &`, {
              [prop]: finalValue,
            } as any);
          }
        }
        return this;
      }

      // Responsive breakpoints
      const isResponsive = bpKeys.some((k) => k === "base" || getBreakpoint(k));
      if (isResponsive) {
        // Set base value
        if ("base" in value) {
          // Fix #5: Mark mixed if base responsive value is dynamic
          if (classifyValue(value.base) === "dynamic") this.markMixed();
          this.props.set(prop, value.base);
          this.debugger.log(
            prop,
            { realProp: prop, value: value.base, classification: classifyValue(value.base) },
            value.base,
            "root",
          );
        }
        // Add media queries for each breakpoint
        for (const [bp, bpValue] of Object.entries(value)) {
          if (bp === "base") continue;
          const bpQuery = getBreakpoint(bp);
          if (bpQuery && bpValue !== undefined && bpValue !== null) {
            let finalValue = bpValue;
            if (typeof bpValue === "number" && !isUnitless(prop, true)) {
              finalValue = px(bpValue); // Fix #3: use px() helper
            }
            this.rules.addMedia(bpQuery, { [prop]: finalValue } as StyleObject);
          }
        }
        return this;
      }
    }

    // Existing behavior
    if (classifyValue(value) === "dynamic") this.markMixed();
    const target = this.pseudoStore || this.props;
    const entry: PropertyStoreEntry = target.set(prop, value);
    this.debugger.log(
      prop,
      entry,
      value,
      this.pseudoStore ? this.pseudoName : "root",
    );
    return this;
  }

  private childOpts() {
    return {
      debug: this.debugger.isEnabled(),
      classPrefix: this.classPrefix,
      tokens: this.options?.tokens,
    };
  }
  private createChildProxy() {
    return createStyleProxyForChild(this.childOpts());
  }
  private buildChild(fn: (c: ChainProxy) => void) {
    return this.rules.buildChild(
      fn,
      () => this.createChildProxy(),
      this.debugger.isEnabled(),
    );
  }
  private getDisplay(): string | undefined {
    const fromProps = (this.props as any).get?.("display");
    if (fromProps !== undefined) return fromProps;
    return (this.props as any).properties?.["display"];
  }

  grid(options?: GridOptions | string): this {
    if (options === undefined) return this.set("display", "grid");
    if (typeof options === "string") return this.set("grid", options);
    if (typeof options === "object") {
      if (this.getDisplay() !== "inline-grid") this.set("display", "grid");
      if (options.columns) this.set("gridTemplateColumns", options.columns as any);
      if (options.rows) this.set("gridTemplateRows", options.rows as any);
      if (options.gap !== undefined) this.set("gap", options.gap as any);
      else {
        if (options.columnGap !== undefined) this.set("columnGap", options.columnGap as any);
        if (options.rowGap !== undefined) this.set("rowGap", options.rowGap as any);
      }
      if (options.area) this.set("gridArea", options.area as any);
      if (options.autoFlow) this.set("gridAutoFlow", options.autoFlow as any);
      if (options.autoColumns !== undefined) this.set("gridAutoColumns", options.autoColumns as any);
      if (options.autoRows !== undefined) this.set("gridAutoRows", options.autoRows as any);
      if (options.template) this.set("gridTemplate", options.template as any);
      if (options.c && !options.columns) this.set("gridTemplateColumns", options.c as any);
      if (options.r && !options.rows) this.set("gridTemplateRows", options.r as any);
      if (options.g !== undefined && options.gap === undefined) this.set("gap", options.g as any);
      if (options.a && !options.area) this.set("gridArea", options.a as any);
    }
    return this;
  }

  flex(options?: FlexOptions | string): this {
    if (options === undefined) return this.set("display", "flex");
    if (typeof options === "string") return this.set("flex", options);
    if (typeof options === "object") {
      if (this.getDisplay() !== "inline-flex") this.set("display", "flex");

      // Direction alias map for shorthand values
      const directionMap: Record<string, string> = {
        'row': 'row',
        'row-reverse': 'row-reverse',
        'col': 'column',
        'column': 'column',
        'column-reverse': 'column-reverse',
      };

      // Helper to resolve Dynamic<T> values
      const resolveDynamic = (val: any): any => {
        return typeof val === 'function' ? val() : val;
      };

      if (options.direction) {
        const direction = resolveDynamic(options.direction);
        this.set("flexDirection", directionMap[direction] || direction);
      }
      if (options.wrap) {
        this.set("flexWrap", resolveDynamic(options.wrap));
      }
      if (options.grow !== undefined) {
        this.set("flexGrow", resolveDynamic(options.grow));
      }
      if (options.shrink !== undefined) {
        this.set("flexShrink", resolveDynamic(options.shrink));
      }
      if (options.basis !== undefined) {
        this.set("flexBasis", resolveDynamic(options.basis));
      }
      if (options.align) {
        this.set("alignItems", resolveDynamic(options.align));
      }
      if (options.justify) {
        this.set("justifyContent", resolveDynamic(options.justify));
      }
      if (options.alignContent) {
        this.set("alignContent", resolveDynamic(options.alignContent));
      }
      if (options.alignSelf) {
        this.set("alignSelf", resolveDynamic(options.alignSelf));
      }
      if (options.gap !== undefined) {
        this.set("gap", resolveDynamic(options.gap));
      }

      // Shorthand aliases
      if (options.d && !options.direction) {
        const dValue = resolveDynamic(options.d);
        this.set("flexDirection", directionMap[dValue] || dValue);
      }
      if (options.w && !options.wrap) {
        this.set("flexWrap", resolveDynamic(options.w));
      }
      if (options.gr !== undefined && options.grow === undefined) {
        this.set("flexGrow", resolveDynamic(options.gr));
      }
      if (options.sh !== undefined && options.shrink === undefined) {
        this.set("flexShrink", resolveDynamic(options.sh));
      }
      if (options.b !== undefined && options.basis === undefined) {
        this.set("flexBasis", resolveDynamic(options.b));
      }
      if (options.ai && !options.align) {
        this.set("alignItems", resolveDynamic(options.ai));
      }
      if (options.jc && !options.justify) {
        this.set("justifyContent", resolveDynamic(options.jc));
      }
      if (options.f) {
        this.set("flex", resolveDynamic(options.f));
      }
    }
    return this;
  }

  animation(options: AnimationOptions): this {
    if (options.name) this.set("animationName", options.name as any);
    if (options.duration) this.set("animationDuration", options.duration as any);
    if (options.timing) this.set("animationTimingFunction", options.timing as any);
    if (options.delay) this.set("animationDelay", options.delay as any);
    if (options.iterationCount !== undefined) this.set("animationIterationCount", options.iterationCount as any);
    if (options.direction) this.set("animationDirection", options.direction as any);
    if (options.fillMode) this.set("animationFillMode", options.fillMode as any);
    if (options.playState) this.set("animationPlayState", options.playState as any);
    if (options.n && !options.name) this.set("animationName", options.n as any);
    if (options.d && !options.duration) this.set("animationDuration", options.d as any);
    if (options.t && !options.timing) this.set("animationTimingFunction", options.t as any);
    if (options.dl && !options.delay) this.set("animationDelay", options.dl as any);
    if (options.i !== undefined && options.iterationCount === undefined) this.set("animationIterationCount", options.i as any);
    if (options.a) this.set("animation", options.a as any);
    return this;
  }

  background(options?: BackgroundOptions | string): this {
    if (options === undefined) return this;
    if (typeof options === "string") return this.set("background", options);
    if (typeof options === "object") {
      if (options.color) this.set("backgroundColor", options.color as any);
      if (options.image) this.set("backgroundImage", options.image as any);
      if (options.position) this.set("backgroundPosition", options.position as any);
      if (options.size) this.set("backgroundSize", options.size as any);
      if (options.repeat) this.set("backgroundRepeat", options.repeat as any);
      if (options.attachment) this.set("backgroundAttachment", options.attachment as any);
      if (options.origin) this.set("backgroundOrigin", options.origin as any);
      if (options.clip) this.set("backgroundClip", options.clip as any);
      if (options.blendMode) this.set("backgroundBlendMode", options.blendMode as any);
      if (options.c && !options.color) this.set("backgroundColor", options.c as any);
      if (options.i && !options.image) this.set("backgroundImage", options.i as any);
      if (options.p && !options.position) this.set("backgroundPosition", options.p as any);
      if (options.s && !options.size) this.set("backgroundSize", options.s as any);
      if (options.r && !options.repeat) this.set("backgroundRepeat", options.r as any);
      if (options.bg) this.set("background", options.bg as any);
    }
    return this;
  }

  typography(options: TypographyOptions): this {
    if (options.fontFamily) this.set("fontFamily", options.fontFamily as any);
    if (options.fontSize !== undefined) this.set("fontSize", options.fontSize as any);
    if (options.fontWeight !== undefined) this.set("fontWeight", options.fontWeight as any);
    if (options.fontStyle) this.set("fontStyle", options.fontStyle as any);
    if (options.lineHeight !== undefined) this.set("lineHeight", options.lineHeight as any);
    if (options.letterSpacing !== undefined) this.set("letterSpacing", options.letterSpacing as any);
    if (options.textAlign) this.set("textAlign", options.textAlign as any);
    if (options.textTransform) this.set("textTransform", options.textTransform as any);
    if (options.textDecoration) this.set("textDecoration", options.textDecoration as any);
    if (options.textIndent !== undefined) this.set("textIndent", options.textIndent as any);
    if (options.wordSpacing !== undefined) this.set("wordSpacing", options.wordSpacing as any);
    if (options.whiteSpace) this.set("whiteSpace", options.whiteSpace as any);
    if (options.wordBreak) this.set("wordBreak", options.wordBreak as any);
    if (options.color) this.set("color", options.color as any);
    if (options.opacity !== undefined) this.set("opacity", options.opacity as any);
    if (options.ff && !options.fontFamily) this.set("fontFamily", options.ff as any);
    if (options.fs !== undefined && options.fontSize === undefined) this.set("fontSize", options.fs as any);
    if (options.fw !== undefined && options.fontWeight === undefined) this.set("fontWeight", options.fw as any);
    if (options.lh !== undefined && options.lineHeight === undefined) this.set("lineHeight", options.lh as any);
    if (options.ta && !options.textAlign) this.set("textAlign", options.ta as any);
    if (options.tt && !options.textTransform) this.set("textTransform", options.tt as any);
    if (options.f) this.set("font", options.f as any);
    return this;
  }

  box(options: BoxOptions): this {
    if (options.margin !== undefined) this.set("margin", options.margin as any);
    if (options.marginTop !== undefined) this.set("marginTop", options.marginTop as any);
    if (options.marginRight !== undefined) this.set("marginRight", options.marginRight as any);
    if (options.marginBottom !== undefined) this.set("marginBottom", options.marginBottom as any);
    if (options.marginLeft !== undefined) this.set("marginLeft", options.marginLeft as any);
    if (options.padding !== undefined) this.set("padding", options.padding as any);
    if (options.paddingTop !== undefined) this.set("paddingTop", options.paddingTop as any);
    if (options.paddingRight !== undefined) this.set("paddingRight", options.paddingRight as any);
    if (options.paddingBottom !== undefined) this.set("paddingBottom", options.paddingBottom as any);
    if (options.paddingLeft !== undefined) this.set("paddingLeft", options.paddingLeft as any);
    if (options.border) this.set("border", options.border as any);
    if (options.borderRadius !== undefined) this.set("borderRadius", options.borderRadius as any);
    if (options.borderWidth !== undefined) this.set("borderWidth", options.borderWidth as any);
    if (options.borderColor) this.set("borderColor", options.borderColor as any);
    if (options.borderStyle) this.set("borderStyle", options.borderStyle as any);
    if (options.borderTop) this.set("borderTop", options.borderTop as any);
    if (options.borderRight) this.set("borderRight", options.borderRight as any);
    if (options.borderBottom) this.set("borderBottom", options.borderBottom as any);
    if (options.borderLeft) this.set("borderLeft", options.borderLeft as any);
    if (options.width !== undefined) this.set("width", options.width as any);
    if (options.minWidth !== undefined) this.set("minWidth", options.minWidth as any);
    if (options.maxWidth !== undefined) this.set("maxWidth", options.maxWidth as any);
    if (options.height !== undefined) this.set("height", options.height as any);
    if (options.minHeight !== undefined) this.set("minHeight", options.minHeight as any);
    if (options.maxHeight !== undefined) this.set("maxHeight", options.maxHeight as any);
    if (options.overflow) this.set("overflow", options.overflow as any);
    if (options.overflowX) this.set("overflowX", options.overflowX as any);
    if (options.overflowY) this.set("overflowY", options.overflowY as any);
    if (options.m !== undefined && options.margin === undefined) this.set("margin", options.m as any);
    if (options.p !== undefined && options.padding === undefined) this.set("padding", options.p as any);
    if (options.br !== undefined && options.borderRadius === undefined) this.set("borderRadius", options.br as any);
    if (options.w !== undefined && options.width === undefined) this.set("width", options.w as any);
    if (options.h !== undefined && options.height === undefined) this.set("height", options.h as any);
    return this;
  }

  position(options: PositionOptions): this {
    if (options.type) this.set("position", options.type as any);
    if (options.top !== undefined) this.set("top", options.top as any);
    if (options.right !== undefined) this.set("right", options.right as any);
    if (options.bottom !== undefined) this.set("bottom", options.bottom as any);
    if (options.left !== undefined) this.set("left", options.left as any);
    if (options.inset !== undefined) this.set("inset", options.inset as any);
    if (options.zIndex !== undefined) this.set("zIndex", options.zIndex as any);
    if (options.t && !options.type) this.set("position", options.t as any);
    if (options.z !== undefined && options.zIndex === undefined) this.set("zIndex", options.z as any);
    return this;
  }

  transition(options?: TransitionOptions | string): this {
    if (options === undefined) return this;
    if (typeof options === "string") return this.set("transition", options);
    if (typeof options === "object") {
      if (options.property) this.set("transitionProperty", options.property as any);
      if (options.duration) this.set("transitionDuration", options.duration as any);
      if (options.timing) this.set("transitionTimingFunction", options.timing as any);
      if (options.delay) this.set("transitionDelay", options.delay as any);
      if (options.behavior) this.set("transitionBehavior", options.behavior as any);
      if (options.p && !options.property) this.set("transitionProperty", options.p as any);
      if (options.d && !options.duration) this.set("transitionDuration", options.d as any);
      if (options.t && !options.timing) this.set("transitionTimingFunction", options.t as any);
      if (options.tr) this.set("transition", options.tr as any);
    }
    return this;
  }

  transform(options?: TransformOptions | string): this {
    if (typeof options === "string") return this.set("transform", options);
    if (options === undefined) return this;
    if (typeof options === "object") {
      const parts: string[] = [];
      if (options.translate) parts.push(`translate(${px(options.translate)})`);
      if (options.translateX !== undefined) parts.push(`translateX(${px(options.translateX)})`);
      if (options.translateY !== undefined) parts.push(`translateY(${px(options.translateY)})`);
      if (options.translateZ !== undefined) parts.push(`translateZ(${px(options.translateZ)})`);
      if (options.scale !== undefined) parts.push(`scale(${options.scale})`);
      if (options.scaleX !== undefined) parts.push(`scaleX(${options.scaleX})`);
      if (options.scaleY !== undefined) parts.push(`scaleY(${options.scaleY})`);
      if (options.rotate) parts.push(`rotate(${options.rotate})`);
      if (options.skew) parts.push(`skew(${options.skew})`);
      if (options.skewX !== undefined) parts.push(`skewX(${options.skewX})`);
      if (options.skewY !== undefined) parts.push(`skewY(${options.skewY})`);
      if (options.origin) this.set("transformOrigin", options.origin as any);
      if (parts.length > 0) this.set("transform", parts.join(" "));
    }
    return this;
  }

  filter(options: FilterOptions | string): this {
    if (typeof options === "string") return this.set("filter", options);
    const parts: string[] = [];
    if (options.blur !== undefined) parts.push(`blur(${typeof options.blur === "number" ? options.blur + "px" : options.blur})`);
    if (options.brightness !== undefined) parts.push(`brightness(${options.brightness})`);
    if (options.contrast !== undefined) parts.push(`contrast(${options.contrast})`);
    if (options.grayscale !== undefined) parts.push(`grayscale(${options.grayscale})`);
    if (options.hueRotate) parts.push(`hue-rotate(${options.hueRotate})`);
    if (options.invert !== undefined) parts.push(`invert(${options.invert})`);
    if (options.filterOpacity !== undefined) parts.push(`opacity(${options.filterOpacity})`);
    if (options.saturate !== undefined) parts.push(`saturate(${options.saturate})`);
    if (options.sepia !== undefined) parts.push(`sepia(${options.sepia})`);
    if (options.dropShadow) parts.push(`drop-shadow(${options.dropShadow})`);
    if (options.backdrop) this.set("backdropFilter", options.backdrop as any);
    if (parts.length > 0) this.set("filter", parts.join(" "));
    return this;
  }

  shadow(options: ShadowOptions | string): this {
    if (typeof options === "string") return this.set("boxShadow", options);
    if (options.box) this.set("boxShadow", options.box as any);
    else if (options.x !== undefined || options.y !== undefined) {
      const x = px(options.x ?? 0);
      const y = px(options.y ?? 0);
      const blur = px(options.blur ?? 0);
      const spread = options.spread !== undefined ? ` ${px(options.spread)}` : "";
      const color = options.color ? ` ${options.color}` : "";
      const inset = options.inset ? " inset" : "";
      this.set("boxShadow", `${x} ${y} ${blur}${spread}${color}${inset}`);
    }
    if (options.text) this.set("textShadow", options.text as any);
    return this;
  }

  containerQuery(options: ContainerOptions): this {
    if (options.type) this.set("containerType", options.type as any);
    if (options.name) this.set("containerName", options.name as any);
    return this;
  }

  outline(options: OutlineOptions): this {
    if (options.width !== undefined) this.set("outlineWidth", options.width as any);
    if (options.style) this.set("outlineStyle", options.style as any);
    if (options.color) this.set("outlineColor", options.color as any);
    if (options.offset !== undefined) this.set("outlineOffset", options.offset as any);
    if (options.w !== undefined && options.width === undefined) this.set("outlineWidth", options.w as any);
    if (options.s && !options.style) this.set("outlineStyle", options.s as any);
    if (options.c && !options.color) this.set("outlineColor", options.c as any);
    if (options.o) this.set("outline", options.o as any);
    return this;
  }

  scroll(options: ScrollOptions): this {
    if (options.behavior) this.set("scrollBehavior", options.behavior as any);
    if (options.snapType) this.set("scrollSnapType", options.snapType as any);
    if (options.snapAlign) this.set("scrollSnapAlign", options.snapAlign as any);
    if (options.snapStop) this.set("scrollSnapStop", options.snapStop as any);
    if (options.margin !== undefined) this.set("scrollMargin", options.margin as any);
    if (options.marginTop !== undefined) this.set("scrollMarginTop", options.marginTop as any);
    if (options.marginRight !== undefined) this.set("scrollMarginRight", options.marginRight as any);
    if (options.marginBottom !== undefined) this.set("scrollMarginBottom", options.marginBottom as any);
    if (options.marginLeft !== undefined) this.set("scrollMarginLeft", options.marginLeft as any);
    if (options.padding !== undefined) this.set("scrollPadding", options.padding as any);
    if (options.paddingTop !== undefined) this.set("scrollPaddingTop", options.paddingTop as any);
    if (options.paddingRight !== undefined) this.set("scrollPaddingRight", options.paddingRight as any);
    if (options.paddingBottom !== undefined) this.set("scrollPaddingBottom", options.paddingBottom as any);
    if (options.paddingLeft !== undefined) this.set("scrollPaddingLeft", options.paddingLeft as any);
    if (options.scrollbarWidth) this.set("scrollbarWidth", options.scrollbarWidth as any);
    if (options.scrollbarColor) this.set("scrollbarColor", options.scrollbarColor as any);
    if (options.overflowX) this.set("overflowX", options.overflowX as any);
    if (options.overflowY) this.set("overflowY", options.overflowY as any);
    if (options.b && !options.behavior) this.set("scrollBehavior", options.b as any);
    return this;
  }

  list(options: ListOptions): this {
    if (options.style) this.set("listStyleType", options.style as any);
    if (options.position) this.set("listStylePosition", options.position as any);
    if (options.image) this.set("listStyleImage", options.image as any);
    if (options.list) this.set("listStyle", options.list as any);
    return this;
  }

  entangle(type: string, opts?: Record<string, any>): this {
    throw new Error(
      `[ChainCSS] entangle("${type}") is not implemented yet. Use .raw() or relationship macros instead.`
    );
  }

  raw(prop: string | Record<string, any>, value?: any): this {
    if (typeof prop === "string") this.set(prop, value);
    else for (const [k, v] of Object.entries(prop)) this.set(k, v);
    return this;
  }

  hover(): this;
  hover(fn: (c: ChainProxy) => void): this;
  hover(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback("hover", fn) : this.states("hover");
  }

  focus(): this;
  focus(fn: (c: ChainProxy) => void): this;
  focus(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback("focus", fn) : this.states("focus");
  }

  active(): this;
  active(fn: (c: ChainProxy) => void): this;
  active(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback("active", fn) : this.states("active");
  }

  checked(): this;
  checked(fn: (c: ChainProxy) => void): this;
  checked(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback("checked", fn) : this.states("checked");
  }

  disabled(): this;
  disabled(fn: (c: ChainProxy) => void): this;
  disabled(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback("disabled", fn) : this.states("disabled");
  }

  before(): this;
  before(fn: (c: ChainProxy) => void): this;
  before(fn?: (c: ChainProxy) => void): this {
    // Fix #4: ::before pseudo-element
    return fn ? this.pseudoWithCallback("::before", fn) : this.states("::before");
  }

  after(): this;
  after(fn: (c: ChainProxy) => void): this;
  after(fn?: (c: ChainProxy) => void): this {
    // Fix #4: ::after pseudo-element
    return fn ? this.pseudoWithCallback("::after", fn) : this.states("::after");
  }

  placeholder(): this;
  placeholder(fn: (c: ChainProxy) => void): this;
  placeholder(fn?: (c: ChainProxy) => void): this {
    // Fix #4: ::placeholder pseudo-element
    return fn ? this.pseudoWithCallback("::placeholder", fn) : this.states("::placeholder");
  }

  private pseudoWithCallback(name: string, fn: (c: ChainProxy) => void): this {
    const childResult = this.buildChild(fn);
    const selector = name.startsWith("::") ? `&${name}` : `&:${name}`;
    this.rules.addNested(selector, childResult);
    return this;
  }

  private states(name: string): this {
    if (this.pseudoStore && !this.pseudoStore.isEmpty()) this.end();
    this.pseudoStore = new PropertyStore(this.options?.tokens);
    this.pseudoName = name;
    return this;
  }

  pseudo(styles: Record<string, any>): this {
    const pseudoElements = new Set([
      "before", "after", "placeholder", "selection", "marker",
      "first-line", "first-letter", "backdrop",
      "file-selector-button", "spelling-error", "grammar-error",
    ]);

    for (const [pseudoKey, pseudoStyles] of Object.entries(styles)) {
      let selector: string;
      
      // Handle explicit :: prefix
      if (pseudoKey.startsWith("::")) {
        selector = `&${pseudoKey}`;
      }
      // Handle functional pseudo-classes like nth-child(2n+1)
      else if (pseudoKey.includes("(")) {
        selector = `&:${pseudoKey}`;
      }
      // Handle known pseudo-elements
      else if (pseudoElements.has(pseudoKey)) {
        selector = `&::${pseudoKey}`;
      }
      // Handle regular pseudo-classes
      else {
        selector = `&:${pseudoKey}`;
      }
      
      // If pseudoStyles is a function (callback), build the child
      if (typeof pseudoStyles === "function") {
        const childResult = this.buildChild(pseudoStyles);
        this.rules.addNested(selector, childResult);
      }
      // If pseudoStyles is a single value, wrap it
      else if (typeof pseudoStyles === "string" || typeof pseudoStyles === "number") {
        this.rules.addNested(selector, { [pseudoKey.split("(")[0]]: pseudoStyles } as any);
      }
      // If pseudoStyles is an object of properties
      else if (typeof pseudoStyles === "object" && pseudoStyles !== null) {
        this.rules.addNested(selector, pseudoStyles as any);
      }
    }
    return this;
  }

  end(): this {
    if (this.pseudoStore && !this.pseudoStore.isEmpty()) {
      const pseudoProps = this.pseudoStore.getAll();
      const selector = this.pseudoName.startsWith("::")
        ? `&${this.pseudoName}`
        : `&:${this.pseudoName}`;
      this.rules.addNested(selector, pseudoProps as any);
      this.pseudoStore = null;
      this.pseudoName = "";
    }
    return this;
  }

  media(query: string, fn: (c: ChainProxy) => void): this {
    this.rules.addMedia(query, this.buildChild(fn));
    return this;
  }
  supports(condition: string, fn: (c: ChainProxy) => void): this {
    this.rules.addSupports(condition, this.buildChild(fn));
    return this;
  }
  container(query: string, fn: (c: ChainProxy) => void): this {
    this.rules.addContainer(query, this.buildChild(fn));
    return this;
  }
  layer(name: string, fn: (c: ChainProxy) => void): this {
    this.rules.addLayer(name, this.buildChild(fn));
    return this;
  }
  nest(selector: string, fn: (c: ChainProxy) => void): this {
    this.rules.addNested(selector, this.buildChild(fn));
    return this;
  }
  children(fn: (c: ChainProxy) => void): this {
    return this.nest("& > *", fn);
  }
  keyframes(name: string, steps: Record<string, any>): this {
    this.rules.addKeyframes(name, steps);
    return this;
  }
  fontFace(properties: Record<string, string>): this {
    this.rules.addFontFace(properties);
    return this;
  }

  scope(scopeQuery: string, fn: (c: ChainProxy) => void): this {
    this.rules.addScope(scopeQuery, this.buildChild(fn));
    return this;
  }

  startingStyle(selector: string, fn: (c: ChainProxy) => void): this {
    this.rules.addStartingStyle(selector, this.buildChild(fn));
    return this;
  }

  viewTransition(name: string, fn: (c: ChainProxy) => void): this {
    this.rules.addViewTransition(name, this.buildChild(fn));
    return this;
  }

  property(name: string, descriptor: Record<string, any>): this {
    this.rules.addProperty(name, descriptor);
    return this;
  }

  counterStyle(name: string, styleDef: Record<string, any>): this {
    this.rules.addCounterStyle(name, styleDef);
    return this;
  }

  page(selector: string, properties: Record<string, any>): this {
    this.rules.addPage(selector, properties);
    return this;
  }

  import(url: string, mediaQuery?: string): this {
    this.rules.addImport(url, mediaQuery);
    return this;
  }

  namespace(prefix: string, url: string): this {
    this.rules.addNamespace(prefix, url);
    return this;
  }

  atrule(styles: Record<string, any>): this {
    for (const [atRuleType, atRuleConfig] of Object.entries(styles)) {
      switch (atRuleType) {
        // ============================================================
        // CONDITIONAL
        // ============================================================
        case "media": {
          const query = typeof atRuleConfig === "function" 
            ? (atRuleConfig as any)._query || ""
            : atRuleConfig.query || atRuleConfig.condition || "";
          const styles = typeof atRuleConfig === "function"
            ? this.buildChild(atRuleConfig)
            : atRuleConfig.styles || {};
          this.rules.addMedia(query, styles as any);
          break;
        }
        case "supports": {
          const condition = typeof atRuleConfig === "function"
            ? (atRuleConfig as any)._condition || ""
            : atRuleConfig.query || atRuleConfig.condition || "";
          const styles = typeof atRuleConfig === "function"
            ? this.buildChild(atRuleConfig)
            : atRuleConfig.styles || {};
          this.rules.addSupports(condition, styles as any);
          break;
        }
        case "container": {
          const query = typeof atRuleConfig === "function"
            ? (atRuleConfig as any)._query || ""
            : atRuleConfig.query || atRuleConfig.condition || "";
          const styles = typeof atRuleConfig === "function"
            ? this.buildChild(atRuleConfig)
            : atRuleConfig.styles || {};
          this.rules.addContainer(query, styles as any);
          break;
        }

        // ============================================================
        // ARCHITECTURE
        // ============================================================
        case "layer": {
          const name = typeof atRuleConfig === "function"
            ? (atRuleConfig as any)._name || ""
            : atRuleConfig.name || "";
          const styles = typeof atRuleConfig === "function"
            ? this.buildChild(atRuleConfig)
            : atRuleConfig.styles || {};
          this.rules.addLayer(name, styles as any);
          break;
        }
        case "scope": {
          const query = atRuleConfig.query || "";
          const styles = typeof atRuleConfig === "function"
            ? this.buildChild(atRuleConfig)
            : atRuleConfig.styles || {};
          this.rules.addScope(query, styles as any);
          break;
        }
        case "import": {
          const url = atRuleConfig.url || "";
          const mediaQuery = atRuleConfig.mediaQuery || atRuleConfig.media || "";
          this.rules.addImport(url, mediaQuery);
          break;
        }
        case "namespace": {
          const prefix = atRuleConfig.prefix || "";
          const url = atRuleConfig.url || "";
          this.rules.addNamespace(prefix, url);
          break;
        }
        case "charset": {
          const encoding = atRuleConfig.encoding || atRuleConfig.value || "UTF-8";
          this.rules.addAtRule({ type: "charset", query: encoding } as any);
          break;
        }
        case "nest": {
          const selector = atRuleConfig.selector || "&";
          const styles = typeof atRuleConfig === "function"
            ? this.buildChild(atRuleConfig)
            : atRuleConfig.styles || {};
          this.rules.addNested(selector, styles as any);
          break;
        }
        case "document": {
          const url = atRuleConfig.url || atRuleConfig.query || "";
          const styles = typeof atRuleConfig === "function"
            ? this.buildChild(atRuleConfig)
            : atRuleConfig.styles || {};
          this.rules.addAtRule({ type: "document", query: url, styles: styles as any } as any);
          break;
        }
        case "viewport": {
          const styles = atRuleConfig.styles || atRuleConfig;
          this.rules.addAtRule({ type: "viewport", styles: styles as any } as any);
          break;
        }

        // ============================================================
        // ANIMATION
        // ============================================================
        case "keyframes": {
          const name = atRuleConfig.name || "";
          const steps = atRuleConfig.steps || atRuleConfig.frames || {};
          this.rules.addKeyframes(name, steps);
          break;
        }
        case "starting-style": {
          const query = atRuleConfig.query || atRuleConfig.selector || "";
          const styles = typeof atRuleConfig === "function"
            ? this.buildChild(atRuleConfig)
            : atRuleConfig.styles || {};
          this.rules.addStartingStyle(query, styles as any);
          break;
        }
        case "view-transition": {
          const name = atRuleConfig.name || "";
          const styles = typeof atRuleConfig === "function"
            ? this.buildChild(atRuleConfig)
            : atRuleConfig.styles || {};
          this.rules.addViewTransition(name, styles as any);
          break;
        }
        case "position-try": {
          const name = atRuleConfig.name || "";
          const styles = atRuleConfig.styles || {};
          this.rules.addAtRule({ type: "position-try", name: name, styles: styles as any } as any);
          break;
        }

        // ============================================================
        // TYPOGRAPHY
        // ============================================================
        case "font-face": {
          const properties = atRuleConfig.properties || atRuleConfig;
          this.rules.addFontFace(properties);
          break;
        }
        case "font-feature-values": {
          const name = atRuleConfig.name || atRuleConfig.fontFamily || "";
          const styles = atRuleConfig.styles || atRuleConfig.values || {};
          this.rules.addAtRule({ type: "font-feature-values", name: name, styles: styles as any } as any);
          break;
        }
        case "font-palette-values": {
          const name = atRuleConfig.name || "";
          const styles = atRuleConfig.styles || atRuleConfig.values || {};
          this.rules.addAtRule({ type: "font-palette-values", name: name, styles: styles as any } as any);
          break;
        }

        // ============================================================
        // CUSTOM DATA
        // ============================================================
        case "property": {
          const name = atRuleConfig.name || "";
          const descriptor = atRuleConfig.descriptor || atRuleConfig;
          this.rules.addProperty(name, descriptor);
          break;
        }
        case "counter-style": {
          const name = atRuleConfig.name || "";
          const styleDef = atRuleConfig.styleDef || atRuleConfig.styles || atRuleConfig;
          this.rules.addCounterStyle(name, styleDef);
          break;
        }
        case "color-profile": {
          const name = atRuleConfig.name || "";
          const descriptor = atRuleConfig.descriptor || atRuleConfig;
          this.rules.addAtRule({ type: "color-profile", name: name, properties: descriptor } as any);
          break;
        }
        case "custom-media": {
          const name = atRuleConfig.name || "";
          const query = atRuleConfig.query || atRuleConfig.value || "";
          this.rules.addAtRule({ type: "custom-media", name: name, query: query } as any);
          break;
        }
        case "custom-selector": {
          const name = atRuleConfig.name || "";
          const selector = atRuleConfig.selector || "";
          this.rules.addAtRule({ type: "custom-selector", name: name, query: selector } as any);
          break;
        }

        // ============================================================
        // PRINT
        // ============================================================
        case "page": {
          const selector = atRuleConfig.selector || "";
          const properties = atRuleConfig.properties || atRuleConfig.styles || {};
          this.rules.addPage(selector, properties);
          break;
        }
        case "top-left": case "top-right": case "bottom-left": case "bottom-right":
        case "top-center": case "bottom-center": case "left-top": case "left-bottom":
        case "right-top": case "right-bottom": {
          const properties = atRuleConfig.properties || atRuleConfig.styles || {};
          this.rules.addAtRule({ type: atRuleType, properties: properties as any } as any);
          break;
        }
        case "left": case "right": {
          const properties = atRuleConfig.properties || atRuleConfig.styles || {};
          this.rules.addAtRule({ type: atRuleType, properties: properties as any } as any);
          break;
        }

        default: {
          // Unknown at-rule — add generically
          const query = atRuleConfig.query || atRuleConfig.condition || "";
          const name = atRuleConfig.name || "";
          const styles = atRuleConfig.styles || atRuleConfig;
          this.rules.addAtRule({ type: atRuleType, query: query, name: name, styles: styles as any } as any);
          break;
        }
      }
    }
    return this;
  }

  when(condition: boolean, fn: (c: ChainProxy) => void): this {
    if (!condition) return this;
    const child = this.buildChild(fn);
    for (const [k, v] of Object.entries(child)) {
      if (
        k !== "selectors" &&
        k !== "_atRules" &&
        k !== "_nestedRules" &&
        !k.startsWith("_")
      )
        this.set(k, v);
    }
    if (child._atRules?.length) {
      for (const r of child._atRules) {
        // Fix #2: Dispatch at-rule types correctly
        switch (r.type) {
          case "media": this.rules.addMedia(r.query || "", r.styles || {}); break;
          case "supports": this.rules.addSupports((r as any).condition || "",(r as any).styles || {},);break;
          case "container": this.rules.addContainer((r as any).condition || "",(r as any).styles || {},);break;
          case "layer": this.rules.addLayer(r.name || "", r.styles || {}); break;
          case "keyframes": this.rules.addKeyframes(r.name || "", r.steps || {}); break;
          case "font-face": this.rules.addFontFace(r.properties || {}); break;
        }
      }
    }
    if (child._nestedRules?.length) {
      for (const r of child._nestedRules)
        this.rules.addNested(r.selector, r.styles);
    }
    return this;
  }

  extend(styleDef: StyleObject | string): this {
    if (typeof styleDef === "string") {
      this.addClass(styleDef);
      return this;
    }

    if (styleDef && typeof styleDef === "object") {
      for (const [prop, value] of Object.entries(styleDef)) {
        if (
          prop === "selectors" ||
          prop === "_atRules" ||
          prop === "_nestedRules" ||
          prop.startsWith("_")
        )
          continue;
        if (prop.startsWith("&")) {
          this.rules.addNested(prop, value as any);
        } else {
          this.props.set(prop, value);
        }
      }

      // Fix #2: Dispatch at-rule types correctly in extend()
      if ((styleDef as any)._atRules) {
        for (const rule of (styleDef as any)._atRules) {
          switch (rule.type) {
            case "media": this.rules.addMedia(rule.query || "", rule.styles || {}); break;
            case "supports": this.rules.addSupports(rule.condition || rule.query || "", rule.styles || {}); break;
            case "container": this.rules.addContainer(rule.condition || rule.query || "", rule.styles || {}); break;
            case "layer": this.rules.addLayer(rule.name || "", rule.styles || {}); break;
            case "keyframes": this.rules.addKeyframes(rule.name || "", rule.steps || {}); break;
            case "font-face": this.rules.addFontFace(rule.properties || {}); break;
          }
        }
      }

      if ((styleDef as any)._nestedRules) {
        for (const rule of (styleDef as any)._nestedRules) {
          this.rules.addNested(rule.selector, rule.styles);
        }
      }
    }

    return this;
  }

  addClass(className: string): this {
    if (!this.classes.includes(className)) this.classes.push(className);
    return this;
  }

  intents(names: string[]): this {
    for (const name of names) {
      if (typeof name === 'string' && name.trim()) {
        this._intents.push(name.trim());
      }
    }
    return this;
  }

  describe(description: string): this {
    // Browser version doesn't use semantic intent parsing
    // Just store as a simple intent
    this.intents([description.trim()]);
    return this;
  }

  enableDebug(): this {
    this.debugger.setEnabled(true);
    return this;
  }
  explain(): Explanation | Explanation[] {
    const d: any = this.debugger as any;
    return d.getExplanation?.() ?? d.explain?.() ?? [];
  }

  build(selectors?: string[] | string): StyleObject & { selectors?: string[] } {
    if (this.pseudoStore && !this.pseudoStore.isEmpty()) this.end();
    const result: StyleObject & { selectors?: string[] } = {
      ...this.props.getAll(),
    };
    if (this._mixed) result._mixed = true;
    if (this._intents.length > 0) result._intents = [...this._intents];
    if (this.classes.length > 0) result._classes = [...this.classes];
    if ((this as any)._descriptionTheme) {
      result._descriptionTheme = (this as any)._descriptionTheme;
    }
    if ((this as any)._descriptionVariant) {
      result._descriptionVariant = (this as any)._descriptionVariant;
    }
    const atRules = this.rules.getAtRules();
    const nestedRules = this.rules.getNestedRules();
    if (atRules.length > 0) result._atRules = atRules;
    if (nestedRules.length > 0) result._nestedRules = nestedRules;
    if (selectors) {
      const arr = Array.isArray(selectors) ? selectors : [selectors];
      if (arr.length > 0) {
        result.selectors = arr.map((s) => {
          if (typeof s !== "string") return String(s);
          if (
            !s.startsWith(".") &&
            !s.startsWith("#") &&
            !s.startsWith("[") &&
            !s.startsWith(":") &&
            s !== "*"
          ) {
            const prefixed = "." + this.classPrefix + s;
            if (/^\.[a-zA-Z_][\w-]*$/.test(prefixed)) {
              return prefixed;
            }
            if (typeof process !== "undefined" && process.env?.NODE_ENV === "development") {
              console.warn(
                `[ChainCSS] Invalid selector "${s}" — using hash-based fallback. ` +
                `Class names must start with a letter or underscore.`
              );
            }
            return "." + this.classPrefix + "c-" + hashString(s);
          }
          return s;
        });
      }
    }
    this.reset();
    return result;
  }

  $el(...selectors: string[]): StyleObject & { selectors?: string[] } {
    return this.build(selectors);
  }

  private reset(): void {
    // Clone tokens to prevent cross-build mutation
    const tokens = this.options?.tokens
      ? JSON.parse(JSON.stringify(this.options.tokens))
      : undefined;
    this.props = new PropertyStore(tokens);
    this.rules.reset();
    this.debugger.reset();
    this.pseudoStore = null;
    this.pseudoName = "";
    this.classes = [];
    this._intents = [];
    this._mixed = false;
    (this as any)._descriptionTheme = undefined;
    (this as any)._descriptionVariant = undefined;
  }
}

function createStyleProxyForChild(opts: {
  debug: boolean;
  classPrefix?: string;
  tokens?: any;
}): StyleCollector & Record<string, any> {
  const collector = new StyleCollector(opts);
  return createStyleProxy(
    collector,
    macroRegistry as Record<string, Function>,
  ) as any;
}

export function chain(options?: {
  debug?: boolean;
  classPrefix?: string;
  tokens?: any;
}): StyleCollector & Record<string, any> {
  const collector = new StyleCollector(options);
  return createStyleProxy(
    collector,
    macroRegistry as Record<string, Function>,
  ) as any;
}

chain.dynamic = function (options?: {
  debug?: boolean;
  classPrefix?: string;
  tokens?: any;
}): StyleCollector & Record<string, any> {
  const collector = new StyleCollector(options);
  collector.markMixed();
  return createStyleProxy(
    collector,
    macroRegistry as Record<string, Function>,
  ) as any;
};

export default chain;