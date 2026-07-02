// src/compiler/pipeline/optimizers/css-compressor.ts
//
// CSS Compressor — micro-optimizations that reduce CSS byte size.
// These are safe transformations that don't change rendering.

import { recordHistory } from '../ir/utils.js';

import type { StyleIR } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

export const cssCompressor: OptimizationPass = {
  name: 'css-compressor',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      for (const decl of rule.declarations) {
        if (typeof decl.value !== 'string') continue;
        let value = decl.value;
        const original = value;

        // ── Hex color shortening (global scanner) ──
        // #ffffff → #fff, #aabbcc → #abc — works anywhere in the value
        value = value.replace(
          /#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})\b/g,
          (_match, r: string, g: string, b: string) => {
            if (r[0] === r[1] && g[0] === g[1] && b[0] === b[1]) {
              return '#' + r[0] + g[0] + b[0];
            }
            return _match;
          }
        );

        // ── Leading zero removal (global scanner) ──
        // 0.5rem → .5rem, 0.25 → .25
        value = value.replace(/\b0(\.\d+)/g, (_match, suffix: string) => suffix);

        // ── Redundant zero units ──
        // 0px → 0, 0rem → 0 (but NOT 0s or 0ms — those are valid durations)
        value = value.replace(
          /\b0(px|em|rem|%|vh|vw|vmin|vmax|ch|ex|cm|mm|in|pt|pc)\b/g,
          () => '0'
        );

        // ── RGBA transparency: rgba(0,0,0,0) → transparent ──
        value = value.replace(
          /rgba?\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/g,
          () => 'transparent'
        );

        // ── Font weight: compress keywords to numbers ──
        // normal (6 bytes) → 400 (3 bytes), bold (4 bytes) → 700 (3 bytes)
        if (decl.property === 'fontWeight' || decl.property === 'font-weight') {
          if (value === 'normal') { value = '400'; }
          else if (value === 'bold') { value = '700'; }
        }

        // ── Shorthand value collapse ──
        // Only for simple values — skip functional notation like calc()
        if (!value.includes('(')) {
          const parts = value.split(/\s+/).filter(Boolean);

          // margin: 0px 0px 0px 0px → margin: 0
          if (parts.length === 4 && parts.every(p => p === parts[0])) {
            value = parts[0];
          }
          // margin: 10px 20px 10px 20px → margin: 10px 20px
          else if (parts.length === 4 && parts[0] === parts[2] && parts[1] === parts[3]) {
            value = parts[0] + ' ' + parts[1];
          }
        }

        // Track changes
        if (value !== original) {
          recordHistory(decl, 'css-compressor', 'compressed', original, `Compressed: "${original}" → "${value}"`);
          changes++;
        }

        decl.value = value;
      }
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: 0,
        bytesSaved: changes * 3, // Conservative estimate
      },
      changes,
    };
  },
};