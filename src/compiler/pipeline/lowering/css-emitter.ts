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
      // Per-rule source mapping — each rule gets its own source comment.
      // Avoids selector collision from multiple files sharing the same selector.
      const parts: string[] = [];
      for (const rule of ir.rules) {
        if (rule.isDead) continue;
        if (rule.source?.file) {
          parts.push(`/* source: ${rule.source.file} */`);
        }
        parts.push(generateCSS({ ...ir, rules: [rule] }, { minify }));
      }
      css = parts.join('\n');
    } else {
      css = generateCSS(ir, { minify });
    }

    return {
      ir,
      generatedOutput: css.trim(),
      generatedNodes: ir.rules.filter(r => !r.isDead).length,
    };
  },
};