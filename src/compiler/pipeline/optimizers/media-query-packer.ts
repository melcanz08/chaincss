// src/compiler/pipeline/optimizers/media-query-packer.ts

import type { StyleIR } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

/**
 * Sorts media queries in mobile-first ascending order.
 * This ensures that when queries are grouped, smaller viewports
 * come first and larger ones override — preserving CSS cascade rules.
 * 
 * Priority: min-width queries (ascending) → max-width queries (descending)
 */
function sortMediaQueries(queries: string[]): string[] {
  return queries.sort((a, b) => {
    const aMin = extractMinWidth(a);
    const bMin = extractMinWidth(b);
    const aMax = extractMaxWidth(a);
    const bMax = extractMaxWidth(b);

    // min-width queries first, ascending
    if (aMin !== null && bMin !== null) return aMin - bMin;
    if (aMin !== null) return -1;
    if (bMin !== null) return 1;

    // max-width queries second, descending
    if (aMax !== null && bMax !== null) return bMax - aMax;
    if (aMax !== null) return 1;
    if (bMax !== null) return -1;

    return a.localeCompare(b);
  });
}

function extractMinWidth(query: string): number | null {
  const match = query.match(/\(min-width:\s*(\d+(?:\.\d+)?)(px|em|rem)/);
  return match ? parseFloat(match[1]) : null;
}

function extractMaxWidth(query: string): number | null {
  const match = query.match(/\(max-width:\s*(\d+(?:\.\d+)?)(px|em|rem)/);
  return match ? parseFloat(match[1]) : null;
}

export const mediaQueryPacker: OptimizationPass = {
  name: 'media-query-packer',
  cost: 'moderate',
  requiredFor: ['css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;
    const queryMap = new Map<string, number>();

    // Collect all media queries and their usage counts
    for (const rule of ir.rules) {
      for (const atRule of rule.atRules) {
        if (atRule.type === 'media' && atRule.query) {
          queryMap.set(atRule.query, (queryMap.get(atRule.query) || 0) + 1);
        }
      }
    }

    // Report duplicate queries that could be grouped
    for (const [query, count] of queryMap) {
      if (count >= 2) {
        const sortedQueries = sortMediaQueries([...queryMap.keys()]);
        const position = sortedQueries.indexOf(query);
        
        ir.diagnostics.push({
          id: 'mq-pack-' + Date.now(),
          nodeId: ir.id,
          severity: 'hint',
          message: `Media query "${query}" used ${count} times — consider grouping (mobile-first position: ${position + 1}/${sortedQueries.length})`,
          suggestion: count >= 3
            ? `High duplication. Group these ${count} occurrences into a single @media block to reduce CSS size.`
            : undefined,
          pass: 'media-query-packer',
        });
        changes++;
      }
    }

    return {
      ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: changes * 30 },
      changes,
    };
  },
};
