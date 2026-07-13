// src/compiler/pipeline/lowering/css-emitter.ts
// Fixes source comment injection for nested at-rules and improves node counting

import type { StyleIR } from '../ir/types.js';
import type { LoweringPass, LoweringResult, LoweringContext } from '../pipeline-types.js';
import { generateCSS } from '../ir/css-printer.js';

export const cssEmitter: LoweringPass = {
  name: 'css-emitter',

  generate(ir: StyleIR, context: LoweringContext): LoweringResult {
    const minify = !!context.minify;
    const sourceMap = !!context.sourceMap;

    let css = generateCSS(ir, { minify });

    if (sourceMap && !minify) {
      // v3.2 fix: track real rule order from IR, not from generated string regex
      // This avoids breaking when generateCSS emits @media or @keyframes blocks
      const liveRules = ir.rules.filter(r => !r.isDead && r.source?.file);
      if (liveRules.length > 0 && css.includes('{')) {
        // Build a map of selector -> source file from IR for more robust injection
        // We still inject comments, but we do it by walking the IR in order and
        // inserting before the corresponding selector in the CSS output.
        let injectedCss = css;
        let offset = 0;
        for (const rule of liveRules) {
          const selector = rule.selector;
          if (!selector) continue;
          // Find selector in CSS output after current offset
          const idx = injectedCss.indexOf(selector, offset);
          if (idx !== -1) {
            const comment = `/* source: ${rule.source!.file} */\n`;
            injectedCss = injectedCss.slice(0, idx) + comment + injectedCss.slice(idx);
            offset = idx + comment.length + selector.length;
          }
        }
        css = injectedCss;
      }
    }

    // v3.2: count includes atRules and pseudoClasses for accurate metrics
    const generatedNodes = ir.rules.filter(r => !r.isDead).reduce((sum, r) => {
      const atRuleCount = (r as any).atRules?.length || 0;
      const pseudoCount = r.pseudoClasses?.filter((p: any) => p.declarations?.length > 0).length || 0;
      return sum + 1 + atRuleCount + pseudoCount;
    }, 0);

    return {
      ir,
      generatedOutput: css.trim(),
      generatedNodes,
    };
  },
};

