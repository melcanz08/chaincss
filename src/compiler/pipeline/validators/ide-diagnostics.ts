// ============================================================================
// FILE: src/compiler/pipeline/validators/ide-diagnostics.ts
// ============================================================================
// IDE-aware diagnostics: quick fixes, hover info, unused token detection.
// Runs as a validation pass so suggestions flow through to inspector JSON,
// CLI output, and dev server.

import type { StyleIR, IRRule, IRDeclaration } from "../ir/types.js";
import type {
  ValidationPass,
  ValidationResult,
  Diagnostic,
} from "../pipeline-types.js";
import type { SymbolTable } from "../symbol-table.js";
import {
  buildSymbolTable,
  findUnusedSymbols,
} from "../symbol-table.js";

// ============================================================================
// Helper Utilities
// ============================================================================

/**
 * Normalizes property names to lowercase kebab-case (e.g. "marginLeft" -> "margin-left").
 */
function normalizeProp(prop: string): string {
  return prop.replace(/([A-Z])/g, "-$1").toLowerCase();
}

/**
 * Maps declarations in a rule to normalized property names for fast lookup.
 */
function getNormalizedDeclMap(declarations: IRDeclaration[] = []): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of declarations) {
    if (d?.property && d.value !== undefined && d.value !== null) {
      map.set(normalizeProp(d.property), String(d.value).trim());
    }
  }
  return map;
}

// ============================================================================
// Quick Fix: Add transition when hover is present without one
// ============================================================================

function detectMissingTransition(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const pseudoClasses = rule.pseudoClasses || [];

  const hasHover = pseudoClasses.some(
    (pc) => pc.name === "hover" && (pc.declarations?.length ?? 0) > 0,
  );
  if (!hasHover) return issues;

  const allDecls = [
    ...(rule.declarations || []),
    ...pseudoClasses.flatMap((pc) => pc.declarations || []),
  ];

  const hasTransition = allDecls.some((d) => {
    if (!d?.property) return false;
    const norm = normalizeProp(d.property);
    return norm === "transition" || norm.startsWith("transition-");
  });

  if (!hasTransition) {
    issues.push({
      id: `ide-transition-${rule.id}`,
      nodeId: rule.id,
      severity: "hint",
      category: "quick-fix",
      message: `"${rule.selector}" has :hover styles but no transition for smooth animation.`,
      suggestion: "transition: all 0.2s ease;",
      autoFixable: true,
    });
  }

  return issues;
}

// ============================================================================
// Quick Fix: Logical Property Consolidation (inline & block pairs)
// ============================================================================

interface DirectionalPair {
  prefix: "margin" | "padding" | "border";
  axis: "inline" | "block";
  firstProp: string;
  secondProp: string;
}

const DIRECTIONAL_PAIRS: DirectionalPair[] = [
  { prefix: "margin", axis: "inline", firstProp: "margin-left", secondProp: "margin-right" },
  { prefix: "padding", axis: "inline", firstProp: "padding-left", secondProp: "padding-right" },
  { prefix: "border", axis: "inline", firstProp: "border-left", secondProp: "border-right" },
  { prefix: "margin", axis: "block", firstProp: "margin-top", secondProp: "margin-bottom" },
  { prefix: "padding", axis: "block", firstProp: "padding-top", secondProp: "padding-bottom" },
  { prefix: "border", axis: "block", firstProp: "border-top", secondProp: "border-bottom" },
];

function detectLogicalPropertyOpportunities(
  rule: IRRule,
  declMap: Map<string, string>,
): Diagnostic[] {
  const issues: Diagnostic[] = [];

  for (const { prefix, axis, firstProp, secondProp } of DIRECTIONAL_PAIRS) {
    const val1 = declMap.get(firstProp);
    const val2 = declMap.get(secondProp);

    if (val1 && val2 && val1 === val2) {
      const targetProp = `${prefix}-${axis}`;
      issues.push({
        id: `ide-${targetProp}-${rule.id}`,
        nodeId: rule.id,
        severity: "hint",
        category: "quick-fix",
        message: `"${rule.selector}" uses ${firstProp} + ${secondProp} with identical values.`,
        suggestion: `${targetProp}: ${val1};`,
        autoFixable: true,
      });
    }
  }

  return issues;
}

// ============================================================================
// Quick Fix: Redundant max-width check
// ============================================================================

function detectRedundantMaxWidth(
  rule: IRRule,
  declMap: Map<string, string>,
): Diagnostic[] {
  const issues: Diagnostic[] = [];

  const width = declMap.get("width");
  const maxWidth = declMap.get("max-width");

  if (width && maxWidth && width === maxWidth) {
    issues.push({
      id: `ide-redundant-maxwidth-${rule.id}`,
      nodeId: rule.id,
      severity: "hint",
      category: "quick-fix",
      message: `"${rule.selector}" has identical width and max-width values.`,
      suggestion: "Remove max-width (redundant when equal to width).",
      autoFixable: true,
    });
  }

  return issues;
}

// ============================================================================
// Hover Info: Token dependency chain
// ============================================================================

function detectTokenDependencyChains(
  rule: IRRule,
  symbols: SymbolTable,
): Diagnostic[] {
  const issues: Diagnostic[] = [];

  for (const decl of rule.declarations || []) {
    if (!decl?.value) continue;
    const val = String(decl.value);
    const tokenMatches = val.matchAll(/\$([a-zA-Z0-9_.-]+)/g);

    for (const match of tokenMatches) {
      const tokenName = match[1];
      const symbol = symbols.symbols.get(tokenName);
      if (!symbol) continue;

      const chain = buildTokenChain(tokenName, symbols);
      if (chain.length > 1) {
        issues.push({
          id: `ide-token-chain-${rule.id}-${tokenName.replace(/\./g, "-")}`,
          nodeId: rule.id,
          severity: "info",
          category: "hover-info",
          message: `Token $${tokenName} dependency chain: ${chain.join(" → ")}`,
          suggestion: `Trace: ${chain.join(" → ")}`,
          autoFixable: false,
        });
      }
    }
  }

  return issues;
}

function buildTokenChain(tokenName: string, symbols: SymbolTable): string[] {
  const chain: string[] = [];
  const visited = new Set<string>();

  function walk(name: string) {
    if (visited.has(name)) return;
    visited.add(name);
    chain.push(`$${name}`);

    const symbol = symbols.symbols.get(name);
    if (symbol?.dependencies) {
      for (const dep of symbol.dependencies) {
        walk(dep);
      }
    }
  }

  walk(tokenName);
  return chain;
}

// ============================================================================
// Unused Token Warnings
// ============================================================================

function detectUnusedTokens(symbols: SymbolTable): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const unused = findUnusedSymbols(symbols);

  for (const symbol of unused) {
    if (
      symbol.kind === "token" ||
      symbol.kind === "variable" ||
      symbol.kind === "animation"
    ) {
      const kindLabel =
        symbol.kind === "token"
          ? "Token"
          : symbol.kind === "animation"
            ? "Animation"
            : "Variable";

      issues.push({
        id: `ide-unused-${symbol.kind}-${symbol.name.replace(/[^a-zA-Z0-9]/g, "-")}`,
        nodeId: symbol.nodeId,
        severity: "warning",
        category: "unused-symbol",
        message: `${kindLabel} "${symbol.name}" is defined but never referenced.`,
        suggestion:
          symbol.kind === "token"
            ? `Remove unused token "${symbol.name}" from your token definitions.`
            : symbol.kind === "animation"
              ? `Remove unused @keyframes "${symbol.name}" or add an animation reference.`
              : `Remove unused variable "${symbol.name}".`,
        autoFixable: false,
      });
    }
  }

  return issues;
}

// ============================================================================
// Pass Definition
// ============================================================================

export const ideDiagnostics: ValidationPass = {
  name: "ide-diagnostics",

  validate(ir: StyleIR): ValidationResult {
    const diagnostics: Diagnostic[] = [];

    if (!ir || !ir.rules) {
      return {
        diagnostics: [],
        passed: true,
        stats: { errors: 0, warnings: 0, info: 0, hints: 0 },
      };
    }

    const symbols = buildSymbolTable(ir);

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      const declMap = getNormalizedDeclMap(rule.declarations);

      diagnostics.push(
        ...detectMissingTransition(rule),
        ...detectLogicalPropertyOpportunities(rule, declMap),
        ...detectRedundantMaxWidth(rule, declMap),
        ...detectTokenDependencyChains(rule, symbols),
      );
    }

    diagnostics.push(...detectUnusedTokens(symbols));

    const errors = diagnostics.filter((d) => d.severity === "error").length;
    const warnings = diagnostics.filter((d) => d.severity === "warning").length;
    const info = diagnostics.filter((d) => d.severity === "info").length;
    const hints = diagnostics.filter((d) => d.severity === "hint").length;

    return {
      diagnostics,
      passed: errors === 0,
      stats: { errors, warnings, info, hints },
    };
  },
};