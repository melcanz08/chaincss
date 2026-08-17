// src/shared/types/index.ts

/**
 * Core ChainCSS Types - Build-Time Only
 * These types are for the compiler and never ship to browser
 */

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
} from "./shorthand-types.js";

import type { 
  ChainCSSConfig,
  ChainCSSUserConfig,
} from "@shared/config/index.js";

export type DynamicValueGetter = (...args: unknown[]) => unknown;

export type MacroHandler = (
  value: any,
  catcher: Record<string, any>,
  useTokens: boolean,
) => void;
export type MacroMap = Record<string, MacroHandler>;
export type ShorthandMap = Record<string, string>;

// Fix #5: Replace `any` index signature with `unknown` for better type safety
export interface StyleDefinition {
  selectors: string[];
  hover?: Record<string, string | number>;
  atRules?: AtRule[];
  nestedRules?: NestedRule[];
  themes?: ThemeBlock[];
  _componentName?: string;
  _generateComponent?: boolean;
  _framework?: "react" | "vue" | "svelte" | "solid" | "auto";
  _propsDefinition?: Record<string, unknown>;
  customProperties?: Record<string, string | number>;
  [cssProperty: string]: unknown;
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

// ChainProxy keeps `any` — unavoidable for Proxy-based dynamic dispatch
export interface ChainProxy extends ChainShorthandMethods {
  [cssProperty: string]: any;

  hover(): ChainProxy;
  focus(): ChainProxy;
  active(): ChainProxy;
  checked(): ChainProxy;
  disabled(): ChainProxy;
  before(): ChainProxy;
  after(): ChainProxy;
  placeholder(): ChainProxy;

  end(): ChainProxy;

  media(query: string, fn: (c: ChainProxy) => void): ChainProxy;
  supports(condition: string, fn: (c: ChainProxy) => void): ChainProxy;
  container(query: string, fn: (c: ChainProxy) => void): ChainProxy;
  layer(name: string, fn: (c: ChainProxy) => void): ChainProxy;

  nest(selector: string, fn: (c: ChainProxy) => void): ChainProxy;
  children(fn: (c: ChainProxy) => void): ChainProxy;
  when(condition: boolean, fn: (c: ChainProxy) => void): ChainProxy;

  keyframes(name: string, steps: Record<string, any>): ChainProxy;
  fontFace(properties: Record<string, string>): ChainProxy;

  addClass(className: string): ChainProxy;
  enableDebug(): ChainProxy;
  explain(): any;

  $el(...selectors: string[]): StyleObject;
  build(selectors?: string[] | string): StyleObject;

  intents(names: string[]): ChainProxy;
  describe(description: string): ChainProxy;
}

// Fix #3: Discriminated union for AtRule — no more optional-field guessing
export type AtRule =
  | {
      type: "media";
      query: string;
      styles: StyleObject;
      id?: string;
      source?: { file?: string; component?: string };
      history?: any[];
    }
  | {
      type: "supports";
      condition: string;
      styles: StyleObject;
      id?: string;
      source?: { file?: string; component?: string };
      history?: any[];
    }
  | {
      type: "container";
      condition: string;
      styles: StyleObject;
      id?: string;
      source?: { file?: string; component?: string };
      history?: any[];
    }
  | {
      type: "layer";
      name: string;
      styles: StyleObject;
      id?: string;
      source?: { file?: string; component?: string };
      history?: any[];
    }
  | {
      type: "keyframes";
      name: string;
      steps: Record<string, Record<string, CSSPrimitiveValue>>;
      id?: string;
      source?: { file?: string; component?: string };
      history?: any[];
    }
  | {
      type: "font-face";
      properties: Record<string, string>;
      id?: string;
      source?: { file?: string; component?: string };
      history?: any[];
    }
  | {
      type: "counter-style" | "property";
      name?: string;
      descriptors?: Record<string, string>;
      id?: string;
      source?: { file?: string; component?: string };
      history?: any[];
    };

export interface NestedRule {
  selector: string;
  styles: StyleObject;
}

export interface ThemeBlock {
  name: string;
  styles: StyleDefinition;
  tokens: unknown;
  fallback: unknown;
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
  // Fix #5: dynamic values are functions but we keep the return as unknown to avoid `any`
  dynamic?: Record<string, (...args: unknown[]) => unknown>;
  dynamicValues?: Record<string, unknown>;
  hasDynamic?: boolean;
  warnings?: string[];
  errors?: string[];
  inspector?: {
    ir: unknown;
    pipelineReport: unknown[];
    diagnostics: unknown[];
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
  tokens: Record<string, unknown>;
  prefix: string;
  transform?: (value: unknown) => unknown;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface IntentDefinition {
  name?: string;
  category?: "layout" | "component" | "semantic" | "interaction" | string;
  description?: string;
  semantics?: Array<{ category: string; intent: string }>;
  properties?: Record<string, string | number>;
  states?: Record<string, Record<string, string | number>>;
  responsive?: Record<string, Record<string, string | number>>;
  a11y?: string[];
}
export type IntentMap = Record<string, IntentDefinition>;
export type TokenRelationship =
  DerivedRelationship | ContrastRelationship | HarmonyRelationship;

// Fix #4: Keep one canonical re-export — remove duplicate at bottom
export type { ChainCSSConfig, ChainCSSUserConfig };
export type Config = ChainCSSUserConfig;

export interface ChainCSSPlugin {
  name: string;
  setup?: (compiler: unknown) => void;
  transform?: (code: string, id: string) => string | null;
  transformCSS?: (css: string, filePath: string) => string;
  transformAST?: (ast: unknown) => unknown;
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
  value: unknown;
  description?: string;
  deprecated?: boolean;
  aliases?: string[];
}

export interface DesignTokens {
  colors: Record<string, TokenValue | string>;
  spacing: Record<string, TokenValue | string>;
  typography: Record<string, TokenValue | string>;
  breakpoints: Record<string, TokenValue | string>;
  animations: Record<string, TokenValue | unknown>;
  [key: string]: unknown;
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
  type: "derived";
  source: string;
  target: string;
  method: DerivedMethod;
}

export interface ContrastRelationship {
  type: "contrast";
  foreground: string;
  background: string | string[];
  target?: number;
  autoFix?: "auto" | "darken" | "lighten";
  priority?: number;
}

export interface HarmonyRelationship {
  type: "harmony";
  source: string;
  targets: string[];
  rule: "complementary" | "analogous" | "triadic" | "same-lightness";
}

// ============================================================================
// Math Engine Types
// ============================================================================

// Fix #6: Add modern viewport and container query units
export type CSSUnit =
  | "px" | "rem" | "em" | "%"
  | "vw" | "vh" | "vmin" | "vmax"
  | "dvw" | "dvh" | "svh" | "lvh"
  | "cqw" | "cqh" | "cqi" | "cqb" | "cqmin" | "cqmax"
  | "ch" | "ex" | "cm" | "mm" | "in" | "pt" | "pc"
  | "deg" | "rad" | "turn" | "grad"
  | "s" | "ms"
  | "dpi" | "dpcm" | "dppx";

export interface CSSMathValue {
  value: number;
  unit: CSSUnit;
}

export interface MathContext {
  rootFontSize?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  parentFontSize?: number;
  dpi?: number;
  elementWidth?: number;
  elementHeight?: number;
}

export interface MathResult {
  value: number;
  unit: CSSUnit | "calc" | "mixed";
  expression: string;
  resolved: CSSMathValue | null;
  explanations: string[];
  toString(): string;
  toCalc(): string;
}

export interface FluidTypeConfig {
  minSize: number;
  maxSize: number;
  minWidth?: number;
  maxWidth?: number;
  unit?: "px" | "rem";
  rootFontSize?: number;
}

// ============================================================================
// Self-Healing / Intent Engine Types
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
  parentStyles?: Record<string, unknown>;
  mediaContext?: string;
  themeContext?: string;
}

export type HealMode = "strict" | "dev" | "smart";
export interface HealResult {
  fixed: Record<string, unknown>;
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
  mergedComponents?: Record<string, string>;
}

export interface StyleGraphEdge {
  from: string;
  to: string;
  type: "extends" | "overrides" | "references";
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
  mergeThreshold?: number;
  sortOutput?: "specificity" | "source-order" | "topological";
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

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

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

export type OptionalKeys<T, K extends keyof T> = Omit<T, K> &
  Partial<Pick<T, K>>;

// ============================================================================
// Strict Style Types
// ============================================================================

export type CSSPrimitiveValue = string | number | (string | number)[];

export interface CSSProperties {
  [property: string]: CSSPrimitiveValue | DynamicValueGetter;
}

export interface PseudoStyles {
  [cssProperty: string]: CSSPrimitiveValue;
}

export interface PseudoClasses {
  [pseudoSelector: `&:${string}`]: PseudoStyles;
}

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
  _intents?: string[];

  [property: string]:
    | CSSPrimitiveValue
    | DynamicValueGetter
    | PseudoStyles
    | AtRule[]
    | NestedRule[]
    | string
    | string[]
    | Array<{ type: string; [key: string]: unknown }>
    | boolean
    | undefined;
}

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

export function isStyleDefinition(value: unknown): value is StyleDefinition {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as StyleDefinition).selectors)
  );
}

export function isAtRule(value: unknown): value is AtRule {
  if (typeof value !== "object" || value === null) return false;
  const type = (value as AtRule).type;
  return [
    "media", "keyframes", "font-face", "supports",
    "container", "layer", "counter-style", "property",
  ].includes(type as string);
}

export function isAtomicClass(value: unknown): value is AtomicClass {
  if (typeof value !== "object" || value === null) return false;
  const a = value as AtomicClass;
  return typeof a.className === "string" && typeof a.prop === "string";
}

export function isCompileResult(value: unknown): value is CompileResult {
  if (typeof value !== "object" || value === null) return false;
  const c = value as CompileResult;
  return typeof c.css === "string" && typeof c.classMap === "object" && typeof c.stats === "object";
}

export function isCSSPrimitiveValue(value: unknown): value is CSSPrimitiveValue {
  if (typeof value === "string" || typeof value === "number") return true;
  if (Array.isArray(value)) {
    return value.every((v) => typeof v === "string" || typeof v === "number");
  }
  return false;
}

export function isDynamicValue(
  value: unknown,
): value is (...args: unknown[]) => unknown {
  return typeof value === "function";
}

export function isPseudoStyles(value: unknown): value is PseudoStyles {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  return Object.values(value as Record<string, unknown>).every(
    (v) => isCSSPrimitiveValue(v) || isDynamicValue(v),
  );
}

export function isNestedRuleV2(value: unknown): value is NestedRule {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.selector === "string" && typeof obj.styles === "object" && obj.styles !== null;
}

export function isAtRuleV2(value: unknown): value is AtRule {
  return isAtRule(value);
}

// Fix #1: Internal keys that must never leak into regularProps
const INTERNAL_SKIP = new Set([
  "_classes", "_mixed", "_intents", "_transforms", "_name",
]);

export function parseStyleObject(
  obj: Record<string, unknown>,
): ParsedStyleObject {
  const regularProps: CSSProperties = {};
  const pseudoClasses: PseudoClasses = {};
  const atRules: AtRule[] = [];
  const nestedRules: NestedRule[] = [];
  let selectors: string | string[] | undefined;

  // Fix #2: Preserve insertion order for CSS cascade — no alphabetical sort
  const keys = Object.keys(obj);

  for (const key of keys) {
    const value = obj[key];

    // Fix #1: Skip internal metadata keys
    if (INTERNAL_SKIP.has(key)) continue;

    if (key === "_atRules" && Array.isArray(value)) {
      atRules.push(...value.filter(isAtRuleV2));
      continue;
    }
    if (key === "_nestedRules" && Array.isArray(value)) {
      nestedRules.push(...value.filter((r): r is NestedRule => isNestedRuleV2(r)));
      continue;
    }
    if (key === "_intents" && Array.isArray(value)) {
      continue; // already handled by INTERNAL_SKIP
    }

    if (key === "selectors") {
      if (
        typeof value === "string" ||
        (Array.isArray(value) && value.every((v) => typeof v === "string"))
      ) {
        selectors = value as string | string[];
      }
      continue;
    }

    if (key.startsWith("&:")) {
      if (isPseudoStyles(value)) {
        pseudoClasses[key as `&:${string}`] = value;
      }
      continue;
    }

    if (key === "nestedRules" && Array.isArray(value)) {
      nestedRules.push(...value.filter((r): r is NestedRule => isNestedRuleV2(r)));
      continue;
    }

    if (key === "atRules" && Array.isArray(value)) {
      atRules.push(...value.filter(isAtRuleV2));
      continue;
    }

    if (isCSSPrimitiveValue(value) || isDynamicValue(value)) {
      regularProps[key] = value as CSSPrimitiveValue | DynamicValueGetter;
    }
  }

  return { regularProps, pseudoClasses, atRules, nestedRules, selectors };
}

// ============================================================================
// Type Guards for new tools
// ============================================================================

export function isMathResult(value: unknown): value is MathResult {
  if (typeof value !== "object" || value === null) return false;
  const m = value as MathResult;
  return typeof m.expression === "string" && typeof m.toString === "function";
}

export function isCorrectionResult(value: unknown): value is CorrectionResult {
  if (typeof value !== "object" || value === null) return false;
  const c = value as CorrectionResult;
  return typeof c.original === "string" && typeof c.corrected === "string" && typeof c.confidence === "number";
}

export function isGraphCompileResult(value: unknown): value is GraphCompileResult {
  if (!isCompileResult(value)) return false;
  const g = value as GraphCompileResult;
  return typeof g.graph === "object" && typeof g.eliminatedDead === "number";
}

// ============================================================================
// Runtime Types (re-exported from runtime/types)
// ============================================================================

export type {
  UseChainStylesOptions,
  UseChainStylesReturn,
  RuntimeCompiledResult,
  StyleInjector,
  TokenStore,
  ChainCSSManifest,
  UseAtomicClassesReturn,
  UseChainStylesReturnVue,
  UseAtomicClassesReturnVue,
  UseChainStylesReturnSvelte,
  UseAtomicClassesReturnSvelte,
  UseChainStylesReturnSolid,
  UseAtomicClassesReturnSolid,
  HMRPayload,
  ChainCSSDebugger,
  DebugOptions,
  CSSValue,
  ResponsiveValue,
  RuntimeStyleDefinition,
} from "@frameworks/core/types.js";

export type { ChainCSSPluginOptions } from "@frameworks/build-tools/types.js";

// Fix #4: Single canonical re-export — removed duplicate at bottom
export type {
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
} from "./shorthand-types.js";