// src/compiler/pipeline/analyzers/pattern-detector.ts

import type { StyleIR, IRRule } from '../../style-ir.js';
import type { AnalysisPass, AnalysisResult, AnalysisAnnotation } from '../pipeline-types.js';
import crypto from 'crypto';

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

function fingerprintDeclarations(declarations: Array<{ property: string; value: string | number }>): StyleFingerprint {
  const sorted = [...declarations].sort((a, b) => a.property.localeCompare(b.property));
  const properties: Record<string, string | number> = {};
  const propertyList: string[] = [];

  for (const decl of sorted) {
    properties[decl.property] = decl.value;
    propertyList.push(`${decl.property}:${decl.value}`);
  }

  return {
    hash: crypto.createHash('md5').update(propertyList.join('; ')).digest('hex').slice(0, 12),
    signature: propertyList.join('; '),
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
  return 'pattern-' + keys.slice(0, 3).join('-');
}

export const patternDetector: AnalysisPass = {
  name: 'pattern-detector',

  analyze(ir: StyleIR): AnalysisResult {
    const annotations: AnalysisAnnotation[] = [];
    const groups = new Map<string, { fingerprint: StyleFingerprint; selectors: string[]; files: Set<string> }>();
    const minProperties = 3;
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

    // Report top 5 patterns
    for (const cluster of clusters.slice(0, 5)) {
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
        message: `Pattern "${cluster.suggestedName}" found ${cluster.frequency} times across ${cluster.fileCount} files`,
        suggestion: `Consider extracting as chain.recipe('${cluster.suggestedName}', { ... })`,
        pass: 'pattern-detector',
      });
    }

    return { ir, annotations };
  },
};