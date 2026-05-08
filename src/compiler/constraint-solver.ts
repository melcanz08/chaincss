// src/compiler/constraint-solver.ts
/**
 * Constraint-Based Styling Engine
 * 
 * Declare relationships, not values. The solver resolves them to CSS.
 * 
 * @example
 *   .constrain('width', '< parent')
 *   .constrain('height', '= width * 0.5')
 *   .constrain('sidebar', 'sticky until footer')
 *   .constrain('columns', '>= 3 when > 768px')
 */

import type { StyleIR, IRRule, IRDeclaration, IRPass } from './style-ir.js';
import { createDeclaration } from './style-ir.js';

// ============================================================================
// Types
// ============================================================================

export type ConstraintOperator = '<' | '>' | '<=' | '>=' | '=' | '!=' | '≈';

export type ConstraintTarget =
  | 'parent'
  | 'viewport'
  | 'sibling'
  | 'self'
  | string; // CSS value or selector

export interface Constraint {
  property: string;
  operator: ConstraintOperator;
  expression: string;
  target?: ConstraintTarget;
  condition?: string;
}

export interface ResolvedConstraint {
  constraint: Constraint;
  cssProperty: string;
  cssValue: string;
  method: 'direct' | 'calc' | 'aspect-ratio' | 'container-query' | 'sticky' | 'clamp' | 'custom-property' | 'color-mix';
  explanation: string;
}

// ============================================================================
// Expression Parser
// ============================================================================

/**
 * Tokenize a constraint expression like "width * 0.5" or "clamp(14, parent.width / 20, 24)"
 */
function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inParens = 0;

  for (const char of expr) {
    if (char === '(') { inParens++; current += char; }
    else if (char === ')') { inParens--; current += char; }
    else if (char === ' ' && inParens === 0) {
      if (current) tokens.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * Parse a constraint expression into structured form.
 */
function parseExpression(expr: string): {
  left: string;
  operator: string;
  right: string;
  isFunction: boolean;
  functionName?: string;
  functionArgs?: string[];
} {
  const trimmed = expr.trim();

  // Check for function calls: clamp(14, parent.width / 20, 24)
  const funcMatch = trimmed.match(/^([a-zA-Z]+)\((.+)\)$/);
  if (funcMatch) {
    const args = funcMatch[2].split(',').map(a => a.trim());
    return {
      left: '',
      operator: 'function',
      right: '',
      isFunction: true,
      functionName: funcMatch[1],
      functionArgs: args,
    };
  }

  // Check for operators: *, /, +, -
  const tokens = tokenize(trimmed);
  if (tokens.length === 3) {
    return {
      left: tokens[0],
      operator: tokens[1],
      right: tokens[2],
      isFunction: false,
    };
  }

  // Single value
  return {
    left: trimmed,
    operator: '',
    right: '',
    isFunction: false,
  };
}

// ============================================================================
// Reference Resolver
// ============================================================================

const KNOWN_REFERENCES: Record<string, string> = {
  'parent': '100%',
  'parent.width': '100%',
  'parent.height': '100%',
  'viewport': '100vw',
  'viewport.width': '100vw',
  'viewport.height': '100vh',
  'self': '100%',
  'self.width': '100%',
  'self.height': '100%',
};

function resolveReference(ref: string): string {
  return KNOWN_REFERENCES[ref] || ref;
}

// ============================================================================
// Solver
// ============================================================================

/**
 * Resolve a single constraint into a CSS property+value.
 */
export function resolveConstraint(constraint: Constraint, context?: Record<string, string>): ResolvedConstraint {
  const { property, operator, expression } = constraint;
  const parsed = parseExpression(expression);

  // --- 1. Size constraints (width < parent) ---
  if (operator === '<' && expression === 'parent') {
    return {
      constraint,
      cssProperty: 'max-' + property,
      cssValue: '100%',
      method: 'direct',
      explanation: property + ' < parent → max-' + property + ': 100%',
    };
  }

  if (operator === '>' && expression === 'parent') {
    return {
      constraint,
      cssProperty: 'min-' + property,
      cssValue: '100%',
      method: 'direct',
      explanation: property + ' > parent → min-' + property + ': 100%',
    };
  }

  // --- 2. Math expression (height = width * 0.5) ---
  if (operator === '=' && parsed.operator === '*') {
    const leftRef = resolveReference(parsed.left);
    const rightNum = parseFloat(parsed.right);

    if (!isNaN(rightNum)) {
      // For width/height relations, use aspect-ratio
      if ((property === 'height' && parsed.left === 'width') ||
          (property === 'width' && parsed.left === 'height')) {
        const ratio = rightNum;
        const gcd = findGCD(Math.round(ratio * 100), 100);
        const num = Math.round(ratio * 100) / gcd;
        const den = 100 / gcd;
        return {
          constraint,
          cssProperty: 'aspect-ratio',
          cssValue: num + ' / ' + den,
          method: 'aspect-ratio',
          explanation: property + ' = ' + expression + ' → aspect-ratio: ' + num + '/' + den,
        };
      }

      // General math: use calc()
      return {
        constraint,
        cssProperty: property,
        cssValue: 'calc(' + leftRef + ' * ' + rightNum + ')',
        method: 'calc',
        explanation: property + ' = ' + expression + ' → calc(' + leftRef + ' * ' + rightNum + ')',
      };
    }
  }

  // Expression with division: width / 20
  if (operator === '=' && parsed.operator === '/') {
    const leftRef = resolveReference(parsed.left);
    const rightNum = parseFloat(parsed.right);
    if (!isNaN(rightNum)) {
      return {
        constraint,
        cssProperty: property,
        cssValue: 'calc(' + leftRef + ' / ' + rightNum + ')',
        method: 'calc',
        explanation: property + ' = ' + expression + ' → calc(' + leftRef + ' / ' + rightNum + ')',
      };
    }
  }

  // --- 3. Function expressions (clamp, min, max) ---
  if (parsed.isFunction && parsed.functionName) {
    const resolvedArgs = (parsed.functionArgs || []).map(resolveReference);
    return {
      constraint,
      cssProperty: property,
      cssValue: parsed.functionName + '(' + resolvedArgs.join(', ') + ')',
      method: parsed.functionName as any,
      explanation: property + ' = ' + expression + ' → ' + parsed.functionName + '()',
    };
  }

  // --- 4. Simple value assignment ---
  if (operator === '=' && !parsed.operator) {
    const resolved = resolveReference(expression);
    return {
      constraint,
      cssProperty: property,
      cssValue: resolved,
      method: 'direct',
      explanation: property + ' = ' + expression + ' → ' + resolved,
    };
  }

  // --- 5. Viewport-relative ---
  if (operator === '=' && expression.includes('vw') || expression.includes('vh')) {
    return {
      constraint,
      cssProperty: property,
      cssValue: expression,
      method: 'direct',
      explanation: property + ' = ' + expression,
    };
  }

  // Fallback: pass through as calc()
  return {
    constraint,
    cssProperty: property,
    cssValue: expression,
    method: 'direct',
    explanation: property + ' = ' + expression + ' (passthrough)',
  };
}

/**
 * Resolve sticky-until constraint.
 * "sticky until footer" → position: sticky + scroll-driven animation
 */
export function resolveStickyUntil(selector: string, untilSelector: string): ResolvedConstraint {
  return {
    constraint: {
      property: 'position',
      operator: '=',
      expression: 'sticky until ' + untilSelector,
    },
    cssProperty: 'position',
    cssValue: 'sticky; top: 0; animation: sticky-' + selector.replace('.', '') + ' 1s linear both; animation-timeline: scroll(); animation-range: contain 0% contain 100%',
    method: 'sticky',
    explanation: 'sticky until ' + untilSelector + ' → position: sticky + scroll-timeline',
  };
}

// ============================================================================
// Container Query Constraint
// ============================================================================

/**
 * Resolve ">= N when > Xpx" constraints to container queries.
 */
export function resolveContainerQuery(
  property: string,
  operator: string,
  value: string,
  condition: string
): { atRule: { type: string; query: string; declarations: Array<{ property: string; value: string }> }; explanation: string } {
  const widthMatch = condition.match(/>\s*(\d+)(px|rem|em)?/);
  if (widthMatch) {
    const width = widthMatch[1] + (widthMatch[2] || 'px');
    return {
      atRule: {
        type: 'container',
        query: '(min-width: ' + width + ')',
        declarations: [{ property, value }],
      },
      explanation: property + ' ' + operator + ' ' + value + ' when > ' + width + ' → @container (min-width: ' + width + ')',
    };
  }
  return {
    atRule: { type: 'container', query: condition, declarations: [{ property, value }] },
    explanation: property + ' when ' + condition + ' → @container ' + condition,
  };
}

// ============================================================================
// Constraint Solver Pass (for IR Pipeline)
// ============================================================================

/**
 * IR Pass: resolve all constraints in the IR to concrete CSS.
 */
export const constraintSolverPass: IRPass = (ir: StyleIR): StyleIR => {
  for (const rule of ir.rules) {
    // Check for constraint metadata
    const constraints: Constraint[] = rule.meta._constraints || [];
    if (constraints.length === 0) continue;

    for (const constraint of constraints) {
      const resolved = resolveConstraint(constraint);

      // Add the resolved declaration
      rule.declarations.push({
        id: 'constraint-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
        property: resolved.cssProperty,
        value: resolved.cssValue,
        history: [{
          pass: 'constraint-solver',
          action: 'resolved-constraint',
          timestamp: Date.now(),
          reason: resolved.explanation,
        }],
        meta: { constraint },
      });
    }
  }
  return ir;
};

// ============================================================================
// Chain API Extension
// ============================================================================

/**
 * Parse a chain-style constraint call into the Constraint format.
 * 
 * @example
 *   parseConstraint('width', '< parent')
 *   // => { property: 'width', operator: '<', expression: 'parent' }
 */
export function parseConstraint(property: string, expression: string): Constraint {
  // Detect operator from expression
  let operator: ConstraintOperator = '=';
  let cleanExpr = expression;

  const opMatch = expression.match(/^([<>=!≈]+)\s*(.*)/);
  if (opMatch) {
    operator = opMatch[1] as ConstraintOperator;
    cleanExpr = opMatch[2];
  }

  // Detect condition: ">= 3 when > 768px"
  let condition: string | undefined;
  const condMatch = cleanExpr.match(/^(.+)\s+when\s+(.+)$/);
  if (condMatch) {
    cleanExpr = condMatch[1];
    condition = condMatch[2];
  }

  return {
    property,
    operator,
    expression: cleanExpr,
    condition,
  };
}

// ============================================================================
// Utilities
// ============================================================================

function findGCD(a: number, b: number): number {
  return b === 0 ? a : findGCD(b, a % b);
}

// ============================================================================
// Quick API
// ============================================================================

export const constraintSolver = {
  resolve: resolveConstraint,
  resolveStickyUntil,
  resolveContainerQuery,
  parseConstraint,
  parseExpression,
  resolveReference,
  pass: constraintSolverPass,
};

export default constraintSolver;
