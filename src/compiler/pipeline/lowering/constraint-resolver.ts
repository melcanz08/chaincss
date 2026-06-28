// src/compiler/pipeline/generators/constraint-resolver.ts

import type { StyleIR } from '../ir/types.js';
import type { LoweringPass, LoweringResult } from '../pipeline-types.js';
import { createDeclaration } from '../ir/factory.js';

interface Constraint {
  property: string;
  operator: string;
  expression: string;
  condition?: string;
}

function resolveReference(ref: string): string {
  const known: Record<string, string> = {
    'parent': '100%',
    'parent.width': '100%',
    'parent.height': '100%',
    'viewport': '100vw',
    'viewport.width': '100vw',
    'viewport.height': '100vh',
  };
  return known[ref] || ref;
}

function resolveConstraint(constraint: Constraint): { cssProperty: string; cssValue: string; explanation: string } {
  const { property, operator, expression } = constraint;

  // Size constraint: width < parent → max-width: 100%
  if (operator === '<' && expression === 'parent') {
    return {
      cssProperty: 'max-' + property,
      cssValue: '100%',
      explanation: `${property} < parent → max-${property}: 100%`,
    };
  }

  if (operator === '>' && expression === 'parent') {
    return {
      cssProperty: 'min-' + property,
      cssValue: '100%',
      explanation: `${property} > parent → min-${property}: 100%`,
    };
  }

  // Math: height = width * 0.5 → aspect-ratio or calc
  if (operator === '=' && expression.includes('*')) {
    const parts = expression.split('*').map(s => s.trim());
    const ratio = parseFloat(parts[1]);
    if (!isNaN(ratio) && (parts[0] === 'width' || parts[0] === 'height')) {
      const num = Math.round(ratio * 100);
      const den = 100;
      const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
      const g = gcd(num, den);
      return {
        cssProperty: 'aspect-ratio',
        cssValue: `${num / g} / ${den / g}`,
        explanation: `${property} = ${expression} → aspect-ratio`,
      };
    }
    return {
      cssProperty: property,
      cssValue: `calc(${resolveReference(parts[0])} * ${ratio})`,
      explanation: `${property} = ${expression} → calc()`,
    };
  }

  // Simple assignment
  if (operator === '=') {
    const resolved = resolveReference(expression);
    return {
      cssProperty: property,
      cssValue: resolved,
      explanation: `${property} = ${expression} → ${resolved}`,
    };
  }

  // Fallback
  return {
    cssProperty: property,
    cssValue: expression,
    explanation: `${property} ${operator} ${expression} (passthrough)`,
  };
}

export const constraintResolver: LoweringPass = {
  name: 'constraint-resolver',

  generate(ir: StyleIR): LoweringResult {
    let generatedNodes = 0;

    for (const rule of ir.rules) {
      const constraints: Constraint[] = rule.meta._constraints || [];
      if (constraints.length === 0) continue;

      for (const constraint of constraints) {
        const resolved = resolveConstraint(constraint);
        rule.declarations.push(
          createDeclaration(resolved.cssProperty, resolved.cssValue)
        );
        generatedNodes++;
      }
    }

    return { ir, generatedNodes };
  },
};