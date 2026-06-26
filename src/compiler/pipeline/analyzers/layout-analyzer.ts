// src/compiler/pipeline/analyzers/layout-analyzer.ts

import type { StyleIR, IRRule } from '../../style-ir.js';
import type { AnalysisPass, AnalysisResult, AnalysisAnnotation } from '../pipeline-types.js';

interface LayoutPattern {
  name: string;
  description: string;
  macro: string;
  required: Record<string, string | number>;
  optional?: string[];
  minMatches?: number;
}

const LAYOUT_PATTERNS: LayoutPattern[] = [
  {
    name: 'flex-center',
    description: 'Flexbox centering',
    macro: 'center()',
    required: { display: 'flex', justifyContent: 'center', alignItems: 'center' },
    minMatches: 3,
  },
  {
    name: 'stack-vertical',
    description: 'Vertical stack with centering',
    macro: "stack('vertical center')",
    required: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' },
    minMatches: 4,
  },
  {
    name: 'flex-between',
    description: 'Flexbox space-between',
    macro: "stack('between')",
    required: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
    minMatches: 3,
  },
  {
    name: 'grid-center',
    description: 'Grid centering',
    macro: 'gridCenter()',
    required: { display: 'grid', placeItems: 'center' },
    minMatches: 2,
  },
  {
    name: 'absolute-center',
    description: 'Absolute centering',
    macro: "absolute({ top: '50%', left: '50%' })",
    required: { position: 'absolute', top: '50%', left: '50%' },
    minMatches: 3,
  },
  {
    name: 'truncate-text',
    description: 'Text truncation',
    macro: 'truncate()',
    required: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    minMatches: 3,
  },
  {
    name: 'card-layout',
    description: 'Card container',
    macro: 'card()',
    required: { borderRadius: '12px', overflow: 'hidden' },
    minMatches: 2,
  },
  {
    name: 'hero-section',
    description: 'Hero section',
    macro: 'hero()',
    required: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%' },
    minMatches: 4,
  },
  {
    name: 'sticky-top',
    description: 'Sticky top element',
    macro: 'stickyHeader()',
    required: { position: 'sticky', top: '0' },
    minMatches: 2,
  },
  {
    name: 'glass-effect',
    description: 'Frosted glass',
    macro: 'glass()',
    required: { backdropFilter: 'blur(16px)' },
    minMatches: 1,
  },
];

function matchPattern(rule: IRRule, pattern: LayoutPattern): { confidence: number; matchedProperties: string[] } | null {
  const propMap = new Map(rule.declarations.map(d => [d.property, String(d.value)]));
  const matchedProperties: string[] = [];
  let matched = 0;
  const totalRequired = Object.keys(pattern.required).length;

  for (const [prop, expected] of Object.entries(pattern.required)) {
    if (propMap.get(prop) === String(expected)) {
      matched++;
      matchedProperties.push(prop);
    }
  }

  if (pattern.optional) {
    for (const prop of pattern.optional) {
      if (propMap.has(prop)) matchedProperties.push(prop);
    }
  }

  const minMatches = pattern.minMatches || totalRequired;
  const confidence = matched >= minMatches ? Math.min(1, matched / totalRequired) : 0;

  return confidence >= 0.75 ? { confidence, matchedProperties } : null;
}

export const layoutAnalyzer: AnalysisPass = {
  name: 'layout-analyzer',

  analyze(ir: StyleIR): AnalysisResult {
    const annotations: AnalysisAnnotation[] = [];
    const patternCounts = new Map<string, string[]>();

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      for (const pattern of LAYOUT_PATTERNS) {
        const result = matchPattern(rule, pattern);
        if (result) {
          annotations.push({
            nodeId: rule.id,
            type: 'layout-pattern',
            data: {
              pattern: pattern.name,
              macro: pattern.macro,
              confidence: result.confidence,
              matchedProperties: result.matchedProperties,
            },
            confidence: result.confidence,
          });

          // Track duplicates
          const selectors = patternCounts.get(pattern.name) || [];
          selectors.push(rule.selector);
          patternCounts.set(pattern.name, selectors);
        }
      }
    }

    // Report duplicate patterns
    for (const [patternName, selectors] of patternCounts) {
      if (selectors.length >= 2) {
        const pattern = LAYOUT_PATTERNS.find(p => p.name === patternName);
        ir.diagnostics.push({
          id: `layout-dup-${patternName}`,
          nodeId: ir.rules[0]?.id || ir.id,
          severity: 'info',
          message: `Layout pattern "${patternName}" found ${selectors.length} times: ${selectors.join(', ')}`,
          suggestion: pattern ? `Consider extracting: ${pattern.macro}` : undefined,
          pass: 'layout-analyzer',
        });
      }
    }

    return { ir, annotations };
  },
};