// src/compiler/style-ir.ts
/**
 * ChainCSS Intermediate Representation (IR)
 * 
 * The single source of truth that all compiler passes read from and write to.
 * Replaces direct object mutation with a typed, traceable AST.
 * 
 * Architecture:
 *   StyleDefinition → parseIR() → StyleIR → [passes] → generateCSS()
 */

import type { StyleDefinition, AtRule, CompileResult, AtomicClass, CompileStats } from '../core/types.js';

// ============================================================================
// IR Types
// ============================================================================

/** Unique identifier for every IR node */
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

// ============================================================================
// ID Generator
// ============================================================================

let idCounter = 0;
function nextId(prefix: string = 'ir'): IRNodeId {
  return prefix + '-' + (idCounter++).toString(36) + '-' + Date.now().toString(36);
}

export function resetIdCounter(): void {
  idCounter = 0;
}

// ============================================================================
// IR Factory — create nodes safely
// ============================================================================

function record(pass: string, action: string, previous?: any, reason?: string): IRTransformRecord {
  return { pass, action, timestamp: Date.now(), previous, reason };
}

export function createDeclaration(
  property: string,
  value: string | number,
  source?: SourceLocation,
  meta: Record<string, any> = {}
): IRDeclaration {
  return {
    id: nextId('decl'),
    property,
    value,
    source,
    history: [record('parser', 'created', undefined, 'Parsed from StyleDefinition')],
    meta,
  };
}

export function createRule(
  selector: string,
  source?: SourceLocation
): IRRule {
  return {
    id: nextId('rule'),
    selector,
    declarations: [],
    pseudoClasses: [],
    atRules: [],
    nestedRules: [],
    conditions: [],
    isDead: false,
    specificity: 0,
    hash: '',
    source: source || {},
    history: [record('parser', 'created', undefined, 'Parsed from StyleDefinition')],
    meta: {},
  };
}

export function createIR(sourceFiles: string[] = []): StyleIR {
  return {
    id: nextId('ir'),
    rules: [],
    diagnostics: [],
    meta: {
      version: '1.0.0',
      createdAt: Date.now(),
      sourceFiles,
      passCount: 0,
      passes: [],
    },
  };
}

// ============================================================================
// Parser: StyleDefinition → StyleIR
// ============================================================================

/**
 * Parse a StyleDefinition (or Record<string, any>) into the IR.
 * This is the bridge — existing code produces StyleDefinition,
 * this converts it to typed IR for all downstream passes.
 */
export function parseIR(
  styles: Record<string, StyleDefinition> | Record<string, any>,
  sourceFile?: string
): StyleIR {
  const ir = createIR(sourceFile ? [sourceFile] : []);

  for (const [componentName, styleDef] of Object.entries(styles)) {
    if (!styleDef || typeof styleDef !== 'object') continue;

    const selectors = Array.isArray(styleDef.selectors)
      ? styleDef.selectors
      : styleDef.selector
        ? [styleDef.selector]
        : ['.' + componentName];

    for (const selector of selectors) {
      const rule = createRule(selector, {
        file: sourceFile,
        component: componentName,
      });

      // Parse declarations
      for (const [prop, value] of Object.entries(styleDef)) {
        // Skip metadata
        if (prop === 'selectors' || prop === 'selector' || prop.startsWith('_')) continue;
        // Skip complex sub-objects (handled separately)
        if (prop === 'hover' || prop === 'atRules' || prop === 'nestedRules' || prop === 'themes') continue;

        if (typeof value === 'string' || typeof value === 'number') {
          rule.declarations.push(createDeclaration(prop, value, rule.source));
        }
      }

      // Parse hover pseudo-class
            const hoverStyles = styleDef.hover || styleDef['&:hover'];
      if (hoverStyles && typeof hoverStyles === 'object') {
        const pc: IRPseudoClass = {
          id: nextId('hover'),
          name: 'hover',
          declarations: [],
          source: rule.source,
          history: [record('parser', 'created', undefined, 'Parsed hover block')],
        };
        for (const [prop, value] of Object.entries(hoverStyles)) {
          if (typeof value === 'string' || typeof value === 'number') {
            pc.declarations.push(createDeclaration(prop, value, rule.source));
          }
        }
        rule.pseudoClasses.push(pc);
      }

      // Parse at-rules
      if (styleDef.atRules && Array.isArray(styleDef.atRules)) {
        for (const atRule of styleDef.atRules) {
          const irAtRule: IRAtRule = {
            id: nextId('atrule'),
            type: atRule.type || 'media',
            query: atRule.query,
            name: atRule.name,
            declarations: [],
            nestedRules: [],
            source: rule.source,
            history: [record('parser', 'created', undefined, 'Parsed at-rule')],
          };

          if (atRule.styles && typeof atRule.styles === 'object') {
            for (const [prop, value] of Object.entries(atRule.styles)) {
              if (typeof value === 'string' || typeof value === 'number') {
                irAtRule.declarations.push(createDeclaration(prop, value, rule.source));
              }
            }
          }

          rule.atRules.push(irAtRule);
        }
      }

      // Parse CSS if() conditions
      if (styleDef._ifConditions && Array.isArray(styleDef._ifConditions)) {
        for (const cond of styleDef._ifConditions) {
          rule.conditions.push({
            id: nextId('cond'),
            property: cond.property,
            variable: cond.variable,
            conditions: cond.conditions || {},
            defaultValue: cond.defaultValue || '',
            source: rule.source,
          });
        }
      }

      ir.rules.push(rule);
    }
  }

  return ir;
}

// ============================================================================
// Generator: StyleIR → CSS string
// ============================================================================

function kebab(prop: string): string {
  return prop.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/**
 * Generate a CSS string from the IR.
 * This replaces the ad-hoc CSS generation scattered across modules.
 */
export function generateCSS(ir: StyleIR, options?: { minify?: boolean }): string {
  let css = '';

  for (const rule of ir.rules) {
    if (rule.isDead) continue;

    // Regular declarations
    if (rule.declarations.length > 0) {
      css += rule.selector + ' {\n';
      for (const decl of rule.declarations) {
        css += '  ' + kebab(decl.property) + ': ' + decl.value + ';\n';
      }
      css += '}\n';
    }

    // Pseudo-classes
    for (const pc of rule.pseudoClasses) {
      if (pc.declarations.length > 0) {
        css += rule.selector + ':' + pc.name + ' {\n';
        for (const decl of pc.declarations) {
          css += '  ' + kebab(decl.property) + ': ' + decl.value + ';\n';
        }
        css += '}\n';
      }
    }

    // At-rules
    for (const atRule of rule.atRules) {
      if (atRule.type === 'media' && atRule.query) {
        css += '@media ' + atRule.query + ' {\n';
        css += rule.selector + ' {\n';
        for (const decl of atRule.declarations) {
          css += '  ' + kebab(decl.property) + ': ' + decl.value + ';\n';
        }
        css += '}\n}\n';
      } else if (atRule.type === 'keyframes' && atRule.name) {
        css += '@keyframes ' + atRule.name + ' {\n';
        for (const decl of atRule.declarations) {
          css += '  ' + decl.property + ' { ' + kebab(decl.property) + ': ' + decl.value + '; }\n';
        }
        css += '}\n';
      }
    }

    // CSS if() conditions
    if (rule.conditions.length > 0) {
      css += '/* Native CSS if() */\n';
      css += rule.selector + ' {\n';
      for (const cond of rule.conditions) {
        const entries = Object.entries(cond.conditions);
        if (entries.length === 1) {
          const [c, v] = entries[0];
          css += '  ' + kebab(cond.property) + ': if(style(' + cond.variable + ': ' + c + '): ' + v + ' else ' + cond.defaultValue + ');\n';
        }
      }
      css += '}\n';
    }
  }

  return css;
}

// ============================================================================
// IR Utilities
// ============================================================================

/** Count all nodes in the IR */
export function countNodes(ir: StyleIR): { rules: number; declarations: number; pseudoClasses: number; atRules: number; conditions: number } {
  let declarations = 0, pseudoClasses = 0, atRules = 0, conditions = 0;
  for (const rule of ir.rules) {
    declarations += rule.declarations.length;
    pseudoClasses += rule.pseudoClasses.length;
    atRules += rule.atRules.length;
    conditions += rule.conditions.length;
  }
  return { rules: ir.rules.length, declarations, pseudoClasses, atRules, conditions };
}

/** Find a rule by selector */
export function findRule(ir: StyleIR, selector: string): IRRule | undefined {
  return ir.rules.find(r => r.selector === selector);
}

/** Clone an IR (deep copy) */
export function cloneIR(ir: StyleIR): StyleIR {
  return JSON.parse(JSON.stringify(ir));
}

/** Debug: print IR summary */
export function debugIR(ir: StyleIR): string {
  const counts = countNodes(ir);
  return [
    'StyleIR {',
    '  id: ' + ir.id,
    '  rules: ' + counts.rules,
    '  declarations: ' + counts.declarations,
    '  pseudoClasses: ' + counts.pseudoClasses,
    '  atRules: ' + counts.atRules,
    '  conditions: ' + counts.conditions,
    '  diagnostics: ' + ir.diagnostics.length,
    '  passes: [' + ir.meta.passes.join(', ') + ']',
    '}',
  ].join('\n');
}

// ============================================================================
// Pass Infrastructure
// ============================================================================

export type IRPass = (ir: StyleIR) => StyleIR;

/**
 * Apply a transform pass to the IR.
 * Records the pass in metadata for debugging.
 */
export function applyPass(ir: StyleIR, pass: IRPass, passName: string): StyleIR {
  const result = pass(ir);
  result.meta.passCount++;
  result.meta.passes.push(passName);
  return result;
}

/**
 * Apply multiple passes in sequence.
 */
export function applyPasses(ir: StyleIR, passes: Array<{ name: string; pass: IRPass }>): StyleIR {
  let current = ir;
  for (const { name, pass } of passes) {
    current = applyPass(current, pass, name);
  }
  return current;
}

// ============================================================================
// Bridge: compile StyleDefinition through IR
// ============================================================================

/**
 * Full pipeline: StyleDefinition → IR → passes → CSS.
 * Drop-in replacement for existing compile() calls.
 */
export function compileViaIR(
  styles: Record<string, StyleDefinition>,
  passes: Array<{ name: string; pass: IRPass }> = [],
  options?: { minify?: boolean; sourceFile?: string }
): { css: string; ir: StyleIR } {
  let ir = parseIR(styles, options?.sourceFile);

  // Apply all transform passes
  for (const { name, pass } of passes) {
    ir = applyPass(ir, pass, name);
  }

  const css = generateCSS(ir, options);
  return { css, ir };
}

// ============================================================================
// Exports
// ============================================================================

export const styleIR = {
  createIR,
  parseIR,
  generateCSS,
  createRule,
  createDeclaration,
  countNodes,
  findRule,
  cloneIR,
  debugIR,
  applyPass,
  applyPasses,
  compileViaIR,
  resetIdCounter,
};

export default styleIR;
