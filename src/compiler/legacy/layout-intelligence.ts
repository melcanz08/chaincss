/**
 * @deprecated Use pipeline/analyzers/layout-analyzer.ts instead.
 * This file will be removed in v3.0.
 */

// src/compiler/layout-intelligence.ts
/**
 * Layout Intelligence Engine
 * 
 * Bidirectional pattern recognition:
 *   1. EXPAND: Human shorthand → full CSS (via existing macros)
 *   2. RECOGNIZE: Full CSS → detected pattern (NEW — this module)
 *   3. COMPRESS: Duplicate patterns → shared intent suggestion
 *   4. SUGGEST: Diagnostic when verbose CSS could be a macro
 */

import type { StyleIR, IRRule, IRDeclaration, IRPass } from '../style-ir.js';

// ============================================================================
// Types
// ============================================================================

export interface LayoutPattern {
  /** Unique name of the pattern */
  name: string;
  /** Human-readable description */
  description: string;
  /** The macro call that generates this pattern */
  macro: string;
  /** Example usage */
  example: string;
  /** Properties that must match exactly */
  required: Record<string, string | number>;
  /** Properties that should be present but can have any value */
  optional?: string[];
  /** Minimum number of required matches to trigger recognition */
  minMatches?: number;
}

export interface PatternMatch {
  pattern: LayoutPattern;
  ruleId: string;
  selector: string;
  matchedProperties: string[];
  confidence: number; // 0-1
}

export interface PatternReport {
  matches: PatternMatch[];
  duplicates: Array<{ pattern: string; selectors: string[]; count: number }>;
  suggestions: Array<{ selector: string; suggestion: string; savings: number }>;
}

// ============================================================================
// Pattern Database
// ============================================================================

const LAYOUT_PATTERNS: LayoutPattern[] = [
  // --- Flexbox Patterns ---
  {
    name: 'stack-center',
    description: 'Vertical stack with centered items',
    macro: "stack('vertical center')",
    example: "chain.stack('vertical center')",
    required: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
    },
    optional: ['gap', 'padding'],
    minMatches: 4,
  },
  {
    name: 'stack-horizontal',
    description: 'Horizontal stack with centered items',
    macro: "stack('horizontal center')",
    example: "chain.stack('horizontal center')",
    required: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
    },
    optional: ['gap'],
    minMatches: 4,
  },
  {
    name: 'flex-center',
    description: 'Flexbox absolute centering',
    macro: 'center()',
    example: 'chain.center()',
    required: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    minMatches: 3,
  },
  {
    name: 'flex-between',
    description: 'Flexbox space-between alignment',
    macro: "stack('between')",
    example: "chain.stack('between')",
    required: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    minMatches: 3,
  },
  {
    name: 'flex-row-wrap',
    description: 'Flex row with wrapping',
    macro: "chain.flex().flexDir('row').flexWrap('wrap')",
    example: "chain.flex().flexDir('row').flexWrap('wrap')",
    required: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    minMatches: 3,
  },

  // --- Grid Patterns ---
  {
    name: 'grid-center',
    description: 'Grid with centered items',
    macro: 'gridCenter()',
    example: 'chain.gridCenter()',
    required: {
      display: 'grid',
      placeItems: 'center',
    },
    minMatches: 2,
  },
  {
    name: 'grid-auto-fit',
    description: 'Responsive auto-fit grid',
    macro: "gridList()",
    example: 'chain.gridList()',
    required: {
      display: 'grid',
    },
    optional: ['gridTemplateColumns', 'gap'],
    minMatches: 1, // Lower because gridTemplateColumns varies
  },

  // --- Positioning Patterns ---
  {
    name: 'absolute-center',
    description: 'Absolute positioning centering',
    macro: "absolute({ top: '50%', left: '50%' })",
    example: "chain.absolute({ top: '50%', left: '50%' }).transform('translate(-50%, -50%)')",
    required: {
      position: 'absolute',
      top: '50%',
      left: '50%',
    },
    optional: ['transform'],
    minMatches: 3,
  },
  {
    name: 'sticky-top',
    description: 'Sticky element at top',
    macro: 'stickyHeader()',
    example: 'chain.stickyHeader()', // from intent macros
    required: {
      position: 'sticky',
      top: '0',
    },
    optional: ['zIndex', 'backgroundColor', 'backdropFilter'],
    minMatches: 2,
  },

  // --- Sizing Patterns ---
  {
    name: 'full-size',
    description: 'Full width and height',
    macro: "chain.size('100%')",
    example: "chain.size('100%')",
    required: {
      width: '100%',
      height: '100%',
    },
    minMatches: 2,
  },
  {
    name: 'pill-shape',
    description: 'Fully rounded pill element',
    macro: 'pill()',
    example: 'chain.pill()',
    required: {
      borderRadius: '9999px',
    },
    optional: ['padding', 'display'],
    minMatches: 1,
  },


  // --- Intent Macros (from intent-engine.ts) ---
  {
    name: 'sticky-header',
    description: 'Sticky header with backdrop blur',
    macro: 'stickyHeader()',
    example: 'chain.stickyHeader()',
    required: {
      position: 'sticky',
      top: '0',
    },
    optional: ['zIndex', 'backgroundColor', 'backdropFilter', 'borderBottom', 'padding'],
    minMatches: 2,
  },
  {
    name: 'card-layout',
    description: 'Card container with shadow and hover lift',
    macro: 'card()',
    example: 'chain.card()',
    required: {
      borderRadius: '12px',
      overflow: 'hidden',
    },
    optional: ['display', 'flexDirection', 'backgroundColor', 'boxShadow', 'transition'],
    minMatches: 2,
  },
  {
    name: 'hero-section',
    description: 'Full-width centered hero',
    macro: 'hero()',
    example: 'chain.hero()',
    required: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      width: '100%',
    },
    optional: ['minHeight', 'padding', 'textAlign'],
    minMatches: 4,
  },
  {
    name: 'container-layout',
    description: 'Centered max-width container',
    macro: 'container()',
    example: 'chain.container()',
    required: {
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    optional: ['width', 'maxWidth', 'paddingLeft', 'paddingRight'],
    minMatches: 2,
  },
  {
    name: 'sidebar-layout',
    description: 'Sidebar + main content grid',
    macro: 'sidebar()',
    example: 'chain.sidebar()',
    required: {
      display: 'grid',
    },
    optional: ['gridTemplateColumns', 'gap', 'minHeight'],
    minMatches: 1,
  },
  {
    name: 'grid-list',
    description: 'Responsive auto-fit grid list',
    macro: 'gridList()',
    example: 'chain.gridList()',
    required: {
      display: 'grid',
    },
    optional: ['gridTemplateColumns', 'gap'],
    minMatches: 1,
  },
  {
    name: 'truncate-text',
    description: 'Single-line text truncation with ellipsis',
    macro: 'truncate()',
    example: 'chain.truncate()',
    required: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    minMatches: 3,
  },
  {
    name: 'sr-only',
    description: 'Screen-reader only element',
    macro: 'srOnly()',
    example: 'chain.srOnly()',
    required: {
      position: 'absolute',
      width: '1px',
      height: '1px',
    },
    optional: ['padding', 'margin', 'overflow', 'clip'],
    minMatches: 2,
  },

  // --- Chain.ts Special Methods ---
  {
    name: 'inline-flex',
    description: 'Inline flex container',
    macro: 'inlineFlex()',
    example: 'chain.inlineFlex()',
    required: {
      display: 'inline-flex',
    },
    minMatches: 1,
  },
  {
    name: 'inline-grid',
    description: 'Inline grid container',
    macro: 'inlineGrid()',
    example: 'chain.inlineGrid()',
    required: {
      display: 'inline-grid',
    },
    minMatches: 1,
  },
  {
    name: 'flex-center-direction',
    description: 'Flex centering with direction',
    macro: "flexCenter('row')",
    example: "chain.flexCenter('col')",
    required: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    },
    optional: ['flexDirection'],
    minMatches: 3,
  },
  {
    name: 'fixed-position',
    description: 'Fixed positioning',
    macro: 'fixed()',
    example: 'chain.fixed({ top: 0 })',
    required: {
      position: 'fixed',
    },
    optional: ['top', 'right', 'bottom', 'left', 'zIndex'],
    minMatches: 1,
  },
  {
    name: 'relative-position',
    description: 'Relative positioning',
    macro: 'relative()',
    example: 'chain.relative()',
    required: {
      position: 'relative',
    },
    minMatches: 1,
  },
  {
    name: 'hidden-element',
    description: 'Hidden element',
    macro: 'hide()',
    example: 'chain.hide()',
    required: {
      display: 'none',
    },
    minMatches: 1,
  },
  {
    name: 'unselectable',
    description: 'Unselectable text',
    macro: 'unselectable()',
    example: 'chain.unselectable()',
    required: {
      userSelect: 'none',
    },
    minMatches: 1,
  },
  {
    name: 'scrollable',
    description: 'Scrollable container',
    macro: 'scrollable()',
    example: 'chain.scrollable()',
    required: {
      overflow: 'auto',
    },
    minMatches: 1,
  },
  {
    name: 'square-shape',
    description: 'Square element with equal sides',
    macro: 'square()',
    example: 'chain.square(100)',
    required: {
      width: '100px',
      height: '100px',
    },
    optional: ['borderRadius'],
    minMatches: 2,
  },
  {
    name: 'circle-shape',
    description: 'Circle element',
    macro: 'circle()',
    example: 'chain.circle(50)',
    required: {
      borderRadius: '50%',
    },
    optional: ['width', 'height'],
    minMatches: 1,
  },
  {
    name: 'bento-grid',
    description: 'Bento box grid layout',
    macro: 'bento()',
    example: 'chain.bento(3)',
    required: {
      display: 'grid',
    },
    optional: ['gridTemplateColumns', 'gap', 'gridAutoRows'],
    minMatches: 1,
  },
  {
    name: 'focus-ring',
    description: 'Focus ring outline',
    macro: 'focusRing()',
    example: 'chain.focusRing()',
    required: {
      outline: '2px solid #3b82f6',
    },
    optional: ['outlineOffset'],
    minMatches: 1,
  },
  {
    name: 'shimmer-effect',
    description: 'Shimmer loading animation',
    macro: 'shimmer()',
    example: 'chain.shimmer()',
    required: {
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
    },
    optional: ['backgroundSize', 'animation'],
    minMatches: 1,
  },
  {
    name: 'skeleton-loader',
    description: 'Skeleton loading state',
    macro: 'skeleton()',
    example: 'chain.skeleton(true)',
    required: {
      animation: 'pulse 1.5s ease-in-out infinite',
    },
    optional: ['backgroundColor', 'borderRadius'],
    minMatches: 1,
  },
  {
    name: 'safe-area-bottom',
    description: 'Safe area padding for notched devices',
    macro: "safeArea('bottom')",
    example: "chain.safeArea('bottom')",
    required: {
      paddingBottom: 'env(safe-area-inset-bottom)',
    },
    minMatches: 1,
  },

  // --- Glass Morphism ---
  {
    name: 'glass-effect',
    description: 'Frosted glass effect',
    macro: 'glass()',
    example: 'chain.glass()',
    required: {
      backdropFilter: 'blur(16px)',
    },
    optional: ['backgroundColor', 'border', 'borderRadius'],
    minMatches: 1,
  },
];

// ============================================================================
// Pattern Matcher
// ============================================================================

/**
 * Check if a rule's declarations match a layout pattern.
 */
function matchPattern(rule: IRRule, pattern: LayoutPattern): PatternMatch | null {
  const declarations = rule.declarations;
  const propMap = new Map(declarations.map(d => [d.property, String(d.value)]));

  const matchedProperties: string[] = [];
  let totalRequired = Object.keys(pattern.required).length;
  let matched = 0;

  // Check required properties
  for (const [prop, expectedValue] of Object.entries(pattern.required)) {
    const actualValue = propMap.get(prop);
    if (actualValue === String(expectedValue)) {
      matched++;
      matchedProperties.push(prop);
    }
  }

  // Check optional properties
  if (pattern.optional) {
    for (const prop of pattern.optional) {
      if (propMap.has(prop)) {
        matchedProperties.push(prop);
      }
    }
  }

  // Calculate confidence
  const minMatches = pattern.minMatches || Object.keys(pattern.required).length;
  const confidence = matched >= minMatches
    ? Math.min(1, matched / totalRequired)
    : 0;

  if (confidence >= 0.75 && matched >= minMatches) {
    return {
      pattern,
      ruleId: rule.id,
      selector: rule.selector,
      matchedProperties,
      confidence,
    };
  }

  return null;
}

/**
 * Find duplicate patterns across rules.
 */
function findDuplicates(matches: PatternMatch[]): PatternReport['duplicates'] {
  const patternGroups = new Map<string, PatternMatch[]>();

  for (const match of matches) {
    const key = match.pattern.name;
    const group = patternGroups.get(key) || [];
    group.push(match);
    patternGroups.set(key, group);
  }

  const duplicates: PatternReport['duplicates'] = [];
  for (const [patternName, group] of patternGroups) {
    if (group.length >= 2) {
      duplicates.push({
        pattern: patternName,
        selectors: group.map(m => m.selector),
        count: group.length,
      });
    }
  }

  return duplicates;
}

/**
 * Generate suggestions for rules that could use macros.
 */
function generateSuggestions(matches: PatternMatch[]): PatternReport['suggestions'] {
  const suggestions: PatternReport['suggestions'] = [];

  for (const match of matches) {
    if (match.confidence >= 0.85) {
      const propsCount = match.matchedProperties.length;
      suggestions.push({
        selector: match.selector,
        suggestion: match.pattern.macro,
        savings: propsCount - 1, // Saving N-1 declarations
      });
    }
  }

  return suggestions;
}

// ============================================================================
// IR Pass
// ============================================================================

/**
 * Layout Intelligence IR pass.
 * Scans all rules for known layout patterns, generates diagnostics and suggestions.
 */
export const layoutIntelligencePass: IRPass = (ir: StyleIR): StyleIR => {
  const allMatches: PatternMatch[] = [];

  for (const rule of ir.rules) {
    for (const pattern of LAYOUT_PATTERNS) {
      const match = matchPattern(rule, pattern);
      if (match) {
        allMatches.push(match);
        rule.meta.layoutPattern = pattern.name;
        rule.meta.layoutConfidence = match.confidence;
      }
    }
  }

  // Find duplicates
  const duplicates = findDuplicates(allMatches);
  for (const dup of duplicates) {
    ir.diagnostics.push({
      id: 'layout-dup-' + Date.now() + '-' + dup.pattern,
      nodeId: ir.rules[0]?.id || ir.id,
      severity: 'info',
      message: 'Layout pattern "' + dup.pattern + '" found ' + dup.count + ' times: ' + dup.selectors.join(', '),
      suggestion: 'Consider extracting: ' + (LAYOUT_PATTERNS.find(p => p.name === dup.pattern)?.macro || ''),
      pass: 'layout-intelligence',
    });
  }

  // Generate suggestions
  const suggestions = generateSuggestions(allMatches);
  for (const sug of suggestions) {
    ir.diagnostics.push({
      id: 'layout-sug-' + Date.now() + '-' + sug.selector.replace(/[.#]/g, ''),
      nodeId: ir.rules.find(r => r.selector === sug.selector)?.id || ir.id,
      severity: 'hint',
      message: '"' + sug.selector + '" could use ' + sug.suggestion + ' (save ' + sug.savings + ' declarations)',
      suggestion: sug.suggestion,
      pass: 'layout-intelligence',
    });
  }

  // Store all matches in IR meta for later use
  ir.meta = ir.meta || {};
  (ir.meta as any).layoutMatches = allMatches;
  (ir.meta as any).layoutDuplicates = duplicates;

  return ir;
};

// ============================================================================
// Standalone API
// ============================================================================

/**
 * Analyze a set of declarations and return matching patterns.
 */
export function recognizeLayout(declarations: Record<string, string | number>): PatternMatch[] {
  const rule: IRRule = {
    id: 'temp-rule',
    selector: '.temp',
    declarations: Object.entries(declarations).map(([prop, value]) => ({
      id: 'temp-decl-' + prop,
      property: prop,
      value,
      history: [],
      meta: {},
    })),
    pseudoClasses: [],
    atRules: [],
    nestedRules: [],
    conditions: [],
    isDead: false,
    specificity: 0,
    hash: '',
    source: {},
    history: [],
    meta: {},
  };

  const matches: PatternMatch[] = [];
  for (const pattern of LAYOUT_PATTERNS) {
    const match = matchPattern(rule, pattern);
    if (match) matches.push(match);
  }
  return matches;
}

/**
 * Get the best macro for a set of declarations.
 */
export function suggestMacro(declarations: Record<string, string | number>): string | null {
  const matches = recognizeLayout(declarations);
  if (matches.length === 0) return null;

  // Return highest confidence match
  const best = matches.sort((a, b) => b.confidence - a.confidence)[0];
  return best.confidence >= 0.85 ? best.pattern.macro : null;
}

/**
 * Get all known layout patterns.
 */
export function getLayoutPatterns(): LayoutPattern[] {
  return [...LAYOUT_PATTERNS];
}

// ============================================================================
// Quick API
// ============================================================================

export const layoutIntelligence = {
  recognize: recognizeLayout,
  suggestMacro,
  getPatterns: getLayoutPatterns,
  pass: layoutIntelligencePass,
  patterns: LAYOUT_PATTERNS,
};

export default layoutIntelligence;
