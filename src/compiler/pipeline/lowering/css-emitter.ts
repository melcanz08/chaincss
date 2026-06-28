// src/compiler/pipeline/lowering/css-emitter.ts

/**
 * CSS Emitter — Final lowering pass.
 * Generates the CSS string from the optimized IR.
 * 
 * When sourceMap is enabled, emits /* source * / comments mapping
 * CSS rules back to their source component files.
 */

import type { StyleIR } from '../ir/types.js';
import type { LoweringPass, LoweringResult, LoweringContext } from '../pipeline-types.js';
import { generateCSS } from '../ir/css-printer.js';

export const cssEmitter: LoweringPass = {
  name: 'css-emitter',

  generate(ir: StyleIR, context: LoweringContext): LoweringResult {
    const minify = context.minify || false;
    const sourceMap = context.sourceMap || false;
    const namespace = context.namespace || '';

    let css = generateCSS(ir, { minify });

    // Inject source mapping comments when enabled
    if (sourceMap && !minify) {
      css = injectSourceComments(css, ir);
    }

    return {
      ir,
      generatedOutput: css,
      generatedNodes: ir.rules.filter(r => !r.isDead).length,
    };
  },
};

/**
 * Inject /* source * / comments before each CSS rule.
 * Maps compiled CSS back to the original component file for debugging.
 */
function injectSourceComments(css: string, ir: StyleIR): string {
  const lines: string[] = [];
  const cssLines = css.split('\n');

  // Build a lookup: selector → source file
  const sourceMap = new Map<string, string>();
  for (const rule of ir.rules) {
    if (rule.isDead) continue;
    if (rule.source?.file) {
      sourceMap.set(rule.selector, rule.source.file);
    }
  }

  let i = 0;
  while (i < cssLines.length) {
    const line = cssLines[i];

    // Check if this line starts a CSS rule (ends with {)
    const ruleMatch = line.match(/^([^{]+)\s*\{/);
    if (ruleMatch) {
      const selector = ruleMatch[1].trim();
      const sourceFile = sourceMap.get(selector);
      if (sourceFile) {
        lines.push(`/* source: ${sourceFile} */`);
      }
    }

    lines.push(line);
    i++;
  }

  return lines.join('\n');
}
