// src/compiler/pipeline/optimizers/media-query-packer.ts
//
// Media Query Packer — merges duplicate @media blocks into grouped blocks.
// Sorts queries in mobile-first order so smaller viewports cascade correctly.

import { recordHistory } from '../ir/utils.js';
import { createDeclaration } from '../ir/factory.js';

import type { StyleIR, IRRule, IRAtRule } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

/**
 * Sort media queries in mobile-first ascending order.
 * min-width queries (ascending) → max-width queries (descending).
 */
function sortMediaQueries(queries: string[]): string[] {
  return queries.sort((a, b) => {
    const aMin = extractMinWidth(a);
    const bMin = extractMinWidth(b);
    const aMax = extractMaxWidth(a);
    const bMax = extractMaxWidth(b);

    if (aMin !== null && bMin !== null) return aMin - bMin;
    if (aMin !== null) return -1;
    if (bMin !== null) return 1;
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

/**
 * Generate a stable key for an at-rule to detect duplicates.
 * Two at-rules with the same type, query, and declarations are considered identical.
 */
function atRuleKey(atRule: IRAtRule): string {
  const decls = atRule.declarations
    .map(d => `${d.property}:${d.value}`)
    .sort()
    .join(';');
  return `${atRule.type}|${atRule.query || ''}|${decls}`;
}

export const mediaQueryPacker: OptimizationPass = {
  name: 'media-query-packer',
  cost: 'moderate',
  requiredFor: ['css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;
    let bytesSaved = 0;

    // ── Phase 1: Collect all media queries and their rules ──
    // Map: query string → array of { rule, atRule, atRuleIndex }
    const queryGroups = new Map<string, Array<{
      rule: IRRule;
      atRule: IRAtRule;
      atRuleIndex: number;
    }>>();

    for (const rule of ir.rules) {
      if (rule.isDead) continue;
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

    // ── Phase 2: Merge duplicate media queries ──
    const sortedQueries = sortMediaQueries([...queryGroups.keys()]);

    for (const query of sortedQueries) {
      const group = queryGroups.get(query)!;
      if (group.length < 2) continue;

      // Deduplicate: find at-rules with identical declarations
      const seen = new Map<string, IRAtRule>();

      for (const { rule, atRule, atRuleIndex } of group) {
        const key = atRuleKey(atRule);
        const existing = seen.get(key);

        if (existing) {
          // Duplicate found — remove this at-rule, keep the first occurrence
          rule.atRules.splice(atRuleIndex, 1);
          changes++;
          bytesSaved += 50; // Rough estimate: query string + braces

          recordHistory(
            { history: rule.history } as any,
            'media-query-packer',
            'merged-duplicate',
            query,
            `Merged duplicate @media ${query} into existing block`
          );
        } else {
          seen.set(key, atRule);
        }
      }

      // If multiple rules share the same query but with different declarations,
      // they can't be merged — but we still flag them for manual review
      if (seen.size >= 2) {
        ir.diagnostics.push({
          id: 'mq-group-' + Date.now(),
          nodeId: ir.id,
          severity: 'hint',
          message: `Media query "${query}" used ${group.length} times with different declarations — consider grouping into a single @media block`,
          suggestion: `Group these ${group.length} occurrences to reduce CSS size by ~${group.length * 30} bytes`,
          pass: 'media-query-packer',
        });
      }
    }

    // ── Phase 3: Sort remaining at-rules in mobile-first order within each rule ──
    for (const rule of ir.rules) {
      if (rule.isDead || rule.atRules.length < 2) continue;

      const mediaAtRules = rule.atRules.filter(a => a.type === 'media' && a.query);
      if (mediaAtRules.length < 2) continue;

      const sorted = sortMediaQueries(mediaAtRules.map(a => a.query!));
      const sortedAtRules = sorted.map(q =>
        mediaAtRules.find(a => (a.query || '').replace(/\s+/g, ' ').trim() === q)!
      );

      // Check if order actually changed
      const originalOrder = mediaAtRules.map(a => a.query);
      const newOrder = sortedAtRules.map(a => a.query);
      if (originalOrder.join(',') !== newOrder.join(',')) {
        // Replace media at-rules with sorted versions while preserving non-media at-rules
        const nonMediaAtRules = rule.atRules.filter(a => a.type !== 'media' || !a.query);
        rule.atRules = [...sortedAtRules, ...nonMediaAtRules];
        changes++;
      }
    }

    if (changes > 0) {
      ir.diagnostics.push({
        id: 'mq-packed-' + Date.now(),
        nodeId: ir.id,
        severity: 'info',
        message: `Media query packer: merged ${changes} duplicate @media blocks, saved ~${bytesSaved} bytes`,
        pass: 'media-query-packer',
      });
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