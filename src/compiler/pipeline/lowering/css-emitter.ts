// ============================================================================
// FILE: src/compiler/pipeline/lowering/css-emitter.ts
// ============================================================================

import type { StyleIR } from '../ir/types.js';
import type { LoweringPass, LoweringResult, LoweringContext } from '../pipeline-types.js';
import { generateCSS } from '../ir/css-printer.js';

export const cssEmitter: LoweringPass = {
  name: 'css-emitter',

  generate(ir: StyleIR, context: LoweringContext): LoweringResult {
    const minify = !!context.minify;
    const sourceMap = !!context.sourceMap;

    // 1. Compile the main raw string footprint from the printer
    let css = generateCSS(ir, { minify });

    // 2. Deterministic source injection loop (only when mapping is active and non-minified)
    if (sourceMap && !minify && ir.rules) {
      const liveRules = ir.rules.filter(r => !r.isDead && r.source?.file && r.selector);
      
      if (liveRules.length > 0 && css.includes('{')) {
        let injectedCss = css;
        let searchWindowOffset = 0;

        for (const rule of liveRules) {
          const selector = rule.selector!;
          
          const targetIndex = injectedCss.indexOf(selector, searchWindowOffset);
          
          if (targetIndex !== -1) {
         
            const cleanFile = String(rule.source?.file)
              .replace(/\*\//g, '*\\/')
              .replace(/\n/g, ' ');

            const comment = `/* source: ${cleanFile} */\n`;
            
            injectedCss = injectedCss.slice(0, targetIndex) + comment + injectedCss.slice(targetIndex);
          
            searchWindowOffset = targetIndex + comment.length + selector.length;
          }
        }
        css = injectedCss;
      }
    }

    // 3. Compute structural generation metrics safely (v3.2 specification)
    let generatedNodes = 0;
    if (ir.rules) {
      generatedNodes = ir.rules.filter(r => !r.isDead).reduce((sum, r) => {
        const atRuleCount = (r as any).atRules?.length || 0;
        const pseudoCount = r.pseudoClasses 
          ? r.pseudoClasses.filter((p: any) => p.declarations && p.declarations.length > 0).length 
          : 0;
        return sum + 1 + atRuleCount + pseudoCount;
      }, 0);
    }

    return {
      ir,
      generatedOutput: css.trim(),
      generatedNodes,
    };
  },
};