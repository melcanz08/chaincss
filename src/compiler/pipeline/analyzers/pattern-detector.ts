// ============================================================================
// FILE: src/compiler/pipeline/analyzers/pattern-detector.ts
// ============================================================================

import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  AnalysisPass,
  AnalysisResult,
  AnalysisAnnotation,
} from "../pipeline-types.js";

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

// ============================================================================
// Helpers
// ============================================================================

/**
 * Fast non-crypto hash for style fingerprints.
 * djb2 — simple, fast, collision-resistant enough for CSS property sets.
 */
function hashString(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) + hash + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

/**
 * Convert camelCase to kebab-case correctly.
 * "justifyContent" → "justify-content" (NOT "-justify-content")
 */
function toKebabCase(prop: string): string {
  return prop
    .replace(/^([A-Z])/, (m) => m.toLowerCase())
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase();
}

/**
 * Normalize a CSS value for consistent hashing.
 * Lowercase, trim, collapse whitespace.
 */
function normalizeValue(val: string | number): string {
  return String(val).trim().toLowerCase().replace(/\s+/g, " ");
}

function fingerprintDeclarations(
  declarations: Array<{ property: string; value: string | number }>,
  atRuleContext?: string,
): StyleFingerprint {
  // Fix 2: Normalize property names and values before hashing
  const normalized = declarations.map((d) => ({
    property: toKebabCase(d.property),
    value: normalizeValue(d.value),
  }));

  const sorted = [...normalized].sort((a, b) =>
    a.property.localeCompare(b.property),
  );

  const properties: Record<string, string | number> = {};
  const propertyList: string[] = [];

  for (const decl of sorted) {
    properties[decl.property] = decl.value;
    propertyList.push(`${decl.property}:${decl.value}`);
  }

  const signature =
    propertyList.join("; ") + (atRuleContext ? " @" + atRuleContext : "");

  return {
    hash: hashString(signature),
    signature,
    properties,
    propertyCount: sorted.length,
  };
}

function generatePatternName(
  properties: Record<string, string | number>,
): string {
  const keys = Object.keys(properties);

  const has = (k: string) => keys.includes(k);

  if (has("display") && has("justify-content") && has("align-items")) {
    return "flexCenter";
  }
  if (has("backdrop-filter")) return "glass";
  if (has("overflow") && has("text-overflow")) return "truncate";

  const rawPosition = properties["position"];
  if (has("position") && String(rawPosition).trim().toLowerCase() === "sticky") {
    return "stickyElement";
  }

  const rawDisplay = properties["display"];
  if (has("display") && String(rawDisplay).trim().toLowerCase() === "grid" && has("gap")) {
    return "gridLayout";
  }

  const cleanSlugs = keys
    .slice(0, 3)
    .map((k) => k.replace(/[^a-zA-Z]/g, ""))
    .filter(Boolean);

  return "pattern-" + (cleanSlugs.length > 0 ? cleanSlugs.join("-") : "custom");
}

/**
 * Recursively collect all non-dead rules with sufficient declarations.
 * Fix 1: Includes nested rules inside @media, @supports, and nested selectors.
 */
function collectRulesRecursive(
  rules: IRRule[],
  minProperties: number,
  callback: (rule: IRRule) => void,
): void {
  for (const rule of rules) {
    if (!rule.isDead && rule.declarations && rule.declarations.length >= minProperties) {
      callback(rule);
    }
    if (rule.nestedRules && rule.nestedRules.length > 0) {
      collectRulesRecursive(rule.nestedRules, minProperties, callback);
    }
  }
}

// ============================================================================
// Analyzer
// ============================================================================

export const patternDetector: AnalysisPass = {
  name: "pattern-detector",

  analyze(ir: StyleIR): AnalysisResult {
    const annotations: AnalysisAnnotation[] = [];
    const groups = new Map<
      string,
      {
        fingerprint: StyleFingerprint;
        selectors: string[];
        files: Set<string>;
        ids: string[];
      }
    >();

    const minProperties = 2;
    const minFrequency = 2;

    // Fix 5: Guard against undefined diagnostics
    if (!ir.diagnostics) ir.diagnostics = [];

    // Fix 1: Use recursive collector instead of flat iteration
    collectRulesRecursive(ir.rules, minProperties, (rule) => {
      // Fix 4: Filter out undefined/missing queries
      const mediaScope = rule.atRules
        ? [...rule.atRules]
            .map((a) => a.query || a.name || "")
            .filter(Boolean)
            .sort()
            .join(" && ")
        : "";
      const pseudoScope = rule.selector.match(/:[a-z-]+/)?.[0] || "";
      const scope = [mediaScope, pseudoScope].filter(Boolean).join(" ");

      const fp = fingerprintDeclarations(rule.declarations, scope);
      const existing = groups.get(fp.hash);

      if (existing) {
        existing.selectors.push(rule.selector);
        existing.ids.push(rule.id);
        if (rule.source?.file) existing.files.add(rule.source.file);
      } else {
        groups.set(fp.hash, {
          fingerprint: fp,
          selectors: [rule.selector],
          ids: [rule.id],
          files: new Set(rule.source?.file ? [rule.source.file] : []),
        });
      }
    });

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

    for (const cluster of clusters) {
      const group = groups.get(cluster.fingerprint.hash);
      if (!group) continue;

      // Fix 3: Emit per-rule annotations for IDE tooling
      for (const ruleId of group.ids) {
        annotations.push({
          nodeId: ruleId,
          type: "pattern-member",
          data: {
            clusterHash: cluster.fingerprint.hash,
            patternName: cluster.suggestedName,
            selectors: cluster.selectors,
          },
          confidence: Math.min(1, cluster.frequency / 5),
        });
      }

      const firstRuleId = group.ids[0];
      ir.diagnostics.push({
        id: `pattern-${cluster.fingerprint.hash}`,
        nodeId: firstRuleId || ir.id || "root",
        severity: "info",
        message: `Pattern "${cluster.suggestedName}" found ${cluster.frequency} times across ${cluster.fileCount} file(s)`,
        suggestion: `Consider extracting as chain.recipe('${cluster.suggestedName}', { ... })`,
        pass: "pattern-detector",
      });
    }

    return { ir, annotations };
  },
};
