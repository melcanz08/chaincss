// src/compiler/pipeline/generators/token-resolver.ts

import type { StyleIR } from '../../style-ir.js';
import type { LoweringPass, LoweringResult } from '../pipeline-types.js';
import { createDeclaration } from '../../style-ir.js';
import { resolveSemantic } from '../../legacy/semantic-tokens.js';

export const tokenLowering: LoweringPass = {
  name: 'token-resolver',

  generate(ir: StyleIR): LoweringResult {
    let generatedNodes = 0;

    for (const rule of ir.rules) {
      const semanticIntents: Array<{ category: string; intent: string; theme?: any }> =
        rule.meta._semantic || [];

      for (const { category, intent, theme } of semanticIntents) {
        const resolved = resolveSemantic(category as any, intent, theme);
        if (!resolved) continue;

        for (const [prop, value] of Object.entries(resolved.properties)) {
          const decl = createDeclaration(prop, value);
          decl.history.push({
            pass: 'token-resolver',
            action: 'resolved-token',
            timestamp: Date.now(),
            reason: `${category}:${intent} → ${prop}: ${value}`,
          });
          decl.meta.semantic = { category, intent };

          if (resolved.pseudoClass) {
            let pc = rule.pseudoClasses.find(p => p.name === resolved.pseudoClass);
            if (!pc) {
              pc = {
                id: `token-pc-${rule.id}-${resolved.pseudoClass}`,
                name: resolved.pseudoClass!,
                declarations: [],
                source: rule.source,
                history: [],
              };
              rule.pseudoClasses.push(pc);
            }
            pc.declarations.push(decl);
          } else {
            rule.declarations.push(decl);
          }
          generatedNodes++;
        }
      }
    }

    return { ir, generatedNodes };
  },
};