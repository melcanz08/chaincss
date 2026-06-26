/**
 * @deprecated Use pipeline/analyzers/pattern-detector.ts instead.
 * This file will be removed in v3.0.
 */

// src/compiler/pattern-learner.ts
/**
 * Style Pattern Learner
 * 
 * Observes all styles across a codebase and:
 *   1. DETECTS repeated patterns by content-hashing style blocks
 *   2. RANKS by frequency × property count
 *   3. SUGGESTS extraction as chain.recipe() or intent macros
 *   4. REPORTS savings (lines eliminated, bundle size reduction)
 * 
 * This is compiler-assisted design system extraction.
 */

import type { StyleIR, IRRule, IRPass } from '../style-ir.js';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface StyleFingerprint {
  /** Content hash of the property set */
  hash: string;
  /** Human-readable signature */
  signature: string;
  /** Properties and their values */
  properties: Record<string, string | number>;
  /** Number of properties */
  propertyCount: number;
}

export interface PatternCluster {
  /** The fingerprint that defines this cluster */
  fingerprint: StyleFingerprint;
  /** All rules that match this pattern */
  occurrences: Array<{
    ruleId: string;
    selector: string;
    sourceFile?: string;
    component?: string;
  }>;
  /** How many times it appears */
  frequency: number;
  /** Across how many files */
  fileCount: number;
  /** Importance score (frequency × propertyCount) */
  score: number;
  /** Suggested recipe name */
  suggestedName: string;
  /** Suggested extraction as recipe */
  suggestedRecipe: string;
  /** Estimated savings */
  savings: {
    declarations: number;
    linesEliminated: number;
    bundleReduction: string;
  };
}

export interface LearningReport {
  clusters: PatternCluster[];
  totalPatterns: number;
  highValuePatterns: PatternCluster[];
  totalSavings: {
    declarations: number;
    estimatedBytes: number;
  };
  summary: string;
}

// ============================================================================
// Fingerprinting
// ============================================================================

/**
 * Create a content hash from a set of declarations.
 * Ignores selectors, focuses on the actual style properties.
 */
function fingerprintDeclarations(
  declarations: Array<{ property: string; value: string | number }>
): StyleFingerprint {
  // Sort properties alphabetically for consistent hashing
  const sorted = [...declarations].sort((a, b) => a.property.localeCompare(b.property));

  const properties: Record<string, string | number> = {};
  const propertyList: string[] = [];

  for (const decl of sorted) {
    properties[decl.property] = decl.value;
    propertyList.push(decl.property + ':' + decl.value);
  }

  const signature = propertyList.join('; ');
  const hash = crypto.createHash('md5').update(signature).digest('hex').slice(0, 12);

  return {
    hash,
    signature,
    properties,
    propertyCount: sorted.length,
  };
}

// ============================================================================
// Pattern Clustering
// ============================================================================

/**
 * Cluster rules by their style fingerprint.
 * Only considers rules with a minimum number of declarations.
 */
function clusterPatterns(
  rules: IRRule[],
  options: { minProperties?: number; minFrequency?: number } = {}
): PatternCluster[] {
  const minProperties = options.minProperties || 3;
  const minFrequency = options.minFrequency || 2;

  // Group by hash
  const groups = new Map<string, {
    fingerprint: StyleFingerprint;
    occurrences: PatternCluster['occurrences'];
    files: Set<string>;
  }>();

  for (const rule of rules) {
    if (rule.isDead) continue;
    if (rule.declarations.length < minProperties) continue;

    const fp = fingerprintDeclarations(rule.declarations);

    const existing = groups.get(fp.hash);
    if (existing) {
      existing.occurrences.push({
        ruleId: rule.id,
        selector: rule.selector,
        sourceFile: rule.source.file,
        component: rule.source.component,
      });
      if (rule.source.file) existing.files.add(rule.source.file);
    } else {
      groups.set(fp.hash, {
        fingerprint: fp,
        occurrences: [{
          ruleId: rule.id,
          selector: rule.selector,
          sourceFile: rule.source.file,
          component: rule.source.component,
        }],
        files: new Set(rule.source.file ? [rule.source.file] : []),
      });
    }
  }

  // Filter by frequency and convert to clusters
  const clusters: PatternCluster[] = [];

  for (const [, group] of groups) {
    if (group.occurrences.length < minFrequency) continue;

    const frequency = group.occurrences.length;
    const score = frequency * group.fingerprint.propertyCount;

    // Generate a suggested name from the properties
    const suggestedName = generatePatternName(group.fingerprint.properties);

    // Calculate savings
    const declarations = frequency * group.fingerprint.propertyCount;
    const linesEliminated = declarations - 1; // Replaced by 1 macro call
    const bundleReduction = estimateBundleSavings(declarations, frequency);

    clusters.push({
      fingerprint: group.fingerprint,
      occurrences: group.occurrences,
      frequency,
      fileCount: group.files.size,
      score,
      suggestedName,
      suggestedRecipe: generateRecipeCode(suggestedName, group.fingerprint.properties),
      savings: {
        declarations,
        linesEliminated,
        bundleReduction,
      },
    });
  }

  // Sort by score descending
  clusters.sort((a, b) => b.score - a.score);

  return clusters;
}

// ============================================================================
// Name Generation
// ============================================================================

/**
 * Generate a human-readable pattern name from properties.
 */
function generatePatternName(properties: Record<string, string | number>): string {
  const keys = Object.keys(properties);

  // Try to infer semantic name from common property combinations
  if (hasAll(keys, ['display', 'justifyContent', 'alignItems']) && properties['display'] === 'flex') {
    return 'flexCenter';
  }
  if (hasAll(keys, ['display', 'flexDirection', 'justifyContent', 'alignItems']) && properties['flexDirection'] === 'column') {
    return 'stack';
  }
  if (hasAll(keys, ['padding', 'borderRadius', 'backgroundColor', 'color'])) {
    const bg = String(properties['backgroundColor'] || '');
    if (bg.includes('2563eb') || bg.includes('blue')) return 'primaryButton';
    if (bg.includes('e5e7eb') || bg.includes('gray')) return 'secondaryButton';
    return 'button';
  }
  if (hasAll(keys, ['position', 'top']) && properties['position'] === 'sticky') {
    return 'stickyHeader';
  }
  if (hasAll(keys, ['position', 'top', 'left']) && properties['position'] === 'absolute') {
    return 'absoluteOverlay';
  }
  if (hasAll(keys, ['borderRadius']) && properties['borderRadius'] === '9999px') {
    return 'pill';
  }
  if (hasAll(keys, ['overflow', 'textOverflow', 'whiteSpace'])) {
    return 'truncate';
  }
  if (hasAll(keys, ['backdropFilter'])) {
    return 'glass';
  }

  // Fallback: use most significant property
  if (keys.includes('display')) return String(properties['display']) + 'Layout';
  if (keys.includes('position')) return String(properties['position']) + 'Element';
  return 'pattern-' + keys.slice(0, 3).join('-');
}

function hasAll(haystack: string[], needles: string[]): boolean {
  return needles.every(n => haystack.includes(n));
}

/**
 * Generate recipe code from a pattern.
 */
function generateRecipeCode(
  name: string,
  properties: Record<string, string | number>
): string {
  const lines = Object.entries(properties).map(
    ([prop, value]) => '  ' + prop + ": '" + value + "',"
  );
  return "chain.recipe('" + name + "', {\n" + lines.join('\n') + "\n})";
}

/**
 * Estimate bundle size savings.
 */
function estimateBundleSavings(declarations: number, frequency: number): string {
  const avgBytesPerDecl = 25; // ~25 bytes per CSS declaration
  const totalBytes = declarations * avgBytesPerDecl;
  if (totalBytes > 10000) return '~' + Math.round(totalBytes / 1000) + 'KB';
  return '~' + totalBytes + 'B';
}

// ============================================================================
// Learning Report
// ============================================================================

/**
 * Generate a full learning report from clustered patterns.
 */
function generateReport(clusters: PatternCluster[]): LearningReport {
  const highValue = clusters.filter(c => c.score >= 10);

  const totalDeclarations = clusters.reduce((sum, c) => sum + c.savings.declarations, 0);
  const totalBytes = totalDeclarations * 25;

  let summary: string;
  if (clusters.length === 0) {
    summary = 'No repeated patterns found. Your styles are already unique!';
  } else if (highValue.length > 0) {
    summary = 'Found ' + clusters.length + ' patterns. ' + highValue.length + ' high-value patterns worth extracting.';
  } else {
    summary = 'Found ' + clusters.length + ' patterns. None high-value enough to suggest extraction yet.';
  }

  return {
    clusters,
    totalPatterns: clusters.length,
    highValuePatterns: highValue,
    totalSavings: {
      declarations: totalDeclarations,
      estimatedBytes: totalBytes,
    },
    summary,
  };
}

// ============================================================================
// IR Pass
// ============================================================================

/**
 * Pattern Learning IR pass.
 * Analyzes rules, clusters patterns, and adds diagnostics.
 */
export const patternLearningPass: IRPass = (ir: StyleIR): StyleIR => {
  const clusters = clusterPatterns(ir.rules, {
    minProperties: 3,
    minFrequency: 2,
  });

  if (clusters.length === 0) return ir;

  // Report top patterns as diagnostics
  for (const cluster of clusters.slice(0, 5)) {
    ir.diagnostics.push({
      id: 'pattern-' + cluster.fingerprint.hash,
      nodeId: ir.rules[0]?.id || ir.id,
      severity: 'info',
      message: 'Pattern "' + cluster.suggestedName + '" found ' + cluster.frequency + ' times across ' + cluster.fileCount + ' files. ' + cluster.savings.bundleReduction + ' potential savings.',
      suggestion: cluster.suggestedRecipe,
      pass: 'pattern-learner',
    });
  }

  // Store clusters for reporting
  ir.meta = ir.meta || {};
  (ir.meta as any).patternClusters = clusters;
  (ir.meta as any).learningReport = generateReport(clusters);

  return ir;
};

// ============================================================================
// Standalone API
// ============================================================================

/**
 * Learn patterns from a set of style rules.
 */
export function learnPatterns(
  rules: Array<{ selector: string; declarations: Record<string, string | number>; sourceFile?: string }>,
  options?: { minProperties?: number; minFrequency?: number }
): LearningReport {
  const irRules: IRRule[] = rules.map(r => ({
    id: 'learn-' + Math.random().toString(36).slice(2, 8),
    selector: r.selector,
    declarations: Object.entries(r.declarations).map(([prop, value]) => ({
      id: 'learn-decl-' + prop,
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
    source: { file: r.sourceFile },
    history: [],
    meta: {},
  }));

  const clusters = clusterPatterns(irRules, options);
  return generateReport(clusters);
}

/**
 * Get the top patterns worth extracting.
 */
export function getExtractionCandidates(
  rules: Array<{ selector: string; declarations: Record<string, string | number>; sourceFile?: string }>,
  minScore?: number
): PatternCluster[] {
  const report = learnPatterns(rules);
  const threshold = minScore || 10;
  return report.clusters.filter(c => c.score >= threshold);
}

// ============================================================================
// Quick API
// ============================================================================

export const patternLearner = {
  learn: learnPatterns,
  extract: getExtractionCandidates,
  fingerprint: fingerprintDeclarations,
  cluster: clusterPatterns,
  report: generateReport,
  pass: patternLearningPass,
};

export default patternLearner;
