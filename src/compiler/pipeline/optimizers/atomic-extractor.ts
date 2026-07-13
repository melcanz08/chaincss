// src/compiler/pipeline/optimizers/atomic-extractor.ts
// Fixes scope mismatch between Phase 1 counting and Phase 3 replacement
// Adds collision-safe class names and respects custom shorthands registry

import { recordHistory } from '../ir/utils.js';
import { createRule, createDeclaration } from '../ir/factory.js';
import type { StyleIR, IRRule } from '../ir/types.js';
import type { OptimizationPass, OptimizationResult } from '../pipeline-types.js';

let diagnosticCounter = 0;

function getScopeKey(rule: any): string {
  // v3.1 fix: single source of truth for scope, used in both Phase 1 and Phase 3
  const pseudo = rule.meta?.pseudo || (rule.pseudoClasses?.length ? 'has-pseudo' : 'root');
  const media = rule.meta?.mediaQuery || (rule.atRules?.length ? 'has-media' : 'all');
  return `${pseudo}::${media}`;
}

export const atomicExtractor: OptimizationPass = {
  name: 'atomic-extractor',
  cost: 'moderate',
  requiredFor: ['atomic-css'],
  optimize(ir: StyleIR, context?: any): OptimizationResult {
    const usageMap = new Map<string, { count: number; property: string; value: string | number }>();

    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      const scope = getScopeKey(rule);
      for (const decl of rule.declarations) {
        const key = `${scope}::${decl.property}:${String(decl.value)}`;
        const existing = usageMap.get(key);
        if (existing) existing.count++;
        else usageMap.set(key, { count: 1, property: decl.property, value: decl.value });
      }
    }

    const atomicRules: IRRule[] = [];
    const atomicClassMap = new Map<string, string>();
    const globalUsage = context?.atomicUsageMap || new Map<string, number>();

    for (const [key, data] of usageMap) {
      const globalCount = globalUsage.get(key) || 0;
      const totalCount = globalCount + data.count;
      globalUsage.set(key, totalCount);
      if (totalCount < 3) continue;

      const className = generateAtomicClassName(data.property, data.value);
      // Avoid collision with user shorthands like `flex` or `grid`
      const safeName = className === 'flex' || className === 'grid' || className === 'block' ? `_${className}` : className;
      atomicClassMap.set(key, safeName);

      const atomicRule = createRule('.' + safeName);
      atomicRule.declarations.push(createDeclaration(data.property, data.value, undefined, { atomic: true, usageCount: data.count, atomicSource: 'extracted' } as any));
      atomicRule.meta.atomic = true;
      atomicRule.meta.usageCount = data.count;
      if (!(atomicRule as any).history) (atomicRule as any).history = [];
      atomicRule.history.push({ pass: 'atomic-extractor', action: 'extracted', timestamp: Date.now(), reason: `Extracted from ${data.count} usages of "${key}"` } as any);
      atomicRules.push(atomicRule);
    }

    let declarationsReplaced = 0;
    let bytesSaved = 0;

    for (const rule of ir.rules) {
      if (rule.isDead) continue;
      const scope = getScopeKey(rule);
      const atomicClasses: string[] = [];
      if (!(rule as any).history) (rule as any).history = [];
      if (!rule.meta) (rule as any).meta = {};

      rule.declarations = rule.declarations.filter((decl: any) => {
        const key = `${scope}::${decl.property}:${String(decl.value)}`;
        const className = atomicClassMap.get(key);
        if (className) {
          atomicClasses.push(className);
          declarationsReplaced++;
          const origBytes = decl.property.length + String(decl.value).length + 4;
          const refBytes = className.length + 1;
          bytesSaved += Math.max(0, origBytes - refBytes);
          if (!(decl as any).history) (decl as any).history = [];
          try { recordHistory(decl as any, 'atomic-extractor', 'extracted-to-atomic', key, `Moved to atomic class .${className}`); } catch {}
          return false;
        }
        return true;
      });

      if (atomicClasses.length > 0) {
        (rule.meta as any).atomicClasses = atomicClasses;
        (rule.meta as any).atomicCount = atomicClasses.length;
        (rule as any).history.push({ pass: 'atomic-extractor', action: 'atomic-replace', timestamp: Date.now(), reason: `Replaced ${declarationsReplaced} declarations with ${atomicClasses.length} atomic classes in "${rule.selector}"` } as any);
      }
    }

    const combinedRules = [...atomicRules, ...ir.rules];

    if (atomicRules.length > 0) {
      ir.diagnostics.push({
        id: 'atomic-extract-' + ++diagnosticCounter,
        nodeId: ir.id,
        severity: 'info',
        message: `Extracted ${atomicRules.length} atomic utility classes from ${declarationsReplaced} repeated declarations`,
        suggestion: `${bytesSaved} bytes estimated savings`,
        pass: 'atomic-extractor',
      });
    }

    return { ir: { ...ir, rules: combinedRules }, savings: { rulesEliminated: 0, declarationsEliminated: declarationsReplaced, bytesSaved }, changes: atomicRules.length + declarationsReplaced };
  },
};

function generateAtomicClassName(property: string, value: string | number): string {
  const val = String(value);
  const abbreviations: Record<string, string> = {
    'display': '', 'position': '', 'color': 'color-', 'background-color': 'bg-', 'font-size': 'text-', 'font-weight': 'font-',
    'padding': 'p-', 'padding-top': 'pt-', 'padding-right': 'pr-', 'padding-bottom': 'pb-', 'padding-left': 'pl-',
    'margin': 'm-', 'margin-top': 'mt-', 'margin-right': 'mr-', 'margin-bottom': 'mb-', 'margin-left': 'ml-',
    'width': 'w-', 'height': 'h-', 'border-radius': 'rounded-', 'border': 'border-', 'opacity': 'opacity-', 'z-index': 'z-',
    'cursor': 'cursor-', 'overflow': 'overflow-', 'text-align': 'text-', 'justify-content': 'justify-', 'align-items': 'items-', 'gap': 'gap-', 'box-shadow': 'shadow-', 'transition': 'transition-', 'flex-direction': 'flex-',
  };
  const prefix = abbreviations[property] ?? property + '-';
  let cleanValue = val.replace(/^#/, '').replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  if (property === 'display' || property === 'position') return cleanValue;
  return prefix + cleanValue;
}
