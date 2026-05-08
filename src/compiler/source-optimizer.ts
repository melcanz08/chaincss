// src/compiler/source-optimizer.ts
/**
 * Source-Aware Optimization Engine
 * 
 * Unifies all analysis modules into an enterprise-grade optimization report.
 * Tracks where every style originates and detects:
 *   - Duplicate styles across files
 *   - Dead/unreachable rules
 *   - Specificity wars
 *   - Conflicting animations
 *   - Redundant media queries
 *   - Unused variants and recipes
 */

import type { StyleIR, IRRule, IRPass } from './style-ir.js';

// ============================================================================
// Types
// ============================================================================

export interface DuplicateGroup {
  /** The shared signature */
  signature: string;
  /** All occurrences with source locations */
  occurrences: Array<{
    selector: string;
    file?: string;
    line?: number;
    component?: string;
  }>;
  /** How many times it appears */
  count: number;
  /** Suggested extraction */
  suggestion: string;
  /** Estimated savings in bytes */
  savingsBytes: number;
}

export interface DeadRule {
  ruleId: string;
  selector: string;
  file?: string;
  line?: number;
  reason: string;
  bytesWasted: number;
}

export interface SpecificityConflict {
  higher: {
    selector: string;
    specificity: number;
    file?: string;
    line?: number;
  };
  lower: {
    selector: string;
    specificity: number;
    file?: string;
    line?: number;
  };
  property?: string;
  severity: 'warning' | 'info';
}

export interface AnimationConflict {
  name: string;
  locations: Array<{
    file?: string;
    line?: number;
    selector: string;
  }>;
  count: number;
}

export interface MediaQueryRedundancy {
  query: string;
  count: number;
  files: string[];
  suggestion: string;
  savingsBytes: number;
}

export interface OptimizationReport {
  duplicates: DuplicateGroup[];
  deadRules: DeadRule[];
  specificityConflicts: SpecificityConflict[];
  animationConflicts: AnimationConflict[];
  mediaQueryRedundancies: MediaQueryRedundancy[];
  summary: {
    totalIssues: number;
    duplicatesCount: number;
    deadCount: number;
    specificityCount: number;
    animationCount: number;
    mediaQueryCount: number;
    totalSavingsBytes: number;
    totalSavingsKB: string;
  };
  formattedReport: string;
}

// ============================================================================
// Duplicate Detection
// ============================================================================

function findDuplicates(rules: IRRule[]): DuplicateGroup[] {
  const signatureMap = new Map<string, DuplicateGroup>();

  for (const rule of rules) {
    if (rule.isDead) continue;
    if (rule.declarations.length < 3) continue; // Only flag substantial duplicates

    // Create a signature from declarations only (not selectors)
    const sorted = [...rule.declarations]
      .sort((a, b) => a.property.localeCompare(b.property));
    const signature = sorted.map(d => d.property + ':' + d.value).join(';');

    const existing = signatureMap.get(signature);
    if (existing) {
      existing.occurrences.push({
        selector: rule.selector,
        file: rule.source.file,
        line: rule.source.line,
        component: rule.source.component,
      });
      existing.count++;
      existing.savingsBytes += estimateRuleBytes(rule);
    } else {
      signatureMap.set(signature, {
        signature,
        occurrences: [{
          selector: rule.selector,
          file: rule.source.file,
          line: rule.source.line,
          component: rule.source.component,
        }],
        count: 1,
        suggestion: '',
        savingsBytes: 0,
      });
    }
  }

  // Filter to actual duplicates and generate suggestions
  const duplicates: DuplicateGroup[] = [];
  for (const [, group] of signatureMap) {
    if (group.count >= 2) {
      group.suggestion = generateExtractSuggestion(group);
      duplicates.push(group);
    }
  }

  return duplicates.sort((a, b) => b.savingsBytes - a.savingsBytes);
}

function estimateRuleBytes(rule: IRRule): number {
  let bytes = rule.selector.length + 3; // selector + {}

  for (const decl of rule.declarations) {
    bytes += decl.property.length + String(decl.value).length + 6; // prop: value;

  }
  return bytes;
}

function generateExtractSuggestion(group: DuplicateGroup): string {
  const selectors = group.occurrences.map(o => o.selector).join(', ');
  const files = [...new Set(group.occurrences.map(o => o.file).filter(Boolean))];
  return 'Extract as shared recipe or component. Found in: ' +
    (files.length > 0 ? files.join(', ') : selectors);
}

// ============================================================================
// Dead Rule Detection
// ============================================================================

function findDeadRules(rules: IRRule[]): DeadRule[] {
  const dead: DeadRule[] = [];

  for (const rule of rules) {
    if (!rule.isDead) continue;

    dead.push({
      ruleId: rule.id,
      selector: rule.selector,
      file: rule.source.file,
      line: rule.source.line,
      reason: rule.meta.deathReason || 'Marked as dead by optimization pass',
      bytesWasted: estimateRuleBytes(rule),
    });
  }

  return dead;
}

// ============================================================================
// Specificity Conflict Detection
// ============================================================================

function findSpecificityConflicts(rules: IRRule[]): SpecificityConflict[] {
  const conflicts: SpecificityConflict[] = [];
  const alive = rules.filter(r => !r.isDead);

  // Compare every pair of rules that target overlapping selectors
  for (let i = 0; i < alive.length; i++) {
    for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i];
      const b = alive[j];

      // Check selector overlap
      if (!selectorsOverlap(a.selector, b.selector)) continue;

      // Check if they set the same property
      const aProps = new Set(a.declarations.map(d => d.property));
      const bProps = new Set(b.declarations.map(d => d.property));
      const overlap = [...aProps].filter(p => bProps.has(p));

      if (overlap.length === 0) continue;

      // Significant specificity difference?
      const diff = Math.abs(a.specificity - b.specificity);
      if (diff >= 100) {
        const higher = a.specificity > b.specificity ? a : b;
        const lower = a.specificity > b.specificity ? b : a;

        conflicts.push({
          higher: {
            selector: higher.selector,
            specificity: higher.specificity,
            file: higher.source.file,
            line: higher.source.line,
          },
          lower: {
            selector: lower.selector,
            specificity: lower.specificity,
            file: lower.source.file,
            line: lower.source.line,
          },
          property: overlap[0],
          severity: diff >= 10000 ? 'warning' : 'info',
        });
      }
    }
  }

  return conflicts;
}

function selectorsOverlap(a: string, b: string): boolean {
  // Simple: if they share common class names or element names
  const partsA = a.split(/[\s>+~]+/).filter(Boolean);
  const partsB = b.split(/[\s>+~]+/).filter(Boolean);

  for (const pa of partsA) {
    for (const pb of partsB) {
      // Same class
      if (pa.startsWith('.') && pb.startsWith('.') && pa === pb) return true;
      // Same element
      if (pa === pb && !pa.startsWith('.') && !pa.startsWith('#')) return true;
    }
  }
  return false;
}

// ============================================================================
// Animation Conflict Detection
// ============================================================================

function findAnimationConflicts(rules: IRRule[]): AnimationConflict[] {
  const animationMap = new Map<string, AnimationConflict>();

  for (const rule of rules) {
    if (rule.isDead) continue;

    for (const atRule of rule.atRules) {
      if (atRule.type === 'keyframes' && atRule.name) {
        const existing = animationMap.get(atRule.name);
        if (existing) {
          existing.locations.push({
            file: rule.source.file,
            line: rule.source.line,
            selector: rule.selector,
          });
          existing.count++;
        } else {
          animationMap.set(atRule.name, {
            name: atRule.name,
            locations: [{
              file: rule.source.file,
              line: rule.source.line,
              selector: rule.selector,
            }],
            count: 1,
          });
        }
      }
    }
  }

  return [...animationMap.values()].filter(a => a.count >= 2);
}

// ============================================================================
// Media Query Redundancy Detection
// ============================================================================

function findMediaQueryRedundancies(rules: IRRule[]): MediaQueryRedundancy[] {
  const queryMap = new Map<string, { count: number; files: Set<string> }>();

  for (const rule of rules) {
    if (rule.isDead) continue;

    for (const atRule of rule.atRules) {
      if (atRule.type === 'media' && atRule.query) {
        const normalized = atRule.query.replace(/\s+/g, ' ').trim();
        const existing = queryMap.get(normalized);
        if (existing) {
          existing.count++;
          if (rule.source.file) existing.files.add(rule.source.file);
        } else {
          queryMap.set(normalized, {
            count: 1,
            files: new Set(rule.source.file ? [rule.source.file] : []),
          });
        }
      }
    }
  }

  const redundancies: MediaQueryRedundancy[] = [];
  for (const [query, data] of queryMap) {
    if (data.count >= 3) {
      redundancies.push({
        query,
        count: data.count,
        files: [...data.files],
        suggestion: 'Extract as shared breakpoint: $breakpoints.' + generateBreakpointName(query),
        savingsBytes: estimateMQSavings(query, data.count),
      });
    }
  }

  return redundancies.sort((a, b) => b.savingsBytes - a.savingsBytes);
}

function generateBreakpointName(query: string): string {
  if (query.includes('768')) return 'md';
  if (query.includes('1024')) return 'lg';
  if (query.includes('1280')) return 'xl';
  if (query.includes('640')) return 'sm';
  return 'custom';
}

function estimateMQSavings(query: string, count: number): number {
  const queryBytes = query.length + 12; // @media {} wrapper
  return (count - 1) * queryBytes; // All but one could be eliminated
}

// ============================================================================
// Report Generator
// ============================================================================

function formatReport(report: OptimizationReport): string {
  const lines: string[] = [
    '═══════════════════════════════════════════',
    '  ChainCSS Source-Aware Optimization Report',
    '═══════════════════════════════════════════',
    '',
  ];

  // Duplicates
  if (report.duplicates.length > 0) {
    lines.push('🔁 DUPLICATES (' + report.duplicates.length + ' found)');
    for (const dup of report.duplicates.slice(0, 5)) {
      const selectors = dup.occurrences.map(o => o.selector).join(' = ');
      lines.push('  • ' + selectors);
      lines.push('    → ' + dup.suggestion);
      lines.push('    → Savings: ~' + dup.savingsBytes + 'B');
    }
    lines.push('');
  }

  // Dead rules
  if (report.deadRules.length > 0) {
    lines.push('💀 DEAD CODE (' + report.deadRules.length + ' rules, ~' +
      report.deadRules.reduce((s, d) => s + d.bytesWasted, 0) + 'B)');
    for (const dead of report.deadRules.slice(0, 5)) {
      const location = dead.file ? dead.file + (dead.line ? ':' + dead.line : '') : 'unknown';
      lines.push('  • ' + dead.selector + ' (' + location + ') — ' + dead.reason);
    }
    lines.push('');
  }

  // Specificity
  if (report.specificityConflicts.length > 0) {
    lines.push('⚔️ SPECIFICITY WARS (' + report.specificityConflicts.length + ' conflicts)');
    for (const conflict of report.specificityConflicts.slice(0, 5)) {
      lines.push('  • ' + conflict.higher.selector + ' (' + conflict.higher.specificity + ')');
      lines.push('    overrides: ' + conflict.lower.selector + ' (' + conflict.lower.specificity + ')');
      if (conflict.property) lines.push('    Property: ' + conflict.property);
    }
    lines.push('');
  }

  // Animation conflicts
  if (report.animationConflicts.length > 0) {
    lines.push('🎬 ANIMATION CONFLICTS (' + report.animationConflicts.length + ' found)');
    for (const ac of report.animationConflicts.slice(0, 5)) {
      lines.push('  • @keyframes ' + ac.name + ' — defined ' + ac.count + ' times');
      for (const loc of ac.locations) {
        lines.push('    ' + (loc.file || 'unknown') + ' → ' + loc.selector);
      }
    }
    lines.push('');
  }

  // Media queries
  if (report.mediaQueryRedundancies.length > 0) {
    lines.push('📱 MEDIA QUERY CONSOLIDATION (' + report.mediaQueryRedundancies.length + ' redundant)');
    for (const mq of report.mediaQueryRedundancies.slice(0, 5)) {
      lines.push('  • ' + mq.query + ' — used ' + mq.count + ' times');
      lines.push('    → ' + mq.suggestion);
      lines.push('    → Savings: ~' + mq.savingsBytes + 'B');
    }
    lines.push('');
  }

  // Summary
  const s = report.summary;
  lines.push('📊 SUMMARY');
  lines.push('  • ' + s.duplicatesCount + ' duplicates → extract recipes');
  lines.push('  • ' + s.deadCount + ' dead rules → remove');
  lines.push('  • ' + s.specificityCount + ' specificity issues → fix cascade');
  lines.push('  • ' + s.animationCount + ' animation conflicts → scope names');
  lines.push('  • ' + s.mediaQueryCount + ' redundant media queries → consolidate');
  lines.push('  • Total potential savings: ' + s.totalSavingsKB);
  lines.push('');
  lines.push('═══════════════════════════════════════════');

  return lines.join('\n');
}

// ============================================================================
// Full Report Generator
// ============================================================================

function generateOptimizationReport(rules: IRRule[]): OptimizationReport {
  const duplicates = findDuplicates(rules);
  const deadRules = findDeadRules(rules);
  const specificityConflicts = findSpecificityConflicts(rules);
  const animationConflicts = findAnimationConflicts(rules);
  const mediaQueryRedundancies = findMediaQueryRedundancies(rules);

  const totalSavingsBytes =
    duplicates.reduce((s, d) => s + d.savingsBytes, 0) +
    deadRules.reduce((s, d) => s + d.bytesWasted, 0) +
    mediaQueryRedundancies.reduce((s, m) => s + m.savingsBytes, 0);

  const report: OptimizationReport = {
    duplicates,
    deadRules,
    specificityConflicts,
    animationConflicts,
    mediaQueryRedundancies,
    summary: {
      totalIssues: duplicates.length + deadRules.length + specificityConflicts.length +
        animationConflicts.length + mediaQueryRedundancies.length,
      duplicatesCount: duplicates.length,
      deadCount: deadRules.length,
      specificityCount: specificityConflicts.length,
      animationCount: animationConflicts.length,
      mediaQueryCount: mediaQueryRedundancies.length,
      totalSavingsBytes,
      totalSavingsKB: totalSavingsBytes > 1000
        ? (totalSavingsBytes / 1000).toFixed(1) + 'KB'
        : totalSavingsBytes + 'B',
    },
    formattedReport: '',
  };

  report.formattedReport = formatReport(report);
  return report;
}

// ============================================================================
// IR Pass
// ============================================================================

export const sourceOptimizerPass: IRPass = (ir: StyleIR): StyleIR => {
  const report = generateOptimizationReport(ir.rules);

  // Add top findings as diagnostics
  for (const dup of report.duplicates.slice(0, 3)) {
    ir.diagnostics.push({
      id: 'source-dup-' + Date.now(),
      nodeId: ir.rules[0]?.id || ir.id,
      severity: 'warning',
      message: 'Duplicate: ' + dup.occurrences.map(o => o.selector).join(' = ') + ' (' + dup.count + '×)',
      suggestion: dup.suggestion,
      pass: 'source-optimizer',
    });
  }

  for (const dead of report.deadRules.slice(0, 3)) {
    ir.diagnostics.push({
      id: 'source-dead-' + Date.now(),
      nodeId: dead.ruleId,
      severity: 'info',
      message: 'Dead rule: ' + dead.selector + ' — ' + dead.reason,
      pass: 'source-optimizer',
    });
  }

  // Store full report
  ir.meta = ir.meta || {};
  (ir.meta as any).optimizationReport = report;

  return ir;
};

// ============================================================================
// Standalone API
// ============================================================================

export function optimizeSource(rules: IRRule[]): OptimizationReport {
  return generateOptimizationReport(rules);
}

export const sourceOptimizer = {
  optimize: optimizeSource,
  findDuplicates,
  findDeadRules,
  findSpecificityConflicts,
  findAnimationConflicts,
  findMediaQueryRedundancies,
  report: generateOptimizationReport,
  format: formatReport,
  pass: sourceOptimizerPass,
};

export default sourceOptimizer;
