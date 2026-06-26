// src/compiler/pipeline/generators/css-generator.ts

import type { StyleIR } from '../../style-ir.js';
import type { LoweringPass, LoweringResult, LoweringContext } from '../pipeline-types.js';
import { generateCSS } from '../../style-ir.js';

export const cssEmitter: LoweringPass = {
  name: 'css-emitter',

  generate(ir: StyleIR, context: LoweringContext): LoweringResult {
    const minify = context.minify || false;
    const css = generateCSS(ir, { minify });

    return {
      ir,
      generatedOutput: css,
      generatedNodes: 0,
    };
  },
};