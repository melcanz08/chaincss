// ============================================================================
// FILE: src/compiler/pipeline/lowering/css-emitter.ts
// ============================================================================

import type { StyleIR } from "../ir/types.js";
import type {
  LoweringPass,
  LoweringResult,
  LoweringContext,
} from "../pipeline-types.js";
import { cssEmitter as registeredEmitter } from "./emitter-registry.js";

export const cssEmitter: LoweringPass = {
  name: "css-emitter",

  generate(ir: StyleIR, context: LoweringContext): LoweringResult {
    const minify = !!context.minify;
    const sourceMap = !!context.sourceMap;

    const css = registeredEmitter.emit(ir, { minify, sourceMap });

    let generatedNodes = 0;
    if (ir.rules) {
      generatedNodes = ir.rules
        .filter((r) => !r.isDead)
        .reduce((sum, r) => {
          const atRuleCount =
            (r as { atRules?: unknown[] }).atRules?.length || 0;
          const pseudoCount = r.pseudoClasses
            ? r.pseudoClasses.filter(
                (p) => p.declarations && p.declarations.length > 0,
              ).length
            : 0;
          return sum + 1 + atRuleCount + pseudoCount;
        }, 0);
    }

    return {
      ir,
      generatedOutput: css,
      generatedNodes,
    };
  },
};