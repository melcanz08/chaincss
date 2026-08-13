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
}

/**
 * Categories for semantic intents.
 * Extensible — users can add their own via string union widening.
 */
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

/**
 * A single semantic intent definition.
 * `resolve` can return properties directly (simple intents)
 * or other intent names (composite intents that expand).
 */
export interface SemanticIntentDefinition {
  /** Unique name, e.g. "glass", "blueBg" */
  name: string;
  /** Category for organization and potential AI classification */
  category: SemanticIntentCategory;
  /** Human-readable description */
  description?: string;
  /**
   * Resolve this intent to CSS properties.
   * Receives a context object with theme, tokens, and config.
   * Return properties directly OR return { expandsTo: [...] } for composites.
   */
  resolve: (ctx: SemanticIntentContext) => SemanticIntentResult;
}

/**
 * Context passed to intent resolvers.
 */
export interface SemanticIntentContext {
  /** Current theme mode */
  theme?: "light" | "dark" | "high-contrast";
  /** Design tokens from config */
  tokens?: Record<string, any>;
  /** Full chaincss config */
  config?: Record<string, any>;
  /** Arguments passed with the intent, e.g. intent('spacing', { amount: 2 }) */
  args?: Record<string, unknown>;
}

/**
 * Result of resolving a semantic intent.
 * Either direct properties or a composite expansion.
 */
export type SemanticIntentResult =
  | SemanticIntentProperties
  | SemanticIntentComposite;

/**
 * Direct CSS properties from an intent.
 */
export interface SemanticIntentProperties {
  /** CSS property-value pairs */
  properties: Record<string, string | number>;
  /** Pseudo-class states (hover, focus, etc.) */
  states?: Record<string, Record<string, string | number>>;
  /** Responsive overrides */
  responsive?: Record<string, Record<string, string | number>>;
  /** Accessibility requirements */
  a11y?: string[];
}

/**
 * Composite intent — expands to other intents.
 * The registry resolves these recursively.
 */
export interface SemanticIntentComposite {
  /** Names of intents this composite expands to */
  expandsTo: string[];
  /** Optional arguments forwarded to sub-intents */
  args?: Record<string, unknown>;
}

/**
 * Map of intent name → definition.
 */
export type SemanticIntentMap = Record<string, SemanticIntentDefinition>;

/**
 * User-facing config shape for semantic intents.
 */
export interface SemanticIntentConfig {
  intents?: SemanticIntentMap;
}