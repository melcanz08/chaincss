// src/core/entities/style-collector.ts

import { macros as macroRegistry } from "@compiler/utils/shorthands.js";
import { PropertyStore, type PropertyStoreEntry } from './property-store.js';
import { RuleBuilder } from './rule-builder.js';
import { DebugCollector, type Explanation } from './debug-collector.js';
import { createStyleProxy } from './style-proxy.js';
import { classifyValue } from '../usecases/value-classifier.js';
export type { Explanation } from './debug-collector.js';
import type { ChainProxy, StyleObject as _StyleObject, AtRule as _AtRule, NestedRule as _NestedRule } from '@shared/types/index.js';
import { getBreakpoint } from '@compiler/breakpoints.js';

export type StyleObject = _StyleObject;
export type AtRule = _AtRule;
export type NestedRule = _NestedRule;

function px(v: any): string {
  if (typeof v === 'number') return `${v}px`;
  return v as string;
}

export class StyleCollector {
  private props: PropertyStore;
  private rules: RuleBuilder;
  private debugger: DebugCollector;
  private classes: string[] = [];
  private _mixed = false;
  private classPrefix: string;
  private pseudoStore: PropertyStore | null = null;
  private pseudoName: string = '';

  constructor(private options?: { debug?: boolean; classPrefix?: string; tokens?: any }) {
    this.props = new PropertyStore(options?.tokens);
    this.rules = new RuleBuilder();
    this.debugger = new DebugCollector(options?.debug ?? false);
    this.classPrefix = options?.classPrefix || 'chain-';
  }

  markMixed(): this { this._mixed = true; return this; }
  isMixed(): boolean { return this._mixed; }

  set(prop: string, value: any): this {
    // Responsive named breakpoints: { base: 16, md: 24, lg: 32 }
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const bpKeys = Object.keys(value);

      // Theme variants with explicit wrapper: { theme: { light: '#fff', dark: '#1e293b' } }
      const themeKeys = ['light', 'dark', 'high-contrast'];
      if ('theme' in value && typeof value.theme === 'object' && value.theme !== null) {
        const themeValues = value.theme as Record<string, any>;
        const themeKeys = Object.keys(themeValues);
        const firstKey = themeKeys[0];
        this.props.set(prop, themeValues[firstKey]);
        
        for (const [theme, themeValue] of Object.entries(themeValues)) {
          if (theme === firstKey) continue;
          if (themeValue !== undefined && themeValue !== null) {
            let finalValue = themeValue;
            if (typeof themeValue === 'number') {
              const UNITLESS = new Set([
                'zIndex','opacity','flex','flexGrow','flexShrink','order',
                'fontWeight','lineHeight','scale','zoom','animationIterationCount'
              ]);
              if (!UNITLESS.has(prop)) finalValue = `${themeValue}px`;
            }
            this.rules.addNested(`[data-theme="${theme}"] &`, { [prop]: finalValue } as any);
          }
        }
        return this;
      }

      // Responsive breakpoints: check SECOND — { base: 16, md: 24, lg: 32 }
      const isResponsive = bpKeys.some(k => k === 'base' || getBreakpoint(k));
      if (isResponsive) {
        // Set base value
        if ('base' in value) {
          this.props.set(prop, value.base);
          this.debugger.log(prop, { realProp: prop, value: value.base, classification: 'static' }, value.base, 'root');
        }
        // Add media queries for each breakpoint
        for (const [bp, bpValue] of Object.entries(value)) {
          if (bp === 'base') continue;
          const bpQuery = getBreakpoint(bp);
          if (bpQuery && bpValue !== undefined && bpValue !== null) {
            // Apply unit inference to the breakpoint value
            let finalValue = bpValue;
            if (typeof bpValue === 'number') {
              const UNITLESS = new Set([
                'zIndex','opacity','flex','flexGrow','flexShrink','order',
                'fontWeight','lineHeight','scale','zoom','animationIterationCount',
                'columnCount','orphans','widows','tabSize','fillOpacity','strokeOpacity',
                'aspectRatio','gridRow','gridColumn'
              ]);
              if (!UNITLESS.has(prop)) {
                finalValue = `${bpValue}px`;
              }
            }
            this.rules.addMedia(bpQuery, { [prop]: finalValue } as StyleObject);
          }
        }
        return this;
      }
    }

    // Existing behavior
    if (classifyValue(value) === 'dynamic') this.markMixed();
    const target = this.pseudoStore || this.props;
    const entry: PropertyStoreEntry = target.set(prop, value);
    this.debugger.log(prop, entry, value, this.pseudoStore ? this.pseudoName : 'root');
    return this;
  }

  private childOpts() {
    return { debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens };
  }
  private createChildProxy() {
    return createStyleProxyForChild(this.childOpts());
  }
  private buildChild(fn: (c: ChainProxy) => void) {
    return this.rules.buildChild(fn, () => this.createChildProxy(), this.debugger.isEnabled());
  }
  private getDisplay(): string | undefined {
    return (this.props as any).get?.('display') ?? (this.props as any).properties?.['display'];
  }

  grid(options?: import('@shared/types/shorthand-types.js').GridOptions | string): this {
    if (options === undefined) return this.set('display', 'grid');
    if (typeof options === 'string') return this.set('grid', options);
    if (typeof options === 'object') {
      if (this.getDisplay() !== 'inline-grid') this.set('display', 'grid');
      if (options.columns) this.set('gridTemplateColumns', options.columns as any);
      if (options.rows) this.set('gridTemplateRows', options.rows as any);
      if (options.gap !== undefined) this.set('gap', options.gap as any);
      else {
        if (options.columnGap !== undefined) this.set('columnGap', options.columnGap as any);
        if (options.rowGap !== undefined) this.set('rowGap', options.rowGap as any);
      }
      if (options.area) this.set('gridArea', options.area as any);
      if (options.autoFlow) this.set('gridAutoFlow', options.autoFlow as any);
      if (options.autoColumns !== undefined) this.set('gridAutoColumns', options.autoColumns as any);
      if (options.autoRows !== undefined) this.set('gridAutoRows', options.autoRows as any);
      if (options.template) this.set('gridTemplate', options.template as any);
      if (options.c && !options.columns) this.set('gridTemplateColumns', options.c as any);
      if (options.r && !options.rows) this.set('gridTemplateRows', options.r as any);
      if (options.g !== undefined && options.gap === undefined) this.set('gap', options.g as any);
      if (options.a && !options.area) this.set('gridArea', options.a as any);
    }
    return this;
  }

  flex(options?: import('@shared/types/shorthand-types.js').FlexOptions | string): this {
    if (options === undefined) return this.set('display', 'flex');
    if (typeof options === 'string') return this.set('flex', options);
    if (typeof options === 'object') {
      if (this.getDisplay() !== 'inline-flex') this.set('display', 'flex');
      if (options.direction) this.set('flexDirection', options.direction as any);
      if (options.wrap) this.set('flexWrap', options.wrap as any);
      if (options.grow !== undefined) this.set('flexGrow', options.grow as any);
      if (options.shrink !== undefined) this.set('flexShrink', options.shrink as any);
      if (options.basis !== undefined) this.set('flexBasis', options.basis as any);
      if (options.align) this.set('alignItems', options.align as any);
      if (options.justify) this.set('justifyContent', options.justify as any);
      if (options.alignContent) this.set('alignContent', options.alignContent as any);
      if (options.alignSelf) this.set('alignSelf', options.alignSelf as any);
      if (options.gap !== undefined) this.set('gap', options.gap as any);
      if (options.d && !options.direction) this.set('flexDirection', options.d as any);
      if (options.w && !options.wrap) this.set('flexWrap', options.w as any);
      if (options.gr !== undefined && options.grow === undefined) this.set('flexGrow', options.gr as any);
      if (options.sh !== undefined && options.shrink === undefined) this.set('flexShrink', options.sh as any);
      if (options.b !== undefined && options.basis === undefined) this.set('flexBasis', options.b as any);
      if (options.ai && !options.align) this.set('alignItems', options.ai as any);
      if (options.jc && !options.justify) this.set('justifyContent', options.jc as any);
      if (options.f) this.set('flex', options.f as any);
    }
    return this;
  }

  animation(options: import('@shared/types/shorthand-types.js').AnimationOptions): this {
    if (options.name) this.set('animationName', options.name as any);
    if (options.duration) this.set('animationDuration', options.duration as any);
    if (options.timing) this.set('animationTimingFunction', options.timing as any);
    if (options.delay) this.set('animationDelay', options.delay as any);
    if (options.iterationCount !== undefined) this.set('animationIterationCount', options.iterationCount as any);
    if (options.direction) this.set('animationDirection', options.direction as any);
    if (options.fillMode) this.set('animationFillMode', options.fillMode as any);
    if (options.playState) this.set('animationPlayState', options.playState as any);
    if (options.n && !options.name) this.set('animationName', options.n as any);
    if (options.d && !options.duration) this.set('animationDuration', options.d as any);
    if (options.t && !options.timing) this.set('animationTimingFunction', options.t as any);
    if (options.dl && !options.delay) this.set('animationDelay', options.dl as any);
    if (options.i !== undefined && options.iterationCount === undefined) this.set('animationIterationCount', options.i as any);
    if (options.a) this.set('animation', options.a as any);
    return this;
  }

  background(options?: import('@shared/types/shorthand-types.js').BackgroundOptions | string): this {
    if (options === undefined) return this;
    if (typeof options === 'string') return this.set('background', options);
    if (typeof options === 'object') {
      if (options.color) this.set('backgroundColor', options.color as any);
      if (options.image) this.set('backgroundImage', options.image as any);
      if (options.position) this.set('backgroundPosition', options.position as any);
      if (options.size) this.set('backgroundSize', options.size as any);
      if (options.repeat) this.set('backgroundRepeat', options.repeat as any);
      if (options.attachment) this.set('backgroundAttachment', options.attachment as any);
      if (options.origin) this.set('backgroundOrigin', options.origin as any);
      if (options.clip) this.set('backgroundClip', options.clip as any);
      if (options.blendMode) this.set('backgroundBlendMode', options.blendMode as any);
      if (options.c && !options.color) this.set('backgroundColor', options.c as any);
      if (options.i && !options.image) this.set('backgroundImage', options.i as any);
      if (options.p && !options.position) this.set('backgroundPosition', options.p as any);
      if (options.s && !options.size) this.set('backgroundSize', options.s as any);
      if (options.r && !options.repeat) this.set('backgroundRepeat', options.r as any);
      if (options.bg) this.set('background', options.bg as any);
    }
    return this;
  }

  typography(options: import('@shared/types/shorthand-types.js').TypographyOptions): this {
    if (options.fontFamily) this.set('fontFamily', options.fontFamily as any);
    if (options.fontSize !== undefined) this.set('fontSize', options.fontSize as any);
    if (options.fontWeight !== undefined) this.set('fontWeight', options.fontWeight as any);
    if (options.fontStyle) this.set('fontStyle', options.fontStyle as any);
    if (options.lineHeight !== undefined) this.set('lineHeight', options.lineHeight as any);
    if (options.letterSpacing !== undefined) this.set('letterSpacing', options.letterSpacing as any);
    if (options.textAlign) this.set('textAlign', options.textAlign as any);
    if (options.textTransform) this.set('textTransform', options.textTransform as any);
    if (options.textDecoration) this.set('textDecoration', options.textDecoration as any);
    if (options.textIndent !== undefined) this.set('textIndent', options.textIndent as any);
    if (options.wordSpacing !== undefined) this.set('wordSpacing', options.wordSpacing as any);
    if (options.whiteSpace) this.set('whiteSpace', options.whiteSpace as any);
    if (options.wordBreak) this.set('wordBreak', options.wordBreak as any);
    if (options.color) this.set('color', options.color as any);
    if (options.opacity !== undefined) this.set('opacity', options.opacity as any);
    if (options.ff && !options.fontFamily) this.set('fontFamily', options.ff as any);
    if (options.fs !== undefined && options.fontSize === undefined) this.set('fontSize', options.fs as any);
    if (options.fw !== undefined && options.fontWeight === undefined) this.set('fontWeight', options.fw as any);
    if (options.lh !== undefined && options.lineHeight === undefined) this.set('lineHeight', options.lh as any);
    if (options.ta && !options.textAlign) this.set('textAlign', options.ta as any);
    if (options.tt && !options.textTransform) this.set('textTransform', options.tt as any);
    if (options.f) this.set('font', options.f as any);
    return this;
  }

  box(options: import('@shared/types/shorthand-types.js').BoxOptions): this {
    if (options.margin !== undefined) this.set('margin', options.margin as any);
    if (options.marginTop !== undefined) this.set('marginTop', options.marginTop as any);
    if (options.marginRight !== undefined) this.set('marginRight', options.marginRight as any);
    if (options.marginBottom !== undefined) this.set('marginBottom', options.marginBottom as any);
    if (options.marginLeft !== undefined) this.set('marginLeft', options.marginLeft as any);
    if (options.padding !== undefined) this.set('padding', options.padding as any);
    if (options.paddingTop !== undefined) this.set('paddingTop', options.paddingTop as any);
    if (options.paddingRight !== undefined) this.set('paddingRight', options.paddingRight as any);
    if (options.paddingBottom !== undefined) this.set('paddingBottom', options.paddingBottom as any);
    if (options.paddingLeft !== undefined) this.set('paddingLeft', options.paddingLeft as any);
    if (options.border) this.set('border', options.border as any);
    if (options.borderRadius !== undefined) this.set('borderRadius', options.borderRadius as any);
    if (options.borderWidth !== undefined) this.set('borderWidth', options.borderWidth as any);
    if (options.borderColor) this.set('borderColor', options.borderColor as any);
    if (options.borderStyle) this.set('borderStyle', options.borderStyle as any);
    if (options.borderTop) this.set('borderTop', options.borderTop as any);
    if (options.borderRight) this.set('borderRight', options.borderRight as any);
    if (options.borderBottom) this.set('borderBottom', options.borderBottom as any);
    if (options.borderLeft) this.set('borderLeft', options.borderLeft as any);
    if (options.width !== undefined) this.set('width', options.width as any);
    if (options.minWidth !== undefined) this.set('minWidth', options.minWidth as any);
    if (options.maxWidth !== undefined) this.set('maxWidth', options.maxWidth as any);
    if (options.height !== undefined) this.set('height', options.height as any);
    if (options.minHeight !== undefined) this.set('minHeight', options.minHeight as any);
    if (options.maxHeight !== undefined) this.set('maxHeight', options.maxHeight as any);
    if (options.overflow) this.set('overflow', options.overflow as any);
    if (options.overflowX) this.set('overflowX', options.overflowX as any);
    if (options.overflowY) this.set('overflowY', options.overflowY as any);
    if (options.m !== undefined && options.margin === undefined) this.set('margin', options.m as any);
    if (options.p !== undefined && options.padding === undefined) this.set('padding', options.p as any);
    if (options.br !== undefined && options.borderRadius === undefined) this.set('borderRadius', options.br as any);
    if (options.w !== undefined && options.width === undefined) this.set('width', options.w as any);
    if (options.h !== undefined && options.height === undefined) this.set('height', options.h as any);
    return this;
  }

  position(options: import('@shared/types/shorthand-types.js').PositionOptions): this {
    if (options.type) this.set('position', options.type as any);
    if (options.top !== undefined) this.set('top', options.top as any);
    if (options.right !== undefined) this.set('right', options.right as any);
    if (options.bottom !== undefined) this.set('bottom', options.bottom as any);
    if (options.left !== undefined) this.set('left', options.left as any);
    if (options.inset !== undefined) this.set('inset', options.inset as any);
    if (options.zIndex !== undefined) this.set('zIndex', options.zIndex as any);
    if (options.t && !options.type) this.set('position', options.t as any);
    if (options.z !== undefined && options.zIndex === undefined) this.set('zIndex', options.z as any);
    return this;
  }

  transition(options?: import('@shared/types/shorthand-types.js').TransitionOptions | string): this {
    if (options === undefined) return this;
    if (typeof options === 'string') return this.set('transition', options);
    if (typeof options === 'object') {
      if (options.property) this.set('transitionProperty', options.property as any);
      if (options.duration) this.set('transitionDuration', options.duration as any);
      if (options.timing) this.set('transitionTimingFunction', options.timing as any);
      if (options.delay) this.set('transitionDelay', options.delay as any);
      if (options.behavior) this.set('transitionBehavior', options.behavior as any);
      if (options.p && !options.property) this.set('transitionProperty', options.p as any);
      if (options.d && !options.duration) this.set('transitionDuration', options.d as any);
      if (options.t && !options.timing) this.set('transitionTimingFunction', options.t as any);
      if (options.tr) this.set('transition', options.tr as any);
    }
    return this;
  }

  transform(options?: import('@shared/types/shorthand-types.js').TransformOptions | string): this {
    if (typeof options === 'string') return this.set('transform', options);
    if (options === undefined) return this;
    if (typeof options === 'object') {
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
      if (options.custom) parts.push(options.custom as string);
      if (options.origin) this.set('transformOrigin', options.origin as any);
      if (parts.length > 0) this.set('transform', parts.join(' '));
    }
    return this;
  }

  filter(options: import('@shared/types/shorthand-types.js').FilterOptions | string): this {
    if (typeof options === 'string') return this.set('filter', options);
    const parts: string[] = [];
    if (options.blur !== undefined) parts.push(`blur(${typeof options.blur === 'number' ? options.blur + 'px' : options.blur})`);
    if (options.brightness !== undefined) parts.push(`brightness(${options.brightness})`);
    if (options.contrast !== undefined) parts.push(`contrast(${options.contrast})`);
    if (options.grayscale !== undefined) parts.push(`grayscale(${options.grayscale})`);
    if (options.hueRotate) parts.push(`hue-rotate(${options.hueRotate})`);
    if (options.invert !== undefined) parts.push(`invert(${options.invert})`);
    if (options.filterOpacity !== undefined) parts.push(`opacity(${options.filterOpacity})`);
    if (options.saturate !== undefined) parts.push(`saturate(${options.saturate})`);
    if (options.sepia !== undefined) parts.push(`sepia(${options.sepia})`);
    if (options.dropShadow) parts.push(`drop-shadow(${options.dropShadow})`);
    if (options.custom) parts.push(options.custom as string);
    if (options.backdrop) this.set('backdropFilter', options.backdrop as any);
    if (parts.length > 0) this.set('filter', parts.join(' '));
    return this;
  }

  shadow(options: import('@shared/types/shorthand-types.js').ShadowOptions | string): this {
    if (typeof options === 'string') return this.set('boxShadow', options);
    if (options.box) this.set('boxShadow', options.box as any);
    else if (options.x !== undefined || options.y !== undefined) {
      const x = px(options.x ?? 0);
      const y = px(options.y ?? 0);
      const blur = px(options.blur ?? 0);
      const spread = options.spread !== undefined ? ` ${px(options.spread)}` : '';
      const color = options.color ? ` ${options.color}` : '';
      const inset = options.inset ? ' inset' : '';
      this.set('boxShadow', `${x} ${y} ${blur}${spread}${color}${inset}`);
    }
    if (options.text) this.set('textShadow', options.text as any);
    return this;
  }

  containerQuery(options: import('@shared/types/shorthand-types.js').ContainerOptions): this {
    if (options.type) this.set('containerType', options.type as any);
    if (options.name) this.set('containerName', options.name as any);
    return this;
  }

  outline(options: import('@shared/types/shorthand-types.js').OutlineOptions): this {
    if (options.width !== undefined) this.set('outlineWidth', options.width as any);
    if (options.style) this.set('outlineStyle', options.style as any);
    if (options.color) this.set('outlineColor', options.color as any);
    if (options.offset !== undefined) this.set('outlineOffset', options.offset as any);
    if (options.w !== undefined && options.width === undefined) this.set('outlineWidth', options.w as any);
    if (options.s && !options.style) this.set('outlineStyle', options.s as any);
    if (options.c && !options.color) this.set('outlineColor', options.c as any);
    if (options.o) this.set('outline', options.o as any);
    return this;
  }

  scroll(options: import('@shared/types/shorthand-types.js').ScrollOptions): this {
    if (options.behavior) this.set('scrollBehavior', options.behavior as any);
    if (options.snapType) this.set('scrollSnapType', options.snapType as any);
    if (options.snapAlign) this.set('scrollSnapAlign', options.snapAlign as any);
    if (options.snapStop) this.set('scrollSnapStop', options.snapStop as any);
    if (options.margin !== undefined) this.set('scrollMargin', options.margin as any);
    if (options.marginTop !== undefined) this.set('scrollMarginTop', options.marginTop as any);
    if (options.marginRight !== undefined) this.set('scrollMarginRight', options.marginRight as any);
    if (options.marginBottom !== undefined) this.set('scrollMarginBottom', options.marginBottom as any);
    if (options.marginLeft !== undefined) this.set('scrollMarginLeft', options.marginLeft as any);
    if (options.padding !== undefined) this.set('scrollPadding', options.padding as any);
    if (options.paddingTop !== undefined) this.set('scrollPaddingTop', options.paddingTop as any);
    if (options.paddingRight !== undefined) this.set('scrollPaddingRight', options.paddingRight as any);
    if (options.paddingBottom !== undefined) this.set('scrollPaddingBottom', options.paddingBottom as any);
    if (options.paddingLeft !== undefined) this.set('scrollPaddingLeft', options.paddingLeft as any);
    if (options.scrollbarWidth) this.set('scrollbarWidth', options.scrollbarWidth as any);
    if (options.scrollbarColor) this.set('scrollbarColor', options.scrollbarColor as any);
    if (options.overflowX) this.set('overflowX', options.overflowX as any);
    if (options.overflowY) this.set('overflowY', options.overflowY as any);
    if (options.b && !options.behavior) this.set('scrollBehavior', options.b as any);
    return this;
  }

  list(options: import('@shared/types/shorthand-types.js').ListOptions): this {
    if (options.style) this.set('listStyleType', options.style as any);
    if (options.position) this.set('listStylePosition', options.position as any);
    if (options.image) this.set('listStyleImage', options.image as any);
    if (options.list) this.set('listStyle', options.list as any);
    return this;
  }

  entangle(type: string, opts?: Record<string, any>): this {
    // Delegates to the entangle macro in utils/entangle.ts
    // The proxy already intercepts this, but adding it here gives TypeScript visibility
    return this;
  }

  raw(prop: string | Record<string, any>, value?: any): this {
    if (typeof prop === 'string') this.set(prop, value);
    else for (const [k, v] of Object.entries(prop)) this.set(k, v);
    return this;
  }

  hover(): this;
  hover(fn: (c: ChainProxy) => void): this;
  hover(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback('hover', fn) : this.pseudo('hover');
  }

  focus(): this;
  focus(fn: (c: ChainProxy) => void): this;
  focus(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback('focus', fn) : this.pseudo('focus');
  }

  active(): this;
  active(fn: (c: ChainProxy) => void): this;
  active(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback('active', fn) : this.pseudo('active');
  }

  checked(): this;
  checked(fn: (c: ChainProxy) => void): this;
  checked(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback('checked', fn) : this.pseudo('checked');
  }

  disabled(): this;
  disabled(fn: (c: ChainProxy) => void): this;
  disabled(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback('disabled', fn) : this.pseudo('disabled');
  }

  before(): this;
  before(fn: (c: ChainProxy) => void): this;
  before(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback('before', fn) : this.pseudo('before');
  }

  after(): this;
  after(fn: (c: ChainProxy) => void): this;
  after(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback('after', fn) : this.pseudo('after');
  }

  placeholder(): this;
  placeholder(fn: (c: ChainProxy) => void): this;
  placeholder(fn?: (c: ChainProxy) => void): this {
    return fn ? this.pseudoWithCallback(':placeholder', fn) : this.pseudo(':placeholder');
  }
  
  private pseudoWithCallback(name: string, fn: (c: ChainProxy) => void): this {
    const childResult = this.buildChild(fn);
    this.rules.addNested(`&:${name}`, childResult);
    return this;
  }

  private pseudo(name: string): this {
    if (this.pseudoStore && !this.pseudoStore.isEmpty()) this.end();
    this.pseudoStore = new PropertyStore(this.options?.tokens);
    this.pseudoName = name;
    return this;
  }

  end(): this {
    if (this.pseudoStore && !this.pseudoStore.isEmpty()) {
      const pseudoProps = this.pseudoStore.getAll();
      this.rules.addNested(`&:${this.pseudoName}`, pseudoProps as any);
      this.pseudoStore = null;
      this.pseudoName = '';
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
  children(fn: (c: ChainProxy) => void): this { return this.nest('& > *', fn); }
  keyframes(name: string, steps: Record<string, any>): this { this.rules.addKeyframes(name, steps); return this; }
  fontFace(properties: Record<string, string>): this { this.rules.addFontFace(properties); return this; }

  when(condition: boolean, fn: (c: ChainProxy) => void): this {
    if (!condition) return this;
    const child = this.buildChild(fn);
    for (const [k, v] of Object.entries(child)) {
      if (k !== 'selectors' && k !== '_atRules' && k !== '_nestedRules' && !k.startsWith('_')) this.set(k, v);
    }
    if (child._atRules?.length) {
      for (const r of child._atRules) {
        if (r.type === 'media') this.rules.addMedia(r.query || '', r.styles || {});
        else if (r.type === 'supports') this.rules.addSupports(r.condition || '', r.styles || {});
        else if (r.type === 'container') this.rules.addContainer(r.condition || '', r.styles || {});
        else if (r.type === 'layer') this.rules.addLayer(r.name || '', r.styles || {});
        else if (r.type === 'keyframes') this.rules.addKeyframes(r.name || '', r.steps || {});
        else if (r.type === 'font-face') this.rules.addFontFace(r.properties || {});
      }
    }
    if (child._nestedRules?.length) {
      for (const r of child._nestedRules) this.rules.addNested(r.selector, r.styles);
    }
    return this;
  }

  extend(styleDef: StyleObject | string): this {
    // If it's a string (class name from chain().$el()), we can't extract styles
    // Only works with StyleObject (from .build() or chain.dynamic().$el())
    if (typeof styleDef === 'string') {
      // Add the class name for HTML composition
      this.addClass(styleDef);
      return this;
    }
    
    // Merge all properties from the base style
    if (styleDef && typeof styleDef === 'object') {
      // Copy declarations
      for (const [prop, value] of Object.entries(styleDef)) {
        if (prop === 'selectors' || prop === '_atRules' || prop === '_nestedRules' || prop.startsWith('_')) continue;
        if (prop.startsWith('&')) {
          // Pseudo-classes and nested selectors — add as nested rules
          this.rules.addNested(prop, value as any);
        } else {
          this.props.set(prop, value);
        }
      }
      
      // Copy at-rules
      if ((styleDef as any)._atRules) {
        for (const rule of (styleDef as any)._atRules) {
          this.rules.addMedia(rule.query || rule.condition || rule.name, rule.styles || {});
        }
      }
      
      // Copy nested rules
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
  enableDebug(): this { this.debugger.setEnabled(true); return this; }
  explain(): Explanation | Explanation[] {
    const d: any = this.debugger as any;
    return d.getExplanation?.() ?? d.explain?.() ?? [];
  }

  build(selectors?: string[] | string): StyleObject & { selectors?: string[] } {
    if (this.pseudoStore && !this.pseudoStore.isEmpty()) this.end();
    const result: StyleObject & { selectors?: string[] } = { ...this.props.getAll() };
    if (this._mixed) result._mixed = true;
    if (this.classes.length > 0) result._classes = [...this.classes];
    const extraAt = (this as any).atRules || [];
    const extraAtUnderscore = (this as any)._atRules || [];
    const extraNested = (this as any).nestedRules || [];
    const extraNestedUnderscore = (this as any)._nestedRules || [];
    const atRules = [...this.rules.getAtRules(), ...extraAt, ...extraAtUnderscore];
    const nestedRules = [...this.rules.getNestedRules(), ...extraNested, ...extraNestedUnderscore];
    if (atRules.length > 0) result._atRules = atRules;
    if (nestedRules.length > 0) result._nestedRules = nestedRules;
    if (selectors) {
      const arr = Array.isArray(selectors) ? selectors : [selectors];
      if (arr.length > 0) {
        result.selectors = arr.map(s => {
          if (typeof s !== 'string') return String(s);
          if (!s.startsWith('.') && !s.startsWith('#') && !s.startsWith('[') && !s.startsWith(':') && s !== '*') {
            return '.' + this.classPrefix + s;
          }
          return s;
        });
      }
    }
    this.reset();
    return result;
  }

  $el(...selectors: string[]): StyleObject & { selectors?: string[] } { return this.build(selectors); }

  private reset(): void {
    this.props.reset();
    this.rules.reset();
    this.debugger.reset();
    this.pseudoStore = null;
    this.pseudoName = '';
    this.classes = [];
    (this as any).nestedRules = undefined;
    (this as any)._nestedRules = undefined;
    (this as any).atRules = undefined;
    (this as any)._atRules = undefined;
  }
}

function createStyleProxyForChild(opts: { debug: boolean; classPrefix?: string; tokens?: any }): StyleCollector & Record<string, any> {
  const collector = new StyleCollector(opts);
  return createStyleProxy(collector, macroRegistry as Record<string, Function>) as any;
}

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