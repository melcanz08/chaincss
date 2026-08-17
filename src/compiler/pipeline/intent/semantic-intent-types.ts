// ============================================================================
// FILE: src/compiler/pipeline/intent/semantic-intent-types.ts
// Semantic Intent type system for user-extensible design vocabulary
// ============================================================================

export interface IntentDefinition {
  name: string;
  category: "layout" | "component" | "semantic" | "interaction" | string;
  description: string;
  semantics?: Array<{ category: string; intent: string }>;
  properties?: Record<string, string | number>;
  states?: Record<string, Record<string, string | number>>;
  responsive?: Record<string, Record<string, string | number>>;
  a11y?: string[];
  /** Relationship & Constraint fields */
  requires?: string[];
  conflicts?: string[];
  enhances?: string[];
  maxCombinations?: number;
  priority?: number;
  /** Whether this intent generates global styles (not scoped to a component) */
  global?: boolean;
    /** Global styles that apply to the entire page */
  globalStyles?: Record<string, Record<string, string | number>>;
  /**  Theme variants */
  themes?: Record<string, Partial<IntentDefinition>>;
  variants?: Record<string, Partial<IntentDefinition>>;
  /** Composition Patterns */
  compose?: Array<{
    intent: string;
    args?: Record<string, unknown>;
  }>;
  conditions?: Array<{
    when: Record<string, any>;
    add?: string[];
    remove?: string[];
  }>;
}

export interface IntentCombinationResult {
  valid: boolean;
  resolvedIntents: string[];
  warnings: string[];
  errors: string[];
  suggestions: string[];
}

export type IntentRelationType = "requires" | "conflicts" | "enhances";

export interface IntentRelation {
  source: string;
  target: string;
  type: IntentRelationType;
  reason?: string;
}

export type SemanticIntentCategory =
  | "visual"
  | "color"
  | "typography"
  | "layout"
  | "spacing"
  | "interaction"
  | "responsive"
  | "accessibility"
  | "motion"
  | "composite"
  | string;

export interface SemanticIntentDefinition {
  name: string;
  category: SemanticIntentCategory;
  description?: string;
  resolve: (ctx: SemanticIntentContext) => SemanticIntentResult;
}

export interface SemanticIntentContext {
  theme?: "light" | "dark" | "high-contrast";
  tokens?: Record<string, any>;
  config?: Record<string, any>;
  args?: Record<string, unknown>;
  variant?: string;
}

export type SemanticIntentResult =
  | SemanticIntentProperties
  | SemanticIntentComposite;

export interface SemanticIntentProperties {
  properties: Record<string, string | number>;
  states?: Record<string, Record<string, string | number>>;
  responsive?: Record<string, Record<string, string | number>>;
  a11y?: string[];
}

export interface SemanticIntentComposite {
  expandsTo: string[];
  args?: Record<string, unknown>;
}

export type SemanticIntentMap = Record<string, SemanticIntentDefinition>;

export interface SemanticIntentConfig {
  intents?: SemanticIntentMap;
}