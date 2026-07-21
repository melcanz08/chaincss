// src/core/types.ts

/**
 * Core ChainCSS Types - Build-Time Only
 * These types are for the compiler and never ship to browser
 */

import type {
  GridOptions, FlexOptions, AnimationOptions, BackgroundOptions,
  TypographyOptions, BoxOptions, PositionOptions, TransitionOptions,
  TransformOptions, FilterOptions, ShadowOptions, ContainerOptions, OutlineOptions,
  ScrollOptions, ListOptions
} from './shorthand-types.js';

export type MacroHandler = (value: any, catcher: Record<string, any>, useTokens: boolean) => void;
export type MacroMap = Record<string, MacroHandler>;
export type ShorthandMap = Record<string, string>;

export interface StyleDefinition {
  selectors: string[];
  hover?: Record<string, string | number>;
  atRules?: AtRule[];
  nestedRules?: NestedRule[];
  themes?: ThemeBlock[];
  _componentName?: string;
  _generateComponent?: boolean;
  _framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'auto';
  _propsDefinition?: Record<string, any>;
  /** Explicit bucket for custom CSS properties */
  customProperties?: Record<string, string | number>;
  /** Allow arbitrary CSS properties */
  [cssProperty: string]: any;
}

// ============================================================================
// DX - api v2.12.1 
// ============================================================================

export interface ChainShorthandMethods {
  grid(options: GridOptions): ChainProxy;
  flex(options: FlexOptions): ChainProxy;
  animation(options: AnimationOptions): ChainProxy;
  background(options: BackgroundOptions): ChainProxy;
  typography(options: TypographyOptions): ChainProxy;
  box(options: BoxOptions): ChainProxy;
  position(options: PositionOptions): ChainProxy;
  transition(options: TransitionOptions): ChainProxy;
  transform(options: TransformOptions): ChainProxy;
  filter(options: FilterOptions): ChainProxy;
  shadow(options: ShadowOptions): ChainProxy;
  containerQuery(options: ContainerOptions): ChainProxy;
  outline(options: OutlineOptions): ChainProxy;
  scroll(options: ScrollOptions): ChainProxy;
  list(options: ListOptions): ChainProxy;
  raw(prop: string, value: string | number): ChainProxy;
}

export interface ChainProxy extends ChainShorthandMethods {
  // Direct CSS property access (existing proxy behavior)
  [cssProperty: string]: any;
  
  // Pseudo-classes
  hover(): ChainProxy;
  focus(): ChainProxy;
  active(): ChainProxy;
  checked(): ChainProxy;
  disabled(): ChainProxy;
  before(): ChainProxy;
  after(): ChainProxy;
  placeholder(): ChainProxy;
  
  // Pseudo-class end
  end(): ChainProxy;
  
  // At-rules
  media(query: string, fn: (c: ChainProxy) => void): ChainProxy;
  supports(condition: string, fn: (c: ChainProxy) => void): ChainProxy;
  container(query: string, fn: (c: ChainProxy) => void): ChainProxy;
  layer(name: string, fn: (c: ChainProxy) => void): ChainProxy;
  
  // Nesting
  nest(selector: string, fn: (c: ChainProxy) => void): ChainProxy;
  children(fn: (c: ChainProxy) => void): ChainProxy;
  when(condition: boolean, fn: (c: ChainProxy) => void): ChainProxy;
  
  // Keyframes & Fonts
  keyframes(name: string, steps: Record<string, any>): ChainProxy;
  fontFace(properties: Record<string, string>): ChainProxy;
  
  // Utilities
  addClass(className: string): ChainProxy;
  enableDebug(): ChainProxy;
  explain(): any;
  
  // Terminal methods
  $el(...selectors: string[]): StyleObject;
  build(selectors?: string[] | string): StyleObject;
}

export interface AtRule {
  type: 'media' | 'keyframes' | 'font-face' | 'supports' | 'container' | 'layer' | 'counter-style' | 'property';
  query?: string;
  condition?: string;
  name?: string;
  styles?: StyleObject;
  steps?: Record<string, Record<string, CSSPrimitiveValue>>;
  properties?: Record<string, string>;
  descriptors?: Record<string, string>;
}

export interface NestedRule {
  selector: string;
  styles: StyleObject;
}

export interface ThemeBlock {
  name: string;
  styles: StyleDefinition;
  tokens: any;
  fallback: any;
}

export interface AtomicClass {
  className: string;
  prop: string;
  value: string;
  usageCount: number;
  sourceFile?: string;
  hash?: string;
  rules?: string;
}

export interface CompileResult {
  css: string;
  classMap: Record<string, string>;
  atomicClasses: AtomicClass[];
  stats: CompileStats;
  dynamic?: Record<string, () => any>;  // Dynamic values preserved for runtime
  dynamicValues?: Record<string, any>;
  hasDynamic?: boolean;
  warnings?: string[];
  errors?: string[];
  inspector?: {
    ir: any;
    pipelineReport: any[];
    diagnostics: any[];
  };
}

export interface CompileStats {
  totalStyles: number;
  atomicStyles: number;
  uniqueProperties: number;
  savings: string;
  cacheHitRate?: number;
  compileTime?: number;
  deadRulesEliminated?: number;
  compressionSavings?: string;
  pipelinePasses?: number;
  totalDuration?: number;
}

export interface TokenContext {
  tokens: Record<string, any>;
  prefix: string;
  transform?: (value: any) => any;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface IntentDefinition {
  name?: string;
  category?: 'layout' | 'component' | 'semantic' | 'interaction' | string;
  description?: string;
  semantics?: Array<{ category: string; intent: string }>;
  properties?: Record<string, string | number>;
  states?: Record<string, Record<string, string | number>>;
  responsive?: Record<string, Record<string, string | number>>;
  a11y?: string[];
}
export type IntentMap = Record<string, IntentDefinition>;
export type TokenRelationship = DerivedRelationship | ContrastRelationship;

export interface ChainCSSConfig {
  inputs?: string[];
  output?: {
    cssFile?: string;
    classMapFile?: string;
    typesFile?: string;
    minify?: boolean;
    generateGlobalCSS?: boolean;
    outputDir?: string;
  };
  
  tokens?: {
    enabled?: boolean;
    prefix?: string;
    transform?: (value: any) => any;
    tokens?: Record<string, any>;
    relationships?: TokenRelationship[]; 
  };
  
  atomic?: {
    enabled?: boolean;
    threshold?: number;
    naming?: 'hash' | 'readable';
    cache?: boolean;
    cachePath?: string;
    minify?: boolean;
    mode?: 'standard' | 'atomic' | 'hybrid';
    outputStrategy?: 'component-first' | 'utility-first';
    alwaysAtomic?: string[];
    neverAtomic?: string[];
    verbose?: boolean;
    maxAtomicClasses?: number;
    reuseThreshold?: number;
  };
  
  prefixer?: {
    enabled?: boolean;
    mode?: 'auto' | 'full' | 'lightweight';
    browsers?: string[];
    sourceMap?: boolean;
    sourceMapInline?: boolean;
    remove?: boolean;
  };
  
  cachePath?: string;
  cacheEnabled?: boolean;
  persistentCachePath?: string;
  cacheMaxAgeDays?: number;
  cacheMaxSizeMB?: number;
  
  timeline?: boolean;
  sourceComments?: boolean;
  debug?: boolean;
  sourceMap?: boolean;
  watch?: boolean;
  hmr?: boolean;
  dev?: {         
    port?: number;
    publicDir?: string;
  };
  breakpoints?: Record<string, string>;
  framework?: 'react' | 'vue' | 'svelte' | 'solid' | 'angular' | 'auto';
  esmOnly?: boolean;
  namespace?: string;
  verbose?: boolean;
  silent?: boolean;
  profiling?: boolean;
  classNameGenerator?: (name: string, options?: any) => string;
  plugins?: ChainCSSPlugin[];
  minifySelectors?: boolean;
  extractCritical?: boolean;
  minify?: boolean;
  include?: string[];
  exclude?: string[];
  shorthands?: ShorthandMap;
  macros?: MacroMap;
  intents?: IntentMap;
  allowOverride?: boolean;
  presets?: Array<ChainCSSConfig | ((base: ChainCSSConfig) => ChainCSSConfig | Promise<ChainCSSConfig>)>;
  [key: string]: any;
}

export type ChainCSSUserConfig = ChainCSSConfig;
export type { ChainCSSConfig as Config };

export interface ChainCSSPlugin {
  name: string;
  setup?: (compiler: any) => void;
  transform?: (code: string, id: string) => string | null;
  transformCSS?: (css: string, filePath: string) => string;
  transformAST?: (ast: any) => any;
}

export interface CompileOptions {
  writeFiles?: boolean;
  minify?: boolean;
  sourceMap?: boolean;
  verbose?: boolean;
  watch?: boolean;
}

export interface ScanResult {
  files: string[];
  styles: StyleDefinition[];
  errors: Error[];
  warnings: string[];
}

export interface CacheEntry {
  hash: string;
  timestamp: number;
  result: CompileResult;
  dependencies: string[];
  accessCount: number;
}

export interface TokenValue {
  value: any;
  description?: string;
  deprecated?: boolean;
  aliases?: string[];
}

export interface DesignTokens {
  colors: Record<string, TokenValue | string>;
  spacing: Record<string, TokenValue | string>;
  typography: Record<string, TokenValue | string>;
  breakpoints: Record<string, TokenValue | string>;
  animations: Record<string, TokenValue | any>;
  [key: string]: any;
}

export interface BreakpointConfig {
  name: string;
  minWidth?: number;
  maxWidth?: number;
  query: string;
  priority?: number;
}

// ============================================================================
// Token Entanglement Types 
// ============================================================================
export type DerivedMethod =
  | `mix-white ${number}%`
  | `mix-black ${number}%`
  | `lighten ${number}`
  | `darken ${number}`
  | `alpha ${number}`
  | `tint ${number}%`
  | `shade ${number}%`
  | `saturate ${number}`
  | `desaturate ${number}`;

export interface DerivedRelationship {
  type: 'derived';
  source: string; // dot path: colors.primary.500
  target: string;
  method: DerivedMethod;
}

export interface ContrastRelationship {
  type: 'contrast';
  foreground: string;
  background: string | string[];
  target?: number; // default 4.5
  autoFix?: 'auto' | 'darken' | 'lighten';
  priority?: number;
}

// ============================================================================
// Math Engine Types (v3.0)
// ============================================================================

export type CSSUnit = 
  | 'px' | 'rem' | 'em' | '%' 
  | 'vw' | 'vh' | 'vmin' | 'vmax' 
  | 'ch' | 'ex' | 'cm' | 'mm' | 'in' | 'pt' | 'pc'
  | 'deg' | 'rad' | 'turn' | 'grad'
  | 's' | 'ms'
  | 'dpi' | 'dpcm' | 'dppx';

export interface CSSMathValue {
  value: number;
  unit: CSSUnit;
}

export interface MathContext {
  rootFontSize?: number;    // px, default 16
  viewportWidth?: number;   // px, default 1920
  viewportHeight?: number;  // px, default 1080
  parentFontSize?: number;  // px, default 16
  dpi?: number;             // default 96
  elementWidth?: number;    // px
  elementHeight?: number;   // px
}

export interface MathResult {
  value: number;
  unit: CSSUnit | 'calc' | 'mixed';
  expression: string;
  resolved: CSSMathValue | null;
  explanations: string[];
  toString(): string;
  toCalc(): string;
}

export interface FluidTypeConfig {
  minSize: number;
  maxSize: number;
  minWidth?: number;   // default 320
  maxWidth?: number;   // default 1280
  unit?: 'px' | 'rem';
  rootFontSize?: number; // for rem conversion
}

// ============================================================================
// Self-Healing / Intent Engine Types (v3.0)
// ============================================================================

export interface IntentRule {
  input: string | RegExp;
  output: string | ((match: RegExpMatchArray) => string);
  defaults?: Record<string, string | number>;
  confidence: number;
  description: string;
}

export interface CorrectionResult {
  original: string;
  property: string;
  corrected: string;
  defaults: Record<string, string | number>;
  confidence: number;
  intent: string;
  explanation: string;
}

export interface IntentContext {
  property?: string;
  value?: string;
  selector?: string;
  parentStyles?: Record<string, any>;
  mediaContext?: string;
  themeContext?: string;
}

export type HealMode = 'strict' | 'dev' | 'smart';
export interface HealResult {
  fixed: Record<string, any>;
  corrections: CorrectionResult[];
  warnings: string[];
  mode: HealMode;
}

// ============================================================================
// Style Graph Types 
// ============================================================================

export interface StyleGraphNode {
  id: string;
  selector: string;
  properties: Record<string, string | number>;
  specificity: number;
  dependencies: string[];
  dependents: string[];
  mediaQuery?: string;
  isDead: boolean;
  hash: string;
  sourceComponent?: string;
  /** Track merged component→selector mappings to prevent classMap loss during identical rule merging */
  mergedComponents?: Record<string, string>;
}

export interface StyleGraphEdge {
  from: string;
  to: string;
  type: 'extends' | 'overrides' | 'references';
}

export interface StyleGraph {
  nodes: Map<string, StyleGraphNode>;
  edges: StyleGraphEdge[];
  rootNodes: string[];
  leafNodes: string[];
}

export interface GraphCompileOptions {
  eliminateDead?: boolean;
  knownSelectors?: string[];
  mergeIdentical?: boolean;
  mergeThreshold?: number;     // min properties to consider merging
  sortOutput?: 'specificity' | 'source-order' | 'topological';
  verbose?: boolean;
}

export interface GraphCompileResult extends CompileResult {
  graph: StyleGraph;
  eliminatedDead: number;
  mergedRules: number;
  optimizationTime: number;
  preOptimizationSize: number;
  postOptimizationSize: number;
}

// ============================================================================
// Analyzer / IDE Types 
// ============================================================================

export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';

export interface StyleDiagnostic {
  property: string;
  value?: string;
  selector?: string;
  severity: DiagnosticSeverity;
  message: string;
  suggestion?: string;
  code?: string;
  source?: string;
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface StyleAnalysis {
  diagnostics: StyleDiagnostic[];
  conflicts: StyleDiagnostic[];
  breakpoints: BreakpointConfig[];
  unusedSelectors: string[];
  deadStyles: string[];
  duplicationWarnings: StyleDiagnostic[];
  optimizationSuggestions: StyleDiagnostic[];
  stats: {
    totalProperties: number;
    totalSelectors: number;
    shorthandOpportunities: number;
    animationSuggestions: number;
    responsiveIssues: number;
  };
}

export interface BreakpointInference {
  selector: string;
  property: string;
  currentValue: string;
  suggestedBreakpoint: string;
  suggestedValue: string;
  reason: string;
}

// ============================================================================
// Utility Types
// ============================================================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// ============================================================================
// Strict Style Types — Eliminates `any` from style-compiler.ts
// ============================================================================

/**
 * Primitive CSS value — what actually ends up in a CSS property.
 * Functions indicate dynamic values that need runtime resolution.
 */
export type CSSPrimitiveValue = string | number;

/**
 * A collection of CSS property-value pairs (no nesting, no pseudos)
 */
export interface CSSProperties {
  [property: string]: CSSPrimitiveValue | ((...args: any[]) => string);
}

/**
 * Pseudo-class styles (e.g., { backgroundColor: 'red' } inside &:hover)
 */
export interface PseudoStyles {
  [cssProperty: string]: CSSPrimitiveValue;
}

/**
 * Map of pseudo-class selectors to their styles
 */
export interface PseudoClasses {
  [pseudoSelector: `&:${string}`]: PseudoStyles;
}

/**
 * The canonical style object that flows through the compiler.
 * Separates concerns: properties, pseudos, at-rules, nested rules.
 */
export interface StyleObject {
  selectors?: string | string[];
  _atRules?: AtRule[];
  _nestedRules?: NestedRule[];
  nestedRules?: NestedRule[];
  atRules?: AtRule[];
  _classes?: string[];
  _transforms?: Array<{ type: string; [key: string]: unknown }>;
  _name?: string;
  _mixed?: boolean;
  
  /** Top-level CSS properties and structural mappings */
  [property: string]: 
    | CSSPrimitiveValue 
    | PseudoStyles 
    | AtRule[] 
    | NestedRule[] 
    | string 
    | string[] 
    | Array<{ type: string; [key: string]: unknown }> 
    | boolean 
    | undefined;
}

/**
 * Structured result of parsing a StyleObject.
 */
export interface ParsedStyleObject {
  regularProps: CSSProperties;
  pseudoClasses: PseudoClasses;
  atRules: AtRule[];
  nestedRules: NestedRule[];
  selectors?: string | string[];
}

// ============================================================================
// Type Guards
// ============================================================================

export function isStyleDefinition(value: any): value is StyleDefinition {
  return value && typeof value === 'object' && Array.isArray(value.selectors);
}

export function isAtRule(value: any): value is AtRule {
  return value && typeof value === 'object' && value.type && 
    ['media', 'keyframes', 'font-face', 'supports', 'container', 'layer'].includes(value.type);
}

export function isAtomicClass(value: any): value is AtomicClass {
  return value && typeof value === 'object' && 
    typeof value.className === 'string' &&
    typeof value.prop === 'string';
}

export function isCompileResult(value: any): value is CompileResult {
  return value && typeof value === 'object' && 
    typeof value.css === 'string' &&
    typeof value.classMap === 'object' &&
    typeof value.stats === 'object';
}

// ============================================================================
// Type Guards for strict style types
// ============================================================================

export function isCSSPrimitiveValue(value: unknown): value is CSSPrimitiveValue {
  return typeof value === 'string' || typeof value === 'number';
}

export function isDynamicValue(value: unknown): value is ((...args: any[]) => string) {
  return typeof value === 'function';
}

export function isPseudoStyles(value: unknown): value is PseudoStyles {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(v => isCSSPrimitiveValue(v));
}

export function isNestedRuleV2(value: unknown): value is NestedRule {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.selector === 'string' && 
         typeof obj.styles === 'object' && 
         obj.styles !== null;
}

export function isAtRuleV2(value: unknown): value is AtRule {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.type === 'string';
}

/**
 * Parse a raw object into a structured ParsedStyleObject.
 * Centralizes all the type-checking in one place.
 */
export function parseStyleObject(obj: Record<string, unknown>): ParsedStyleObject {
  const regularProps: CSSProperties = {};
  const pseudoClasses: PseudoClasses = {};
  const atRules: AtRule[] = [];
  const nestedRules: NestedRule[] = [];
  let selectors: string | string[] | undefined;

  // 1. Process explicit keys
  // Sort keys to ensure deterministic processing order for CSS generation
  const sortedKeys = Object.keys(obj).sort((a, b) => {
    // Structural/Internal keys (_...) should always be processed first
    const aInternal = a.startsWith('_');
    const bInternal = b.startsWith('_');
    if (aInternal && !bInternal) return -1;
    if (!aInternal && bInternal) return 1;
    return a.localeCompare(b);
  });

  for (const key of sortedKeys) {
    const value = obj[key];

    // Handle Internal Architectural Keys
    if (key === '_atRules' && Array.isArray(value)) {
        atRules.push(...(value.filter(isAtRuleV2)));
        continue;
    }
    if (key === '_nestedRules' && Array.isArray(value)) {
        nestedRules.push(...(value.filter((r): r is NestedRule => isNestedRuleV2(r))));
        continue;
    }

    // Handle Public Keys
    if (key === 'selectors') {
        if (typeof value === 'string' || (Array.isArray(value) && value.every(v => typeof v === 'string'))) {
            selectors = value as string | string[];
        }
        continue;
    }

    if (key.startsWith('&:')) {
        if (isPseudoStyles(value)) {
            pseudoClasses[key as `&:${string}`] = value;
        }
        continue;
    }

    if (key === 'nestedRules' && Array.isArray(value)) {
        nestedRules.push(...(value.filter((r): r is NestedRule => isNestedRuleV2(r))));
        continue;
    }

    if (key === 'atRules' && Array.isArray(value)) {
        atRules.push(...(value.filter(isAtRuleV2)));
        continue;
    }

    // Standard properties
    if (isCSSPrimitiveValue(value) || isDynamicValue(value)) {
        regularProps[key] = value as CSSPrimitiveValue;
    }
  }

  return { regularProps, pseudoClasses, atRules, nestedRules, selectors };
}

// ============================================================================
// Type Guards for new tools
// ============================================================================

export function isMathResult(value: any): value is MathResult {
  return value && typeof value === 'object' && 
    typeof value.expression === 'string' &&
    typeof value.toString === 'function';
}

export function isCorrectionResult(value: any): value is CorrectionResult {
  return value && typeof value === 'object' &&
    typeof value.original === 'string' &&
    typeof value.corrected === 'string' &&
    typeof value.confidence === 'number';
}

export function isGraphCompileResult(value: any): value is GraphCompileResult {
  return isCompileResult(value) && 
    typeof (value as any).graph === 'object' &&
    typeof (value as any).eliminatedDead === 'number';
}