// ============================================================================
// FILE: src/compiler/pipeline/analyzers/layout-analyzer.ts
// ============================================================================

import type { StyleIR, IRRule } from '../ir/types.js';
import type { AnalysisPass, AnalysisResult, AnalysisAnnotation } from '../pipeline-types.js';

interface LayoutPattern {
  name: string;
  description: string;
  macro: string;
  required: Record<string, string | number | ((val: string) => boolean)>;
  optional?: string[];
  minMatches?: number;
}

const LAYOUT_PATTERNS: LayoutPattern[] = [
  {
    name: 'flex-center',
    description: 'Flexbox centering',
    macro: 'center()',
    required: { display: 'flex', 'justify-content': 'center', 'align-items': 'center' },
    minMatches: 3,
  },
  {
    name: 'stack-vertical',
    description: 'Vertical stack with centering',
    macro: "stack('vertical center')",
    required: { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'align-items': 'center' },
    minMatches: 4,
  },
  {
    name: 'flex-between',
    description: 'Flexbox space-between',
    macro: "stack('between')",
    required: { display: 'flex', 'justify-content': 'space-between', 'align-items': 'center' },
    minMatches: 3,
  },
  {
    name: 'grid-center',
    description: 'Grid centering',
    macro: 'gridCenter()',
    required: { display: 'grid', 'place-items': 'center' },
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
    required: { overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' },
    minMatches: 3,
  },
  {
    name: 'card-layout',
    description: 'Card container',
    macro: 'card()',
    required: { 'border-radius': '12px', overflow: 'hidden' },
    minMatches: 2,
  },
  {
    name: 'hero-section',
    description: 'Hero section',
    macro: 'hero()',
    required: { display: 'flex', 'flex-direction': 'column', 'justify-content': 'center', 'align-items': 'center', width: '100%' },
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
    required: { 'backdrop-filter': 'blur(16px)' },
    minMatches: 1,
  },
  {
    name: 'grid-list',
    description: 'Auto-fit responsive grid',
    macro: 'gridList()',
    required: { display: 'grid', 'grid-template-columns': 'repeat(auto-fit, minmax(280px, 1fr))' },
    minMatches: 2,
  },
  {
    name: 'sidebar-layout',
    description: 'Sidebar + main content',
    macro: 'sidebar()',
    required: { display: 'grid', 'min-height': '100vh' },
    minMatches: 2,
  },
  {
    name: 'pill-element',
    description: 'Fully rounded pill',
    macro: 'pill()',
    required: { 'border-radius': '9999px', display: 'inline-flex', 'align-items': 'center', 'justify-content': 'center' },
    minMatches: 2,
  },
  {
    name: 'sr-only',
    description: 'Screen-reader only',
    macro: 'srOnly()',
    required: { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)' },
    minMatches: 4, // Correct structural floor constraint for complete safety
  },
  {
    name: 'container-responsive',
    description: 'Responsive container',
    macro: 'container()',
    required: { width: '100%', 'max-width': '1200px', 'margin-left': 'auto', 'margin-right': 'auto' },
    minMatches: 2,
  },
];

function toKebab(s: string) {
  return s.replace(/[A-Z]/g, m => '-' + m.toLowerCase()).toLowerCase();
}

function matchPattern(rule: IRRule, pattern: LayoutPattern): { confidence: number; matchedProperties: string[] } | null {
  const propMap = new Map(rule.declarations.map(d => [toKebab(d.property), String(d.value)]));
  const matchedProperties: string[] = [];
  let matched = 0;
  const totalRequired = Object.keys(pattern.required).length;

  for (const [prop, expected] of Object.entries(pattern.required)) {
    const actualValue = propMap.get(prop);
    const matches = typeof expected === 'function'
      ? (expected as (val: string) => boolean)(actualValue || '')
      : actualValue === String(expected);

    if (matches) {
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
  
  // Guard clause ensuring we hit the literal structural floor constraint first
  if (matched < minMatches) return null;

  // Calculate confidence cleanly relative to total composition size
  const confidence = matched / totalRequired;

  return confidence >= 0.75 ? { confidence, matchedProperties } : null;
}

export const layoutAnalyzer: AnalysisPass = {
  name: 'layout-analyzer',

  analyze(ir: StyleIR): AnalysisResult {
    const annotations: AnalysisAnnotation[] = [];
    const patternCounts = new Map<string, { ids: string[], selectors: string[] }>();

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

          const entry = patternCounts.get(pattern.name) || { ids: [], selectors: [] };
          entry.ids.push(rule.id);
          entry.selectors.push(rule.selector);
          patternCounts.set(pattern.name, entry);
        }
      }
    }

    // Process duplicate collection mappings
    for (const [patternName, { ids, selectors }] of patternCounts) {
      if (selectors.length >= 2) {
        const pattern = LAYOUT_PATTERNS.find(p => p.name === patternName);
        ir.diagnostics.push({
          id: `layout-dup-${patternName}`,
          nodeId: ids[0],
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