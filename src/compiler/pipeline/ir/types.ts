// src/compiler/pipeline/ir/types.ts
/** Core IR types for ChainCSS intermediate representation. */

export type IRNodeId = string;

/** Source location for debugging and source maps */
export interface SourceLocation {
  file?: string;
  line?: number;
  column?: number;
  component?: string;
}

/** A single CSS declaration (property: value) */
export interface IRDeclaration {
  id: IRNodeId;
  property: string;
  value: string | number;
  important?: boolean;
  source?: SourceLocation;
  /** Transform history — who modified this and why */
  history: IRTransformRecord[];
  /** Metadata from passes */
  meta: Record<string, any>;
}

/** A CSS rule (selector + declarations + nested rules) */
export interface IRRule {
  id: IRNodeId;
  selector: string;
  declarations: IRDeclaration[];
  pseudoClasses: IRPseudoClass[];
  atRules: IRAtRule[];
  nestedRules: IRRule[];
  /** Conditional if() expressions */
  conditions: IRCondition[];
  /** Dead code flag — set by optimizer passes */
  isDead: boolean;
  /** Specificity — set by graph pass */
  specificity: number;
  /** Content hash for deduplication */
  hash: string;
  source: SourceLocation;
  history: IRTransformRecord[];
  meta: Record<string, any>;
}

/** Pseudo-class block (hover, focus, etc.) */
export interface IRPseudoClass {
  id: IRNodeId;
  name: string; // 'hover', 'focus', 'active', etc.
  declarations: IRDeclaration[];
  source: SourceLocation;
  history: IRTransformRecord[];
}

/** At-rule block (media, keyframes, supports, etc.) */
export interface IRAtRule {
  id: IRNodeId;
  type: 'media' | 'keyframes' | 'font-face' | 'supports' | 'container' | 'layer';
  query?: string;
  name?: string;
  declarations: IRDeclaration[];
  nestedRules: IRRule[];
  source: SourceLocation;
  history: IRTransformRecord[];
}

/** CSS if() conditional */
export interface IRCondition {
  id: IRNodeId;
  property: string;
  variable: string;
  conditions: Record<string, string | number>;
  defaultValue: string | number;
  source: SourceLocation;
}

/** Transform record — who touched this node and why */
export interface IRTransformRecord {
  pass: string;       // e.g., 'intent-engine', 'math-engine', 'graph-compiler'
  action: string;     // e.g., 'corrected-value', 'resolved-unit', 'eliminated'
  timestamp: number;
  previous?: any;     // value before transform
  reason?: string;    // human-readable explanation
}

/** The full IR tree */
export interface StyleIR {
  id: string;
  rules: IRRule[];
  diagnostics: IRDiagnostic[];
  meta: {
    version: string;
    createdAt: number;
    sourceFiles: string[];
    passCount: number;
    passes: string[];
  };
}

/** Diagnostic attached to an IR node */
export interface IRDiagnostic {
  id: IRNodeId;
  nodeId: IRNodeId;
  severity: 'error' | 'warning' | 'info' | 'hint';
  message: string;
  suggestion?: string;
  pass: string;
}
