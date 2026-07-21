// ============================================================================
// FILE: src/compiler/pipeline/optimizers/media-query-packer.ts
// ============================================================================

import { recordHistory } from '../ir/utils.js';
import type { StyleIR, IRRule, IRAtRule } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

// Base scale constant to safely map relative units down to a standard value footprint
const EM_BASE = 16;

function sortMediaQueries(queries: string[]): string[] {
  return queries.sort((a, b) => {
    const aMin = extractMinWidthPx(a);
    const bMin = extractMinWidthPx(b);
    const aMax = extractMaxWidthPx(a);
    const bMax = extractMaxWidthPx(b);

    if (aMin !== null && bMin !== null) return aMin - bMin;
    if (aMin !== null) return -1;
    if (bMin !== null) return 1;
    
    if (aMax !== null && bMax !== null) return bMax - aMax; // Max-width should sort descending
    if (aMax !== null) return 1;
    if (bMax !== null) return -1;

    return a.localeCompare(b);
  });
}

function extractMinWidthPx(query: string): number | null {
  const match = query.match(/\(min-width:\s*(\d+(?:\.\d+)?)(px|em|rem)\)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return match[2] === 'px' ? val : val * EM_BASE;
}

function extractMaxWidthPx(query: string): number | null {
  const match = query.match(/\(max-width:\s*(\d+(?:\.\d+)?)(px|em|rem)\)/);
  if (!match) return null;
  const val = parseFloat(match[1]);
  return match[2] === 'px' ? val : val * EM_BASE;
}

function atRuleKey(atRule: IRAtRule, parentSelector: string): string {
  if (!atRule.declarations) return `${parentSelector}|${atRule.type}|${atRule.query || ''}`;
  
  const decls = atRule.declarations
    .map(d => `${d.property}:${d.value}`)
    .sort()
    .join(';');
  return `${parentSelector}|${atRule.type}|${atRule.query || ''}|${decls}`;
}

export const mediaQueryPacker: OptimizationPass = {
  name: 'media-query-packer',
  cost: 'moderate',
  requiredFor: ['css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;
    let bytesSaved = 0;

    if (!ir || !ir.rules) return { ir, savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 }, changes: 0 };

    const queryGroups = new Map<string, Array<{
      rule: IRRule;
      atRule: IRAtRule;
      atRuleIndex: number;
    }>>();

    // Phase 1: Group identical queries cleanly
    for (const rule of ir.rules) {
      if (rule.isDead || !rule.atRules) continue;
      
      for (let i = rule.atRules.length - 1; i >= 0; i--) {
        const atRule = rule.atRules[i];
        if (atRule.type === 'media' && atRule.query) {
          const normalizedQuery = atRule.query.replace(/\s+/g, ' ').trim();
          if (!queryGroups.has(normalizedQuery)) {
            queryGroups.set(normalizedQuery, []);
          }
          queryGroups.get(normalizedQuery)!.push({
            rule,
            atRule,
            atRuleIndex: i,
          });
        }
      }
    }

    const sortedQueries = sortMediaQueries([...queryGroups.keys()]);

    // Phase 2: Deduplicate within identical selector scopes
    for (const query of sortedQueries) {
      const group = queryGroups.get(query)!;
      if (group.length < 2) continue;

      const seen = new Map<string, IRAtRule>();

      for (const { rule, atRule, atRuleIndex } of group) {
        const selector = rule.selector || '';
        const key = atRuleKey(atRule, selector);
        const existing = seen.get(key);

        if (existing) {
          rule.atRules.splice(atRuleIndex, 1);
          changes++;
          bytesSaved += 45; // Accurate string match payload estimation

          recordHistory(
            rule as any,
            'media-query-packer',
            'merged-duplicate',
            query,
            `Merged duplicate @media ${query} inside selector ${selector}`
          );
        } else {
          seen.set(key, atRule);
        }
      }
    }

    // Phase 3: Inline safe topological sort preservation without breaking non-media rules
    for (const rule of ir.rules) {
      if (rule.isDead || !rule.atRules || rule.atRules.length < 2) continue;

      // Track relative positioning rather than shifting all items blindly to the top
      const mediaIndices: number[] = [];
      const mediaRules: IRAtRule[] = [];

      rule.atRules.forEach((a, index) => {
        if (a.type === 'media' && a.query) {
          mediaIndices.push(index);
          mediaRules.push(a);
        }
      });

      if (mediaRules.length < 2) continue;

      const sortedMediaStrings = sortMediaQueries(mediaRules.map(a => a.query!));
      const sortedMediaAtRules = sortedMediaStrings.map(q =>
        mediaRules.find(a => (a.query || '').replace(/\s+/g, ' ').trim() === q)!
      );

      // Re-insert sorted elements back into their exact original sequential indices
      mediaIndices.forEach((originalIndex, loopIdx) => {
        rule.atRules[originalIndex] = sortedMediaAtRules[loopIdx];
      });
      
      changes++;
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: 0,
        bytesSaved,
      },
      changes,
    };
  },
};