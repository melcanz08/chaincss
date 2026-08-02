// ============================================================================
// FILE: src/compiler/pipeline/optimizers/specificity-sorter.ts
// ============================================================================

import type { StyleIR, IRRule } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

// Module-level WeakMap cache to memoize specificity tuples per IRRule instance 
// without mutating or polluting the underlying rule schema.
const specificityCache = new WeakMap<IRRule, [number, number, number]>();

/**
 * Calculates a standard 3-part specificity tuple [A, B, C] for a single selector.
 * A = IDs, B = Classes/Attributes/Pseudo-classes, C = Elements/Pseudo-elements
 */
function calculateSelectorSpecificity(selector: string): [number, number, number] {
  let a = 0; // IDs
  let b = 0; // Classes, attributes, pseudo-classes
  let c = 0; // Elements, pseudo-elements

  // Standardize spacing around combinators to make tokenization uniform
  const cleanSelector = selector
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();

  // 1. Match and strip IDs (#id)
  const ids = cleanSelector.match(/#[a-zA-Z0-9_-]+/g);
  if (ids) a += ids.length;

  // 2. Match and strip Attribute selectors ([type="text"])
  const attrs = cleanSelector.match(/\[[^\]]+\]/g);
  if (attrs) b += attrs.length;

  // 3. Match and strip Pseudo-elements (::before, ::after)
  const pseudoElems = cleanSelector.match(/::[a-zA-Z0-9_-]+/g);
  if (pseudoElems) c += pseudoElems.length;

  // 4. Match and strip Pseudo-classes (:hover, :focus)
  const remainingStr = cleanSelector.replace(/::[a-zA-Z0-9_-]+/g, '');
  const pseudoClasses = remainingStr.match(/:[a-zA-Z0-9_-]+/g);
  if (pseudoClasses) {
    for (const pc of (pseudoClasses || [])) {
      if ([':before', ':after', ':first-line', ':first-letter'].includes(pc.toLowerCase())) {
        c++;
      } else if (pc.toLowerCase() !== ':not') {
        b++;
      }
    }
  }

  // 5. Match and strip standard class markers (.class)
  const classes = cleanSelector.match(/\.[a-zA-Z0-9_-]+/g);
  if (classes) b += classes.length;

  // 6. Calculate elements (tags) safely by cleaning out punctuation boundaries
  const words = cleanSelector
    .replace(/#[a-zA-Z0-9_-]+/g, '')
    .replace(/\.[a-zA-Z0-9_-]+/g, '')
    .replace(/\[[^\]]+\]/g, '')
    .replace(/:[a-zA-Z0-9_-]+/g, '')
    .split(/[\s>+~]+/);

  for (const word of words) {
    if (word && /^[a-zA-Z0-9_-]+$/.test(word) && !/^[0-9]+$/.test(word)) {
      if (word !== '*') c++;
    }
  }

  return [a, b, c];
}

/**
 * Gets cached specificity or computes and caches it safely.
 */
function getOrComputeSpecificity(rule: IRRule): [number, number, number] {
  let cached = specificityCache.get(rule);
  if (cached) return cached;

  const tuple = calculateSelectorSpecificity(rule.selector || '');
  specificityCache.set(rule, tuple);
  return tuple;
}

/**
 * Compares two specificity tuples. Returns negative if x < y, positive if x > y.
 */
function compareSpecificity(x: [number, number, number], y: [number, number, number]): number {
  if (x[0] !== y[0]) return x[0] - y[0];
  if (x[1] !== y[1]) return x[1] - y[1];
  return x[2] - y[2];
}

export const specificitySorter: OptimizationPass = {
  name: 'specificity-sorter',
  cost: 'cheap',
  requiredFor: ['css', 'atomic-css'],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;

    if (!ir || !ir.rules) {
      return { ir, savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 }, changes: 0 };
    }

    // Capture initial order to guarantee stable fallback comparisons
    const rulesWithMetadata = ir.rules.map((rule, index) => {
      const specTuple = getOrComputeSpecificity(rule);
      
      const combinedScore = specTuple[0] * 1000000 + specTuple[1] * 1000 + specTuple[2];
      
      if (rule.specificity !== combinedScore) {
        rule.specificity = combinedScore;
        changes++;
      }

      return {
        rule,
        specificity: specTuple,
        originalIndex: index
      };
    });

    // Sort rules safely keeping structural source ordering for matching weights
    rulesWithMetadata.sort((a, b) => {
      const diff = compareSpecificity(a.specificity, b.specificity);
      if (diff !== 0) return diff;
      
      return a.originalIndex - b.originalIndex;
    });

    const finalOrderedRules = rulesWithMetadata.map(m => m.rule);

    let orderChanged = false;
    for (let i = 0; i < ir.rules.length; i++) {
      if (ir.rules[i] !== finalOrderedRules[i]) {
        orderChanged = true;
        break;
      }
    }

    if (orderChanged) {
      ir.rules = finalOrderedRules;
      changes++;
    }

    return {
      ir,
      savings: { rulesEliminated: 0, declarationsEliminated: 0, bytesSaved: 0 },
      changes,
    };
  },
};