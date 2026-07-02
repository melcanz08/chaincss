// src/compiler/pipeline/analyzers/pattern-detector.ts

import type { StyleIR, IRRule } from '../ir/types.js';
import type { AnalysisPass, AnalysisResult, AnalysisAnnotation } from '../pipeline-types.js';

interface StyleFingerprint {
  hash: string;
  signature: string;
  properties: Record<string, string | number>;
  propertyCount: number;
}

interface PatternCluster {
  fingerprint: StyleFingerprint;
  selectors: string[];
  frequency: number;
  fileCount: number;
  score: number;
  suggestedName: string;
}

/**
 * Fast non-crypto hash for style fingerprints.
 * djb2 — simple, fast, collision-resistant enough for CSS property sets.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // 32-bit
  }
  return Math.abs(hash).toString(36);
}

function fingerprintDeclarations(declarations: Array<{ property: string; value: string | number }>): StyleFingerprint {
  const sorted = [...declarations].sort((a, b) => a.property.localeCompare(b.property));
  const properties: Record<string, string | number> = {};
  const propertyList: string[] = [];

  for (const decl of sorted) {
    properties[decl.property] = decl.value;
    propertyList.push(`${decl.property}:${decl.value}`);
  }

  const signature = propertyList.join('; ');

  return {
    hash: hashString(signature),
    signature,
    properties,
    propertyCount: sorted.length,
  };
}

function generatePatternName(properties: Record<string, string | number>): string {
  const keys = Object.keys(properties);
  if (keys.includes('display') && keys.includes('justifyContent') && keys.includes('alignItems')) {
    return 'flexCenter';
  }
  if (keys.includes('backdropFilter')) return 'glass';
  if (keys.includes('overflow') && keys.includes('textOverflow')) return 'truncate';
  if (keys.includes('position') && properties['position'] === 'sticky') return 'stickyElement';
  if (keys.includes('display') && properties['display'] === 'grid' && keys.includes('gap')) return 'gridLayout';
  return 'pattern-' + keys.slice(0, 3).join('-');
}

export const patternDetector: AnalysisPass = {
  name: 'pattern-detector',

  analyze(ir: StyleIR): AnalysisResult {
    const annotations: AnalysisAnnotation[] = [];
    const groups = new Map<string, {
      fingerprint: StyleFingerprint;
      selectors: string[];
      files: Set<string>;
    }>();

    const minProperties = 2; // 2-property patterns like display:flex + gap:16px matter
    const minFrequency = 2;

    for (const rule of ir.rules) {
      if (rule.isDead || rule.declarations.length < minProperties) continue;

      const fp = fingerprintDeclarations(rule.declarations);
      const existing = groups.get(fp.hash);

      if (existing) {
        existing.selectors.push(rule.selector);
        if (rule.source.file) existing.files.add(rule.source.file);
      } else {
        groups.set(fp.hash, {
          fingerprint: fp,
          selectors: [rule.selector],
          files: new Set(rule.source.file ? [rule.source.file] : []),
        });
      }
    }

    // Build clusters and sort by score (frequency × propertyCount)
    const clusters: PatternCluster[] = [];
    for (const [, group] of groups) {
      if (group.selectors.length < minFrequency) continue;
      clusters.push({
        fingerprint: group.fingerprint,
        selectors: group.selectors,
        frequency: group.selectors.length,
        fileCount: group.files.size,
        score: group.selectors.length * group.fingerprint.propertyCount,
        suggestedName: generatePatternName(group.fingerprint.properties),
      });
    }

    clusters.sort((a, b) => b.score - a.score);

    // Report all patterns (not just top 5) — let the caller filter
    for (const cluster of clusters) {
      annotations.push({
        nodeId: ir.id,
        type: 'pattern-cluster',
        data: cluster,
        confidence: Math.min(1, cluster.frequency / 5),
      });

      ir.diagnostics.push({
        id: `pattern-${cluster.fingerprint.hash}`,
        nodeId: ir.rules[0]?.id || ir.id,
        severity: 'info',
        message: `Pattern "${cluster.suggestedName}" found ${cluster.frequency} times across ${cluster.fileCount} file(s)`,
        suggestion: `Consider extracting as chain.recipe('${cluster.suggestedName}', { ... })`,
        pass: 'pattern-detector',
      });
    }

    return { ir, annotations };
  },
};