// src/compiler/Chain.ts

import * as CSS from 'csstype';
import { shorthandMap, handleShorthand, macros } from './shorthands.js';
import { getSuggestion } from './suggestions.js';
import { resolveToken } from './token-resolver.js';
import { currentBreakpoints } from './breakpoints.js';
import { animationPresets, createAnimation, AnimationConfig } from './animations.js';
import { helpers } from './helpers.js';
import chalk from 'chalk';

/**
 * Helper to extract the correct CSS value type for a shorthand
 */
type GetCSSValue<T extends string> = T extends keyof CSS.Properties 
  ? CSS.Properties[T] 
  : any;

/**
 * Automatically generate methods for standard 1-to-1 shorthands
 */
type ShorthandMethods = {
  [K in keyof typeof shorthandMap]: (value: GetCSSValue<typeof shorthandMap[K]>) => Chain;
};

/**
 * Special handler methods
 */
interface SpecialMethods {
  // --- Spacing & Sizing ---
  mx(value: string | number): Chain;
  my(value: string | number): Chain;
  px(value: string | number): Chain;
  py(value: string | number): Chain;
  size(value: string | number): Chain;
  inset(value: string | number | { top?: any, right?: any, bottom?: any, left?: any }): Chain;
  insetX(value: string | number): Chain;
  insetY(value: string | number): Chain;
  
  // --- Gap ---
  gap(value: string | number): Chain;
  gapX(value: string | number): Chain;
  gapY(value: string | number): Chain;

  // --- Borders ---
  borderX(value: string): Chain;
  borderY(value: string): Chain;
  border(value: string | number): Chain; 

  // --- Layouts & Display ---
  flex(value?: string | boolean): Chain;
  inlineFlex(value?: any): Chain;
  grid(value?: string | boolean): Chain;
  inlineGrid(value?: any): Chain;
  cols(value: number | string): Chain;
  rows(value: number | string): Chain;
  center(type?: 'flex' | 'inline'): Chain;
  flexCenter(dir?: 'row' | 'col' | 'column'): Chain;
  gridCenter(): Chain;
  stack(config: string | number | 'row' | { spacing: any, dir?: 'row' | 'col' }): Chain;
  gridTable(minWidth: string | number): Chain;
  aspect(ratio: 'square' | 'video' | 'golden' | string): Chain;

  // --- Visibility & Behavior ---
  hide(): Chain;
  show(): Chain;
  unselectable(): Chain;
  scrollable(axis?: 'x' | 'y' | 'both'): Chain;
  safeArea(edge?: 'top' | 'bottom' | 'left' | 'right' | 'all' | string[]): Chain;

  // --- Positioning ---
  absolute(coords?: { top?: any, right?: any, bottom?: any, left?: any }): Chain;
  fixed(coords?: { top?: any, right?: any, bottom?: any, left?: any }): Chain;
  sticky(coords?: { top?: any, right?: any, bottom?: any, left?: any }): Chain;
  relative(coords?: { top?: any, right?: any, bottom?: any, left?: any }): Chain;

  // --- Shapes & Typography ---
  circle(size: string | number): Chain;
  square(size: string | number): Chain;
  truncate(): Chain;
  fluidText(config: { min: number | string, max: number | string, vw?: string }): Chain;

  // --- Aesthetic Effects ---
  glass(blur?: string | number): Chain;
  glow(config: string | { color: string, size?: number }): Chain;
  textGradient(colors: string[] | { colors: string[], angle?: number }): Chain;
  meshGradient(colors: string[]): Chain;
  noise(opacity?: number): Chain;

  // --- State & Logic ---
  skeleton(active: boolean | { active: boolean, color?: string, highlight?: string }): Chain;
  clickScale(amount?: number): Chain;
  onInteracting(callback: (css: Chain) => void): Chain;
  children(callback: (css: Chain) => void): Chain;
  dark(callback: (css: Chain) => void): Chain;
  light(callback: (css: Chain) => void): Chain;

  // --- Transforms ---
  scale(value: number): Chain;
  rotate(value: string | number): Chain;
  x(value: string | number): Chain;
  y(value: string | number): Chain;
  skew(value: string | number): Chain;

  // --- Utility ---
  pill(): Chain;
  containerMacro(maxWidth?: string | number): Chain;
  fullScreen(zIndex?: number): Chain;
  shimmer(): Chain;
  bento(cols?: number): Chain;
  pressable(): Chain;
  focusRing(color?: string): Chain;
  outlineDebug(): Chain;
  parallax(scale?: number): Chain;
  lineClamp(lines?: number): Chain;
  frostedNav(blur?: number | string): Chain;
}

interface ChainBase {
  // Finalizers
  $el(...selectors: string[]): any;
  end(): Chain;

  // State & Nesting
  hover(): Chain;
  nest(selector: string, callback: (css: Chain) => void): Chain;
  use(mixin: Record<string, any>): Chain;
  when(condition: boolean, callback: (css: Chain) => void): Chain;

  // Responsive & AT-Rules
  responsive(breakpoint: string, callback: (css: Chain) => void): Chain;
  media(query: string, callback: (css: Chain) => void): Chain;
  supports(condition: string, callback: (css: Chain) => void): Chain;
  containerQuery(condition: string, callback: (css: Chain) => void): Chain;
  layer(name: string, callback: (css: Chain) => void): Chain;
  keyframes(name: string, steps: Record<string, any>): Chain;
  fontFace(properties: Record<string, string>): Chain;

  // Component Logic
  componentName(name: string): Chain;
  component(framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'auto'): Chain;
  props(propsDefinition?: Record<string, any>): Chain;

  // Animations
  animation(name: string, config?: AnimationConfig): Chain;
  animate(name: string, keyframes: Record<string, any>, config?: AnimationConfig): Chain;
  duration(v: string): Chain;
  delay(v: string): Chain;
  timing(v: string): Chain;
  iteration(v: string | number): Chain;
  infinite(): Chain;

  // Math Helpers
  calc(expr: string): any;
  add(...args: any[]): any;
  subtract(...args: any[]): any;
  sub(...args: any[]): any;
  multiply(...args: any[]): any;
  mul(...args: any[]): any;
  divide(...args: any[]): any;
  div(...args: any[]): any;
  mpx(v: number | string): string;
  rem(v: number | string): string;
  em(v: number | string): string;
  percent(v: number | string): string;
  vw(v: number | string): string;
  vh(v: number | string): string;
  min(...args: any[]): any;
  max(...args: any[]): any;
  clamp(min: any, val: any, max: any): any;

  // Meta
  debug(): Chain;
  explain(shorthand: string): Chain;
}

type CSSMethods = {
  [K in keyof CSS.Properties]-?: (value: CSS.Properties[K]) => Chain;
};

export type Chain = SpecialMethods & ChainBase & CSSMethods & ShorthandMethods;

let currentTokenContext: any = null;

export function setTokenContext(context: any): void {
  currentTokenContext = context;
}

export function getTokenContext(): any {
  return currentTokenContext;
}

let debugMode = false;

export function enableDebug(enable: boolean = true): void {
  debugMode = enable;
  if (enable) {
    console.log('🔍 ChainCSS Debug Mode Enabled');
  }
}

// ============================================================================
// Whitelist of public methods accessible via Proxy
// ============================================================================
const PUBLIC_METHODS = new Set([
  // Finalizers
  '$el', 'end',
  // State & Nesting
  'hover', 'use', 'when', 'nest',
  // Component
  'component', 'componentName', 'props',
  // Responsive & AT-Rules
  'responsive', 'media', 'supports', 'containerQuery', 'layer',
  'keyframes', 'fontFace',
  // Animations
  'animation', 'animate', 'duration', 'delay', 'timing',
  'iteration', 'infinite',
  // Math Helpers
  'calc', 'add', 'subtract', 'sub', 'multiply', 'mul',
  'divide', 'div', 'mpx', 'rem', 'em', 'percent',
  'vw', 'vh', 'min', 'max', 'clamp',
  // Meta
  'debug', 'explain'
]);

// ============================================================================
// Main Chain Class
// ============================================================================
export class ChainClass {
  private catcher: Record<string, any> = {};
  private useTokens: boolean;
  private hoverCatcher: Record<string, any> | null = null;
  private valueCache = new Map<string, any>();
  private readonly MAX_CACHE_SIZE = 200;
  public __proxy: any = null;
  
  constructor(useTokens: boolean = true) {
    this.useTokens = useTokens;
  }
  
  // ==========================================================================
  // Core Methods
  // ==========================================================================
  
  private resolveValue(value: any): any {
    const cacheKey = typeof value === 'function' ? `fn_${value.toString().slice(0, 100)}` : JSON.stringify(value);
    if (this.valueCache.has(cacheKey)) {
      return this.valueCache.get(cacheKey);
    }
    
    let resolved = value;
    if (typeof value === 'function') {
      resolved = value(helpers);
    }
    if (this.useTokens && typeof resolved === 'string' && resolved.includes('$')) {
      const tokenResolved = resolveToken(resolved, this.useTokens, currentTokenContext);
      resolved = tokenResolved !== undefined && tokenResolved !== null ? tokenResolved : resolved;
    }
    
    // Prune cache if too large
    if (this.valueCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.valueCache.keys().next().value;
      if (firstKey) this.valueCache.delete(firstKey);
    }
    
    this.valueCache.set(cacheKey, resolved);
    return resolved;
  }
  
  private setTransform(type: string, value: any): this {
    if (!this.catcher._transforms) this.catcher._transforms = {};
    this.catcher._transforms[type] = this.resolveValue(value);
    return this.__proxy || this;
  }
  
  private setProperty(prop: string, value: any): any {
    // Handle shorthand first
    if (handleShorthand(prop, value, this.catcher, this.useTokens)) {
      return this.__proxy || this;
    }
    
    const mappedProp = shorthandMap[prop] || prop;
    let resolvedValue = this.resolveValue(value);

    if (debugMode) {
      const displayProp = prop === mappedProp ? prop : `${prop} (${mappedProp})`;
      console.log(
        chalk.blue(`[ChainCSS Debug]`), 
        chalk.gray(displayProp), 
        '->', 
        chalk.green(resolvedValue)
      );
    }

    // Auto-unit logic: if it's a number and needs a unit, add 'px'
    const unitlessProperties = new Set([
      'zIndex', 'opacity', 'flex', 'order', 'flexGrow', 'flexShrink', 'flexBasis',
      'fontWeight', 'lineHeight', 'scale', 'zoom', 'animationIterationCount',
      'columnCount', 'orphans', 'widows', 'tabSize'
    ]);
    
    if (typeof resolvedValue === 'number' && !unitlessProperties.has(prop) && !unitlessProperties.has(mappedProp)) {
      resolvedValue = `${resolvedValue}px`;
    }
    
    if (this.hoverCatcher !== null) {
      this.hoverCatcher[mappedProp] = resolvedValue;
    } else {
      this.catcher[mappedProp] = resolvedValue;
    }
    return this.__proxy || this;
  }
  
  // ==========================================================================
  // Proxy handler - routes all property access
  // ==========================================================================
  
  get(prop: string | symbol): any {
    if (typeof prop === 'symbol') return undefined;
    
    // ===== MACROS (check first - they take priority) =====
    
    // Spacing & Sizing
    if (prop === 'mx') return (value: string | number) => this.macroHandler('mx', value);
    if (prop === 'my') return (value: string | number) => this.macroHandler('my', value);
    if (prop === 'px') return (value: string | number) => this.macroHandler('px', value);
    if (prop === 'py') return (value: string | number) => this.macroHandler('py', value);
    if (prop === 'size') return (value: string | number) => this.macroHandler('size', value);
    if (prop === 'inset') return (value: any) => this.macroHandler('inset', value);
    if (prop === 'insetX') return (value: string | number) => this.macroHandler('insetX', value);
    if (prop === 'insetY') return (value: string | number) => this.macroHandler('insetY', value);
    
    // Borders
    if (prop === 'borderX') return (value: string) => this.macroHandler('borderX', value);
    if (prop === 'borderY') return (value: string) => this.macroHandler('borderY', value);
    
    // Layout & Display
    if (prop === 'flex') return (value?: string | boolean) => this.macroHandler('flex', value);
    if (prop === 'inlineFlex') return (value?: any) => this.macroHandler('inlineFlex', value);
    if (prop === 'grid') return (value?: string | boolean) => this.macroHandler('grid', value);
    if (prop === 'inlineGrid') return (value?: any) => this.macroHandler('inlineGrid', value);
    if (prop === 'cols') return (value: number | string) => this.macroHandler('cols', value);
    if (prop === 'rows') return (value: number | string) => this.macroHandler('rows', value);
    if (prop === 'center') return (type?: 'flex' | 'inline') => this.macroHandler('center', type);
    if (prop === 'flexCenter') return (dir?: 'row' | 'col' | 'column') => this.macroHandler('flexCenter', dir);
    if (prop === 'gridCenter') return () => this.macroHandler('gridCenter');
    if (prop === 'stack') return (config: any) => this.macroHandler('stack', config);
    if (prop === 'gridTable') return (minWidth: string | number) => this.macroHandler('gridTable', minWidth);
    if (prop === 'aspect') return (ratio: string) => this.macroHandler('aspect', ratio);
    
    // Visibility & Behavior
    if (prop === 'hide') return () => this.macroHandler('hide');
    if (prop === 'show') return () => this.macroHandler('show');
    if (prop === 'unselectable') return () => this.macroHandler('unselectable');
    if (prop === 'scrollable') return (axis?: 'x' | 'y' | 'both') => this.macroHandler('scrollable', axis);
    if (prop === 'safeArea') return (edge?: any) => this.macroHandler('safeArea', edge);
    
    // Positioning
    if (prop === 'absolute') return (coords?: any) => this.macroHandler('absolute', coords);
    if (prop === 'fixed') return (coords?: any) => this.macroHandler('fixed', coords);
    if (prop === 'sticky') return (coords?: any) => this.macroHandler('sticky', coords);
    if (prop === 'relative') return (coords?: any) => this.macroHandler('relative', coords);
    
    // Shapes & Typography
    if (prop === 'circle') return (size: string | number) => this.macroHandler('circle', size);
    if (prop === 'square') return (size: string | number) => this.macroHandler('square', size);
    if (prop === 'truncate') return () => this.macroHandler('truncate');
    if (prop === 'fluidText') return (config: any) => this.macroHandler('fluidText', config);
    
    // Aesthetic Effects
    if (prop === 'glass') return (blur?: string | number) => this.macroHandler('glass', blur);
    if (prop === 'glow') return (config: any) => this.macroHandler('glow', config);
    if (prop === 'textGradient') return (colors: any) => this.macroHandler('textGradient', colors);
    if (prop === 'meshGradient') return (colors: string[]) => this.macroHandler('meshGradient', colors);
    if (prop === 'noise') return (opacity?: number) => this.macroHandler('noise', opacity);
    
    // State & Logic
    if (prop === 'skeleton') return (active: any) => this.macroHandler('skeleton', active);
    if (prop === 'clickScale') return (amount?: number) => this.macroHandler('clickScale', amount);
    if (prop === 'onInteracting') return (callback: (css: Chain) => void) => this.macroHandler('onInteracting', callback);
    if (prop === 'children') return (callback: (css: Chain) => void) => this.macroHandler('children', callback);
    if (prop === 'dark') return (callback: (css: Chain) => void) => this.macroHandler('dark', callback);
    if (prop === 'light') return (callback: (css: Chain) => void) => this.macroHandler('light', callback);
    
    // Utility
    if (prop === 'pill') return () => this.macroHandler('pill');
    if (prop === 'containerMacro') return (maxWidth?: string | number) => this.macroHandler('containerMacro', maxWidth);
    if (prop === 'fullScreen') return (zIndex?: number) => this.macroHandler('fullScreen', zIndex);
    if (prop === 'shimmer') return () => this.macroHandler('shimmer');
    if (prop === 'bento') return (cols?: any) => this.macroHandler('bento', cols);
    if (prop === 'pressable') return () => this.macroHandler('pressable');
    if (prop === 'focusRing') return (color?: string) => this.macroHandler('focusRing', color);
    if (prop === 'outlineDebug') return () => this.macroHandler('outlineDebug');
    if (prop === 'parallax') return (scale?: number) => this.macroHandler('parallax', scale);
    if (prop === 'lineClamp') return (lines?: number) => this.macroHandler('lineClamp', lines);
    if (prop === 'frostedNav') return (blur?: number | string) => this.macroHandler('frostedNav', blur);
    
    // Gap macros
    if (prop === 'gap') return (value: string | number) => this.setProperty('gap', value);
    if (prop === 'gapX') return (value: string | number) => this.setProperty('columnGap', value);
    if (prop === 'gapY') return (value: string | number) => this.setProperty('rowGap', value);
    
    // ===== PUBLIC METHODS =====
    if (prop === 'hover') return this.createHover.bind(this);
    if (prop === 'end') return this.endHover.bind(this);
    if (prop === 'use') return this.useMixin.bind(this);
    if (prop === 'when') return this.whenCondition.bind(this);
    if (prop === 'nest') return this.nestSelector.bind(this);
    if (prop === 'component') return this.setComponent.bind(this);
    if (prop === 'componentName') return this.setComponentName.bind(this);
    if (prop === 'props') return this.setProps.bind(this);
    if (prop === 'debug') return this.enableDebugMode.bind(this);
    if (prop === 'explain') return this.explainShorthand.bind(this);
    if (prop === '$el') return this.finalize.bind(this);
    
    // ===== TRANSFORMS =====
    if (prop === 'scale') return (value: number) => this.setTransform('scale', value);
    if (prop === 'rotate') return (value: string | number) => this.setTransform('rotate', value);
    if (prop === 'x') return (value: string | number) => this.setTransform('translateX', value);
    if (prop === 'y') return (value: string | number) => this.setTransform('translateY', value);
    if (prop === 'skew') return (value: string | number) => this.setTransform('skew', value);
    
    // ===== ANIMATIONS =====
    if (animationPresets[prop]) {
      return (config?: AnimationConfig) => this.applyAnimation(prop, config);
    }
    if (prop === 'animate') return this.createAnimation.bind(this);
    if (prop === 'duration') return (v: string) => this.setProperty('animationDuration', v);
    if (prop === 'delay') return (v: string) => this.setProperty('animationDelay', v);
    if (prop === 'timing') return (v: string) => this.setProperty('animationTimingFunction', v);
    if (prop === 'iteration') return (v: any) => this.setProperty('animationIterationCount', v);
    if (prop === 'infinite') return () => this.setProperty('animationIterationCount', 'infinite');
    
    // ===== MATH HELPERS =====
    if (prop === 'calc') return helpers.calc;
    if (prop === 'add') return helpers.add;
    if (prop === 'subtract' || prop === 'sub') return helpers.subtract;
    if (prop === 'multiply' || prop === 'mul') return helpers.multiply;
    if (prop === 'divide' || prop === 'div') return helpers.divide;
    if (prop === 'mpx') return (v: number | string) => helpers.mpx(v);
    if (prop === 'rem') return (v: number | string) => helpers.rem(v);
    if (prop === 'em') return helpers.em;
    if (prop === 'percent') return helpers.percent;
    if (prop === 'vw') return helpers.vw;
    if (prop === 'vh') return helpers.vh;
    if (prop === 'min') return helpers.min;
    if (prop === 'max') return helpers.max;
    if (prop === 'clamp') return helpers.clamp;
    
    // ===== RESPONSIVE BREAKPOINTS =====
    if (currentBreakpoints && currentBreakpoints[prop]) {
      return (callback: (chain: Chain) => any) => this.applyResponsive(prop, callback);
    }
    
    // ===== AT-RULES =====
    if (prop === 'media') return this.applyMedia.bind(this);
    if (prop === 'keyframes') return this.defineKeyframes.bind(this);
    if (prop === 'fontFace') return this.defineFontFace.bind(this);
    if (prop === 'supports') return this.applySupports.bind(this);
    if (prop === 'containerQuery') return this.applyContainerQuery.bind(this);
    if (prop === 'layer') return this.applyLayer.bind(this);
    
    // ===== CSS PROPERTY (fallthrough) =====
    return (value: any) => this.setProperty(prop, value);
  }

  // ==========================================================================
  // Finalize
  // ==========================================================================
  
  private finalize(...selectors: string[]): any {
    // Deep clone to prevent reference sharing
    const styles: any = structuredClone(this.catcher);

    // Strip component metadata from output
    delete styles._componentName;
    delete styles._generateComponent;
    delete styles._framework;
    delete styles._propsDefinition;

    // Process transforms
    if (this.catcher._transforms) {
      const t = this.catcher._transforms;
      const transformString = Object.entries(t)
        .map(([k, v]) => {
          const needsUnit = (k.includes('translate') || k === 'x' || k === 'y');
          const unit = needsUnit && typeof v === 'number' ? 'px' : '';
          return `${k}(${v}${unit})`;
        })
        .join(' ');
      styles.transform = transformString;
      delete styles._transforms;
    }
    
    // Flatten nested rules
    if (this.catcher.nestedRules) {
      styles.nestedRules = structuredClone(this.catcher.nestedRules);
    }
    
    // Process pseudo-class styles (&:hover -> :hover)
    for (const key of Object.keys(styles)) {
      if (key.startsWith('&:')) {
        const pseudoSelector = key.substring(1);
        styles[pseudoSelector] = styles[key];
        delete styles[key];
      }
    }

    this.clear();

    if (selectors.length === 0) return styles;

    if (debugMode) {
      console.log('[ChainCSS Debug] Raw selectors:', selectors);
    }

    // Clean selectors - preserve user's dots, only strip internal chain- prefix from .chain- prefixed ones
    const cleanSelectors = selectors.map(selector => {
      let clean = selector;
      // Only remove .chain- prefix if it exists
      if (clean.startsWith('.chain-')) {
        clean = clean.replace(/^\./, '').replace(/^chain-/, '');
      } else if (clean.startsWith('chain-')) {
        clean = clean.substring(6);
      }
      if (debugMode) {
        console.log(`[ChainCSS Debug] Cleaned: "${selector}" -> "${clean}"`);
      }
      return clean;
    });

    if (debugMode) {
      console.log('[ChainCSS Debug] Final selectors:', cleanSelectors);
    }

    return {
      selectors: cleanSelectors,
      ...styles
    };
  }

  // ==========================================================================
  // Public Method Implementations (renamed to avoid collisions)
  // ==========================================================================

  private macroHandler(macroName: string, value?: any): this {
    const macroFn = macros[macroName];
    if (macroFn) {
      macroFn(value, this.catcher, this.useTokens);
    } else {
      this.setProperty(macroName, value);
    }
    return this.__proxy || this;
  }
  
  private createHover(): this {
    if (debugMode) {
      console.log(`  🖱️ Hover styles added`);
    }
    this.hoverCatcher = {};
    return this.__proxy || this;
  }
  
  private endHover(): this {
    if (this.hoverCatcher !== null) {
      this.catcher.hover = { ...this.hoverCatcher };
      this.hoverCatcher = null;
    }
    return this.__proxy || this;
  }
  
  private useMixin(mixin: Record<string, any>): this {
    const { selectors, atRules, ...styles } = mixin;
    Object.assign(this.catcher, styles);
    if (atRules) {
      this.catcher.atRules = [...(this.catcher.atRules || []), ...atRules];
    }
    return this.__proxy || this;
  }
  
  private whenCondition(condition: boolean, callback: (chain: Chain) => void): this {
    if (condition) {
      callback(this.__proxy || this);
    }
    return this.__proxy || this;
  }
  
  private nestSelector(selector: string, callback: (chain: Chain) => void): this {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    
    if (!this.catcher.nestedRules) this.catcher.nestedRules = [];
    this.catcher.nestedRules.push({
      selector: selector,
      styles: result
    });
    return this.__proxy || this;
  }
  
  private setComponentName(name: string): this {
    this.catcher._componentName = name;
    return this.__proxy || this;
  }
  
  private setComponent(framework: 'react' | 'vue' | 'svelte' | 'solid' | 'auto' = 'auto'): this {
    this.catcher._generateComponent = true;
    this.catcher._framework = framework;
    return this.__proxy || this;
  }
  
  private setProps(propsDefinition?: Record<string, any>): this {
    if (propsDefinition) {
      this.catcher._propsDefinition = propsDefinition;
    }
    return this.__proxy || this;
  }
  
  private enableDebugMode(): this {
    debugMode = true;
    return this.__proxy || this;
  }
  
  private explainShorthand(shorthand: string): this {
    const mapped = shorthandMap[shorthand];
    if (mapped) {
      console.log(`\n📖 ChainCSS Explanation:`);
      console.log(`   .${shorthand}() → ${mapped}`);
      console.log(`   Example: .${shorthand}('value') sets CSS property '${mapped}'\n`);
    } else {
      const suggestion = getSuggestion(shorthand);
      if (suggestion && typeof suggestion === 'string') {
        console.log(`\n⚠️ ChainCSS: '${shorthand}' is not a recognized shorthand.`);
        console.log(`   Did you mean .${suggestion}()?\n`);
      } else {
        console.log(`\n⚠️ ChainCSS: '${shorthand}' is not a recognized shorthand or CSS property.\n`);
      }
    }
    return this.__proxy || this;
  }
  
  // ==========================================================================
  // Animation Methods
  // ==========================================================================
  
  private applyAnimation(name: string, config?: AnimationConfig): this {
    if (!name) {
      console.warn('⚠️ ChainCSS: animation() requires a name parameter');
      return this.__proxy || this;
    }
    
    if (!this.catcher.atRules) this.catcher.atRules = [];
    
    const preset = animationPresets[name];
    if (!preset && !this.catcher.atRules.some((rule: any) => rule.type === 'keyframes' && rule.name === name)) {
      console.warn(`⚠️ ChainCSS: Unknown animation preset '${name}'. Available: ${Object.keys(animationPresets).join(', ')}`);
      return this.__proxy || this;
    }
    
    const hasKeyframes = this.catcher.atRules.some(
      (rule: any) => rule.type === 'keyframes' && rule.name === name
    );
    
    if (!hasKeyframes && preset) {
      this.catcher.atRules.push({
        type: 'keyframes',
        name: name,
        steps: preset
      });
    }
    
    const animationStyles = createAnimation(name, config);
    Object.assign(this.catcher, animationStyles);
    return this.__proxy || this;
  }
  
  private createAnimation(name: string, keyframes: Record<string, any>, config?: AnimationConfig): this {
    if (!name || !keyframes) {
      console.warn('⚠️ ChainCSS: animate() requires name and keyframes parameters');
      return this.__proxy || this;
    }
    
    if (!this.catcher.atRules) this.catcher.atRules = [];
    
    this.catcher.atRules.push({
      type: 'keyframes',
      name: name,
      steps: keyframes
    });
    
    const animationStyles = createAnimation(name, config);
    Object.assign(this.catcher, animationStyles);
    return this.__proxy || this;
  }
  
  // ==========================================================================
  // Responsive & AT-Rules
  // ==========================================================================
  
  private applyResponsive(breakpoint: string, callback: (chain: Chain) => void): this {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    const { selectors, ...pureStyles } = result || {};
    
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: 'media',
      query: currentBreakpoints[breakpoint],
      styles: pureStyles
    });
    return this.__proxy || this;
  }
  
  private applyMedia(query: string, callback: (chain: Chain) => void): this {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    const { selectors, ...pureStyles } = result || {};
    
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: 'media',
      query: query,
      styles: pureStyles
    });
    return this.__proxy || this;
  }
  
  private defineKeyframes(name: string, steps: Record<string, any>): this {
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: 'keyframes',
      name: name,
      steps: steps
    });
    return this.__proxy || this;
  }
  
  private defineFontFace(properties: Record<string, string>): this {
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: 'font-face',
      properties: properties
    });
    return this.__proxy || this;
  }
  
  private applySupports(condition: string, callback: (chain: Chain) => void): this {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: 'supports',
      condition: condition,
      styles: result
    });
    return this.__proxy || this;
  }
  
  private applyContainerQuery(condition: string, callback: (chain: Chain) => void): this {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: 'container',
      condition: condition,
      styles: result
    });
    return this.__proxy || this;
  }
  
  private applyLayer(name: string, callback: (chain: Chain) => void): this {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: 'layer',
      name: name,
      styles: result
    });
    return this.__proxy || this;
  }
  
  // ==========================================================================
  // Cleanup
  // ==========================================================================
  
  private clear(): void {
    this.catcher = {};
    this.hoverCatcher = null;
    this.valueCache.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createChain(useTokens: boolean = true): Chain {
  const chained = new ChainClass(useTokens);
  
  const proxy = new Proxy(chained, {
    get(target, prop: string | symbol) {
      if (typeof prop === 'symbol') return undefined;
      
      // Only expose whitelisted public methods directly
      if (PUBLIC_METHODS.has(prop) && prop in target) {
        const val = (target as any)[prop];
        return typeof val === 'function' ? val.bind(target) : val;
      }
      
      // Route everything else through the get handler
      return target.get(prop);
    }
  });

  // Set proxy reference on the instance so methods can return it
  (chained as any).__proxy = proxy;
  
  return proxy as unknown as Chain;
}

// Default export
export const chain = (useTokens: boolean = true) => createChain(useTokens);