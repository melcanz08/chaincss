// ============================================================================
// FILE: src/compiler/pipeline/optimizers/css-compressor.ts
// ============================================================================

import { recordHistory } from '../ir/utils.js';
import type { StyleIR, IRDeclaration } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

/**
 * Compresses CSS value strings safely without breaking modern functional properties
 * or unit expressions inside calculations.
 */
function compressValue(property: string, val: string): string {
  let value = val;

  // 1. Convert long hex values to short form safely (#ffffff -> #fff)
  value = value.replace(
    /#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})\b/g,
    (_match, r: string, g: string, b: string) => {
      if (r[0] === r[1] && g[0] === g[1] && b[0] === b[1]) {
        return '#' + r[0] + g[0] + b[0];
      }
      return _match;
    }
  );

  // 2. Safe Leading Zero Stripping (0.5 -> .5) - Skip if part of an identifier
  value = value.replace(/(?<=^|\s|[,(])0(\.\d+)/g, '$1');

  // 3. Safe Zero Unit Stripping - Completely ignore inside functional math blocks like calc(), clamp(), min(), max()
  if (!/(?:calc|clamp|min|max|var)\(/i.test(value)) {
    // Also explicitly protect time units (s, ms) which are structurally required for animations
    value = value.replace(
      /(?<=^|\s|[,(])0(?:px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)\b/gi,
      '0'
    );
  }

  // 4. Compress transparent rgba patterns
  value = value.replace(
    /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/gi,
    'transparent'
  );

  // 5. Normalise Font Weight keywords
  const propLower = property.toLowerCase();
  if (propLower === 'fontweight' || propLower === 'font-weight') {
    if (value === 'normal') value = '400';
    else if (value === 'bold') value = '700';
  }

  // 6. Box Model Shorthand Consolidation (e.g. margin, padding, border-width)
  if (!value.includes('(') && !value.includes('/')) {
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length > 1 && parts.length <= 4) {
      const top = parts[0];
      const right = parts[1];
      const bottom = parts[2] !== undefined ? parts[2] : top;
      const left = parts[3] !== undefined ? parts[3] : right;

      if (top === right && top === bottom && top === left) {
        value = top; // All 4 sides equal
      } else if (top === bottom && right === left) {
        value = `${top} ${right}`; // Top/Bottom match & Left/Right match
      } else if (right === left) {
        value = `${top} ${right} ${bottom}`; // Left/Right match, Top/Bottom distinct
      }
    }
  }

  return value;
}

export const cssCompressor: OptimizationPass = {
  name: 'css-compressor',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;
    let bytesSaved = 0;

    if (!ir || !ir.rules) {
      return { ir, savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 }, changes: 0 };
    }

    const byteLen = (s: string): number => {
      return typeof Buffer !== 'undefined' ? Buffer.byteLength(s, 'utf8') : s.length;
    };

    const processDeclarations = (declarations: IRDeclaration[] | undefined) => {
      if (!declarations) return;
      
      for (const decl of declarations) {
        if (typeof decl.value !== 'string') continue;

        const original = decl.value;
        const compressed = compressValue(decl.property, original);

        if (compressed !== original) {
          bytesSaved += Math.max(0, byteLen(original) - byteLen(compressed));
          recordHistory(decl, 'css-compressor', 'compressed', original, `Compressed: "${original}" → "${compressed}"`);
          decl.value = compressed;
          changes++;
        }
      }
    };

    // Deep-traverse all rules, including structural sub-blocks
    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      // 1. Standard rules
      processDeclarations(rule.declarations);

      // 2. Pseudo-classes
      if ((rule as any).pseudoClasses) {
        for (const pc of (rule as any).pseudoClasses) {
          processDeclarations(pc.declarations);
        }
      }

      // 3. Conditional At-rules
      if (rule.atRules) {
        for (const at of rule.atRules) {
          processDeclarations(at.declarations);
        }
      }
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: 0,
        bytesSaved,
      },
      changes,
    };
  },
};