// src/compiler/pipeline/lowering/css-emitter.ts

import type { StyleIR } from '../ir/types.js';
import type { LoweringPass, LoweringResult, LoweringContext } from '../pipeline-types.js';
import { generateCSS } from '../ir/css-printer.js';

export const cssEmitter: LoweringPass = {
  name: 'css-emitter',

  generate(ir: StyleIR, context: LoweringContext): LoweringResult {
    const minify = context.minify || false;
    const sourceMap = context.sourceMap || false;

    let css: string;

    if (sourceMap && !minify) {
      // Generate CSS once, then inject source comments before each rule's selector.
      // Single generateCSS call instead of O(n) — significant for large projects.
      css = generateCSS(ir, { minify });
      const rules = ir.rules.filter(r => !r.isDead && r.source?.file);
      if (rules.length > 0) {
        const lines = css.split('\n');
        const result: string[] = [];
        let ruleIdx = 0;
        for (const line of lines) {
          // Insert source comment before lines that start a new rule (non-indented, contains {)
          if (ruleIdx < rules.length && /^[^\s].*\{/.test(line)) {
            result.push(`/* source: ${rules[ruleIdx].source!.file} */`);
            ruleIdx++;
          }
          result.push(line);
        }
        css = result.join('\n');
      }
    } else {
      css = generateCSS(ir, { minify });
    }

    return {
      ir,
      generatedOutput: css.trim(),
      // Count actual CSS rules: each pseudo-class generates an additional selector
      generatedNodes: ir.rules
        .filter(r => !r.isDead)
        .reduce((sum, r) => sum + 1 + r.pseudoClasses.filter(p => p.declarations.length > 0).length, 0),
    };
  },
};