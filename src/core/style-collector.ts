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
  ChainProxy,
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
  // Shorthand Methods — Grouped CSS Property Setters
  // ========================================================================

  /**
   * CSS Grid shorthand.
   * Sets multiple grid-* properties in a single call.
   * 
   * @example
   * chain().grid({ columns: '1fr 1fr', rows: 'auto', gap: 16 })
   * chain().grid({ c: '1 / span 2', r: 'auto', g: 16 })
   */
  grid(options?: import('./shorthand-types.js').GridOptions | string): this {
    // Case 1: No arguments → old macro: grid() → display: grid
    if (options === undefined) {
      this.set('display', 'grid');
      return this;
    }
    
    // Case 2: String argument → old CSS property: grid('1fr / 1fr')
    if (typeof options === 'string') {
      this.set('grid', options);
      return this;
    }
    
    // Case 3: Object argument → new shorthand
    if (typeof options === 'object') {
      this.set('display', 'grid');
      if (options.columns) this.set('grid-template-columns', options.columns as any);
      if (options.rows) this.set('grid-template-rows', options.rows as any);
      if (options.gap !== undefined) {
        this.set('gap', options.gap as any);
      } else {
        if (options.columnGap !== undefined) this.set('column-gap', options.columnGap as any);
        if (options.rowGap !== undefined) this.set('row-gap', options.rowGap as any);
      }
      if (options.area) this.set('grid-area', options.area as any);
      if (options.autoFlow) this.set('grid-auto-flow', options.autoFlow as any);
      if (options.autoColumns !== undefined) this.set('grid-auto-columns', options.autoColumns as any);
      if (options.autoRows !== undefined) this.set('grid-auto-rows', options.autoRows as any);
      if (options.template) this.set('grid-template', options.template as any);
      // Short aliases (only applied if long form not set)
      if (options.c && !options.columns) this.set('grid-template-columns', options.c as any);
      if (options.r && !options.rows) this.set('grid-template-rows', options.r as any);
      if (options.g !== undefined && options.gap === undefined) this.set('gap', options.g as any);
      if (options.a && !options.area) this.set('grid-area', options.a as any);
    }
    
    return this;
  }

  /**
   * Flexbox shorthand.
   * Sets multiple flex-related properties in a single call.
   * 
   * @example
   * chain().flex({ direction: 'column', align: 'center', gap: 16 })
   * chain().flex({ d: 'col', ai: 'center', jc: 'between' })
   */
  flex(options?: import('./shorthand-types.js').FlexOptions | string): this {
    // Case 1: No arguments → old macro: flex() → display: flex
    if (options === undefined) {
      this.set('display', 'flex');
      return this;
    }
    
    // Case 2: String argument → old CSS property: flex('1 0 auto')
    if (typeof options === 'string') {
      this.set('flex', options);
      return this;
    }
    
    // Case 3: Object argument → new shorthand
    if (typeof options === 'object') {
      this.set('display', 'flex');
      if (options.direction) this.set('flex-direction', options.direction as any);
      if (options.wrap) this.set('flex-wrap', options.wrap as any);
      if (options.grow !== undefined) this.set('flex-grow', options.grow as any);
      if (options.shrink !== undefined) this.set('flex-shrink', options.shrink as any);
      if (options.basis !== undefined) this.set('flex-basis', options.basis as any);
      if (options.align) this.set('align-items', options.align as any);
      if (options.justify) this.set('justify-content', options.justify as any);
      if (options.alignContent) this.set('align-content', options.alignContent as any);
      if (options.alignSelf) this.set('align-self', options.alignSelf as any);
      if (options.gap !== undefined) this.set('gap', options.gap as any);
      // Short aliases
      if (options.d && !options.direction) this.set('flex-direction', options.d as any);
      if (options.w && !options.wrap) this.set('flex-wrap', options.w as any);
      if (options.gr !== undefined && options.grow === undefined) this.set('flex-grow', options.gr as any);
      if (options.sh !== undefined && options.shrink === undefined) this.set('flex-shrink', options.sh as any);
      if (options.b !== undefined && options.basis === undefined) this.set('flex-basis', options.b as any);
      if (options.ai && !options.align) this.set('align-items', options.ai as any);
      if (options.jc && !options.justify) this.set('justify-content', options.jc as any);
      if (options.f) this.set('flex', options.f as any);
    }
    
    return this;
  }

  /**
   * Animation shorthand.
   * Sets multiple animation-* properties in a single call.
   * 
   * @example
   * chain().animation({ name: 'fadeIn', duration: '300ms', timing: 'ease-out' })
   * chain().animation({ n: 'fadeIn', d: '300ms', t: 'ease' })
   */
  animation(options: import('./shorthand-types.js').AnimationOptions): this {
    if (options.name) this.set('animation-name', options.name as any);
    if (options.duration) this.set('animation-duration', options.duration as any);
    if (options.timing) this.set('animation-timing-function', options.timing as any);
    if (options.delay) this.set('animation-delay', options.delay as any);
    if (options.iterationCount !== undefined) this.set('animation-iteration-count', options.iterationCount as any);
    if (options.direction) this.set('animation-direction', options.direction as any);
    if (options.fillMode) this.set('animation-fill-mode', options.fillMode as any);
    if (options.playState) this.set('animation-play-state', options.playState as any);
    // Short aliases
    if (options.n && !options.name) this.set('animation-name', options.n as any);
    if (options.d && !options.duration) this.set('animation-duration', options.d as any);
    if (options.t && !options.timing) this.set('animation-timing-function', options.t as any);
    if (options.dl && !options.delay) this.set('animation-delay', options.dl as any);
    if (options.i !== undefined && options.iterationCount === undefined) this.set('animation-iteration-count', options.i as any);
    if (options.a) this.set('animation', options.a as any);
    return this;
  }

  /**
   * Background shorthand.
   * Sets multiple background-* properties in a single call.
   * 
   * @example
   * chain().background({ color: '#fff', image: 'url(bg.jpg)', size: 'cover' })
   * chain().background({ c: '#fff', i: 'url(bg.jpg)', s: 'cover' })
   */
  background(options?: import('./shorthand-types.js').BackgroundOptions | string): this {
    // Case 1: No arguments → do nothing (edge case, shouldn't happen)
    if (options === undefined) {
      return this;
    }
    
    // Case 2: String argument → old CSS property: background('#fff')
    if (typeof options === 'string') {
      this.set('background', options);
      return this;
    }
    
    // Case 3: Object argument → new shorthand
    if (typeof options === 'object') {
      if (options.color) this.set('background-color', options.color as any);
      if (options.image) this.set('background-image', options.image as any);
      if (options.position) this.set('background-position', options.position as any);
      if (options.size) this.set('background-size', options.size as any);
      if (options.repeat) this.set('background-repeat', options.repeat as any);
      if (options.attachment) this.set('background-attachment', options.attachment as any);
      if (options.origin) this.set('background-origin', options.origin as any);
      if (options.clip) this.set('background-clip', options.clip as any);
      if (options.blendMode) this.set('background-blend-mode', options.blendMode as any);
      // Short aliases
      if (options.c && !options.color) this.set('background-color', options.c as any);
      if (options.i && !options.image) this.set('background-image', options.i as any);
      if (options.p && !options.position) this.set('background-position', options.p as any);
      if (options.s && !options.size) this.set('background-size', options.s as any);
      if (options.r && !options.repeat) this.set('background-repeat', options.r as any);
      if (options.bg) this.set('background', options.bg as any);
    }
    
    return this;
  }

  /**
   * Typography shorthand.
   * Sets multiple font/text properties in a single call.
   * 
   * @example
   * chain().typography({ fontFamily: 'Inter', fontSize: 16, fontWeight: '600' })
   * chain().typography({ ff: 'Inter', fs: 16, fw: '600' })
   */
  typography(options: import('./shorthand-types.js').TypographyOptions): this {
    if (options.fontFamily) this.set('font-family', options.fontFamily as any);
    if (options.fontSize !== undefined) this.set('font-size', options.fontSize as any);
    if (options.fontWeight !== undefined) this.set('font-weight', options.fontWeight as any);
    if (options.fontStyle) this.set('font-style', options.fontStyle as any);
    if (options.lineHeight !== undefined) this.set('line-height', options.lineHeight as any);
    if (options.letterSpacing !== undefined) this.set('letter-spacing', options.letterSpacing as any);
    if (options.textAlign) this.set('text-align', options.textAlign as any);
    if (options.textTransform) this.set('text-transform', options.textTransform as any);
    if (options.textDecoration) this.set('text-decoration', options.textDecoration as any);
    if (options.textIndent !== undefined) this.set('text-indent', options.textIndent as any);
    if (options.wordSpacing !== undefined) this.set('word-spacing', options.wordSpacing as any);
    if (options.whiteSpace) this.set('white-space', options.whiteSpace as any);
    if (options.wordBreak) this.set('word-break', options.wordBreak as any);
    if (options.color) this.set('color', options.color as any);
    if (options.opacity !== undefined) this.set('opacity', options.opacity as any);
    // Short aliases
    if (options.ff && !options.fontFamily) this.set('font-family', options.ff as any);
    if (options.fs !== undefined && options.fontSize === undefined) this.set('font-size', options.fs as any);
    if (options.fw !== undefined && options.fontWeight === undefined) this.set('font-weight', options.fw as any);
    if (options.lh !== undefined && options.lineHeight === undefined) this.set('line-height', options.lh as any);
    if (options.ta && !options.textAlign) this.set('text-align', options.ta as any);
    if (options.tt && !options.textTransform) this.set('text-transform', options.tt as any);
    if (options.f) this.set('font', options.f as any);
    return this;
  }

  /**
   * Box model shorthand.
   * Sets margin, padding, border, and dimension properties.
   * 
   * @example
   * chain().box({ padding: '24px', margin: '0 auto', width: '100%', maxWidth: 1200 })
   * chain().box({ p: '24px', m: '0 auto', w: '100%', mw: 1200 })
   */
  box(options: import('./shorthand-types.js').BoxOptions): this {
    // Margin
    if (options.margin !== undefined) this.set('margin', options.margin as any);
    if (options.marginTop !== undefined) this.set('margin-top', options.marginTop as any);
    if (options.marginRight !== undefined) this.set('margin-right', options.marginRight as any);
    if (options.marginBottom !== undefined) this.set('margin-bottom', options.marginBottom as any);
    if (options.marginLeft !== undefined) this.set('margin-left', options.marginLeft as any);
    // Padding
    if (options.padding !== undefined) this.set('padding', options.padding as any);
    if (options.paddingTop !== undefined) this.set('padding-top', options.paddingTop as any);
    if (options.paddingRight !== undefined) this.set('padding-right', options.paddingRight as any);
    if (options.paddingBottom !== undefined) this.set('padding-bottom', options.paddingBottom as any);
    if (options.paddingLeft !== undefined) this.set('padding-left', options.paddingLeft as any);
    // Border
    if (options.border) this.set('border', options.border as any);
    if (options.borderRadius !== undefined) this.set('border-radius', options.borderRadius as any);
    if (options.borderWidth !== undefined) this.set('border-width', options.borderWidth as any);
    if (options.borderColor) this.set('border-color', options.borderColor as any);
    if (options.borderStyle) this.set('border-style', options.borderStyle as any);
    if (options.borderTop) this.set('border-top', options.borderTop as any);
    if (options.borderRight) this.set('border-right', options.borderRight as any);
    if (options.borderBottom) this.set('border-bottom', options.borderBottom as any);
    if (options.borderLeft) this.set('border-left', options.borderLeft as any);
    // Dimensions
    if (options.width !== undefined) this.set('width', options.width as any);
    if (options.minWidth !== undefined) this.set('min-width', options.minWidth as any);
    if (options.maxWidth !== undefined) this.set('max-width', options.maxWidth as any);
    if (options.height !== undefined) this.set('height', options.height as any);
    if (options.minHeight !== undefined) this.set('min-height', options.minHeight as any);
    if (options.maxHeight !== undefined) this.set('max-height', options.maxHeight as any);
    // Overflow
    if (options.overflow) this.set('overflow', options.overflow as any);
    if (options.overflowX) this.set('overflow-x', options.overflowX as any);
    if (options.overflowY) this.set('overflow-y', options.overflowY as any);
    // Short aliases
    if (options.m !== undefined && options.margin === undefined) this.set('margin', options.m as any);
    if (options.p !== undefined && options.padding === undefined) this.set('padding', options.p as any);
    if (options.br !== undefined && options.borderRadius === undefined) this.set('border-radius', options.br as any);
    if (options.w !== undefined && options.width === undefined) this.set('width', options.w as any);
    if (options.h !== undefined && options.height === undefined) this.set('height', options.h as any);
    return this;
  }

  /**
   * Position shorthand.
   * Sets position, top/right/bottom/left, and z-index.
   * 
   * @example
   * chain().position({ type: 'absolute', top: 0, left: 0, zIndex: 10 })
   * chain().position({ t: 'absolute', inset: 0, z: 10 })
   */
  position(options: import('./shorthand-types.js').PositionOptions): this {
    if (options.type) this.set('position', options.type as any);
    if (options.top !== undefined) this.set('top', options.top as any);
    if (options.right !== undefined) this.set('right', options.right as any);
    if (options.bottom !== undefined) this.set('bottom', options.bottom as any);
    if (options.left !== undefined) this.set('left', options.left as any);
    if (options.inset !== undefined) this.set('inset', options.inset as any);
    if (options.zIndex !== undefined) this.set('z-index', options.zIndex as any);
    // Short aliases
    if (options.t && !options.type) this.set('position', options.t as any);
    if (options.z !== undefined && options.zIndex === undefined) this.set('z-index', options.z as any);
    return this;
  }

  transition(options?: import('./shorthand-types.js').TransitionOptions | string): this {
    // Case 1: No arguments → do nothing
    if (options === undefined) {
      return this;
    }
    
    // Case 2: String → old macro behavior: .transition('all 0.2s ease')
    if (typeof options === 'string') {
      this.set('transition', options);
      return this;
    }
    
    // Case 3: Object → new shorthand
    if (typeof options === 'object') {
      if (options.property) this.set('transition-property', options.property as any);
      if (options.duration) this.set('transition-duration', options.duration as any);
      if (options.timing) this.set('transition-timing-function', options.timing as any);
      if (options.delay) this.set('transition-delay', options.delay as any);
      if (options.behavior) this.set('transition-behavior', options.behavior as any);
      // Short aliases
      if (options.p && !options.property) this.set('transition-property', options.p as any);
      if (options.d && !options.duration) this.set('transition-duration', options.d as any);
      if (options.t && !options.timing) this.set('transition-timing-function', options.t as any);
      if (options.tr) this.set('transition', options.tr as any);
    }
    
    return this;
  }

  /**
   * Transform shorthand.
   * Sets transform and transform-origin properties.
   * 
   * @example
   * chain().transform({ translateX: '-50%', translateY: '-50%', scale: 1.1 })
   */
  transform(options?: import('./shorthand-types.js').TransformOptions | string): this {
    // Case 1: String → old CSS property: transform('scale(1.05)')
    if (typeof options === 'string') {
      this.set('transform', options);
      return this;
    }
    
    // Case 2: No args → do nothing
    if (options === undefined) {
      return this;
    }
    
    // Case 3: Object → new shorthand
    if (typeof options === 'object') {
      const parts: string[] = [];
      if (options.translate) parts.push(`translate(${options.translate})`);
      if (options.translateX !== undefined && options.translateY === undefined && options.translateZ === undefined) {
        parts.push(`translateX(${options.translateX})`);
      } else if (options.translateX === undefined && options.translateY !== undefined && options.translateZ === undefined) {
        parts.push(`translateY(${options.translateY})`);
      } else if (options.translateX !== undefined || options.translateY !== undefined || options.translateZ !== undefined) {
        const tx = options.translateX ?? 0;
        const ty = options.translateY ?? 0;
        const tz = options.translateZ;
        parts.push(tz ? `translate3d(${tx}, ${ty}, ${tz})` : `translate(${tx}, ${ty})`);
      }
      if (options.scale !== undefined) parts.push(`scale(${options.scale})`);
      if (options.scaleX !== undefined) parts.push(`scaleX(${options.scaleX})`);
      if (options.scaleY !== undefined) parts.push(`scaleY(${options.scaleY})`);
      if (options.rotate) parts.push(`rotate(${options.rotate})`);
      if (options.skew) parts.push(`skew(${options.skew})`);
      if (options.skewX !== undefined) parts.push(`skewX(${options.skewX})`);
      if (options.skewY !== undefined) parts.push(`skewY(${options.skewY})`);
      if (options.origin) this.set('transform-origin', options.origin as any);
      if (parts.length > 0) this.set('transform', parts.join(' '));
    }
    
    return this;
  }

  /**
   * Filter/effects shorthand.
   * Sets filter and backdrop-filter properties.
   * 
   * @example
   * chain().filter({ blur: 5, brightness: 1.1 })
   */
  filter(options: import('./shorthand-types.js').FilterOptions): this {
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
    if (options.backdrop) this.set('backdrop-filter', options.backdrop as any);
    if (parts.length > 0) this.set('filter', parts.join(' '));
    return this;
  }

  /**
   * Shadow shorthand.
   * Sets box-shadow and/or text-shadow.
   * 
   * @example
   * chain().shadow({ box: '0 4px 12px rgba(0,0,0,0.1)' })
   * chain().shadow({ x: 0, y: 4, blur: 12, color: 'rgba(0,0,0,0.1)' })
   */
  shadow(options: import('./shorthand-types.js').ShadowOptions): this {
    if (options.box) {
      this.set('box-shadow', options.box as any);
    } else if (options.x !== undefined || options.y !== undefined) {
      const x = options.x ?? 0;
      const y = options.y ?? 0;
      const blur = options.blur ?? 0;
      const spread = options.spread !== undefined ? ` ${options.spread}` : '';
      const color = options.color ? ` ${options.color}` : '';
      const inset = options.inset ? ' inset' : '';
      this.set('box-shadow', `${x} ${y} ${blur}${spread}${color}${inset}`);
    }
    if (options.text) this.set('text-shadow', options.text as any);
    return this;
  }

  /**
   * Container query shorthand.
   * 
   * @example
   * chain().container({ type: 'inline-size', name: 'card' })
   */
  containerQuery(options: import('./shorthand-types.js').ContainerOptions): this {
    if (options.type) this.set('container-type', options.type as any);
    if (options.name) this.set('container-name', options.name as any);
    return this;
  }

  /**
   * Outline shorthand.
   * Sets outline-width, outline-style, outline-color, and outline-offset.
   * 
   * @example
   * chain().outline({ width: '2px', style: 'solid', color: '#6366f1', offset: '2px' })
   * chain().outline({ w: '2px', s: 'solid', c: '#6366f1' })
   * chain().outline({ o: '2px solid #6366f1' })
   */
  outline(options: import('./shorthand-types.js').OutlineOptions): this {
    if (options.width !== undefined) this.set('outline-width', options.width as any);
    if (options.style) this.set('outline-style', options.style as any);
    if (options.color) this.set('outline-color', options.color as any);
    if (options.offset !== undefined) this.set('outline-offset', options.offset as any);
    // Short aliases
    if (options.w !== undefined && options.width === undefined) this.set('outline-width', options.w as any);
    if (options.s && !options.style) this.set('outline-style', options.s as any);
    if (options.c && !options.color) this.set('outline-color', options.c as any);
    if (options.o) this.set('outline', options.o as any);
    return this;
  }

  /**
   * Scroll shorthand.
   * Sets scroll-behavior, scroll-snap-*, scroll-margin, scroll-padding,
   * scrollbar styling, and overflow.
   * 
   * @example
   * chain().scroll({ behavior: 'smooth', snapType: 'x mandatory', overflowX: 'auto' })
   * chain().scroll({ b: 'smooth', overflowX: 'scroll' })
   */
  scroll(options: import('./shorthand-types.js').ScrollOptions): this {
    if (options.behavior) this.set('scroll-behavior', options.behavior as any);
    if (options.snapType) this.set('scroll-snap-type', options.snapType as any);
    if (options.snapAlign) this.set('scroll-snap-align', options.snapAlign as any);
    if (options.snapStop) this.set('scroll-snap-stop', options.snapStop as any);
    if (options.margin !== undefined) this.set('scroll-margin', options.margin as any);
    if (options.marginTop !== undefined) this.set('scroll-margin-top', options.marginTop as any);
    if (options.marginRight !== undefined) this.set('scroll-margin-right', options.marginRight as any);
    if (options.marginBottom !== undefined) this.set('scroll-margin-bottom', options.marginBottom as any);
    if (options.marginLeft !== undefined) this.set('scroll-margin-left', options.marginLeft as any);
    if (options.padding !== undefined) this.set('scroll-padding', options.padding as any);
    if (options.paddingTop !== undefined) this.set('scroll-padding-top', options.paddingTop as any);
    if (options.paddingRight !== undefined) this.set('scroll-padding-right', options.paddingRight as any);
    if (options.paddingBottom !== undefined) this.set('scroll-padding-bottom', options.paddingBottom as any);
    if (options.paddingLeft !== undefined) this.set('scroll-padding-left', options.paddingLeft as any);
    if (options.scrollbarWidth) this.set('scrollbar-width', options.scrollbarWidth as any);
    if (options.scrollbarColor) this.set('scrollbar-color', options.scrollbarColor as any);
    if (options.overflowX) this.set('overflow-x', options.overflowX as any);
    if (options.overflowY) this.set('overflow-y', options.overflowY as any);
    // Short aliases
    if (options.b && !options.behavior) this.set('scroll-behavior', options.b as any);
    return this;
  }

  /**
   * List style shorthand.
   * Sets list-style-type, list-style-position, and list-style-image.
   * 
   * @example
   * chain().list({ style: 'none', position: 'inside' })
   * chain().list({ list: 'disc outside' })
   */
  list(options: import('./shorthand-types.js').ListOptions): this {
    if (options.style) this.set('list-style-type', options.style as any);
    if (options.position) this.set('list-style-position', options.position as any);
    if (options.image) this.set('list-style-image', options.image as any);
    if (options.list) this.set('list-style', options.list as any);
    return this;
  }

  /**
   * Raw CSS property setter.
   * Accepts either key-value pair or an object of multiple properties.
   * 
   * @example
   * chain().raw('outline', 'none')
   * chain().raw({ outline: 'none', resize: 'vertical', cursor: 'pointer' })
   */
  raw(prop: string | Record<string, any>, value?: any): this {
    if (typeof prop === 'string') {
      this.set(prop, value);
    } else if (typeof prop === 'object') {
      for (const [key, val] of Object.entries(prop)) {
        this.set(key, val);
      }
    }
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

  media(query: string, fn: (c: ChainProxy) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addMedia(query, childResult);
    return this;
  }

  supports(condition: string, fn: (c: ChainProxy) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addSupports(condition, childResult);
    return this;
  }

  container(query: string, fn: (c: ChainProxy) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addContainer(query, childResult);
    return this;
  }

  layer(name: string, fn: (c: ChainProxy) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addLayer(name, childResult);
    return this;
  }

  nest(selector: string, fn: (c: ChainProxy) => void): this {
    const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
    this.rules.addNested(selector, childResult);
    return this;
  }

  children(fn: (c: ChainProxy) => void): this {
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

  when(condition: boolean, fn: (c: ChainProxy) => void): this {
    if (condition) {
      const childResult = this.rules.buildChild(fn, () => createStyleProxyForChild({ debug: this.debugger.isEnabled(), classPrefix: this.classPrefix, tokens: this.options?.tokens }), this.debugger.isEnabled());
      for (const [key, value] of Object.entries(childResult)) {
        if (key !== 'selectors' && key !== '_atRules' && key !== '_nestedRules' && !key.startsWith('_')) {
          this.set(key, value);
        }
      }
      // Preserve atRules from child (e.g., media queries inside when())
      if (childResult._atRules && childResult._atRules.length > 0) {
        for (const rule of childResult._atRules) {
          if (rule.type === 'media') this.rules.addMedia(rule.query || '', rule.styles || {});
          else if (rule.type === 'supports') this.rules.addSupports(rule.condition || '', rule.styles || {});
          else if (rule.type === 'container') this.rules.addContainer(rule.condition || '', rule.styles || {});
          else if (rule.type === 'layer') this.rules.addLayer(rule.name || '', rule.styles || {});
          else if (rule.type === 'keyframes') this.rules.addKeyframes(rule.name || '', rule.steps || {});
          else if (rule.type === 'font-face') this.rules.addFontFace(rule.properties || {});
        }
      }
      // Preserve nested rules from child
      if (childResult._nestedRules && childResult._nestedRules.length > 0) {
        for (const rule of childResult._nestedRules) {
          this.rules.addNested(rule.selector, rule.styles);
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