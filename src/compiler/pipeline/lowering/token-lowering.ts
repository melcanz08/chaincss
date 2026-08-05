// ============================================================================
// FILE: src/compiler/pipeline/lowering/token-lowering.ts
// ============================================================================

import { recordHistory } from "../ir/utils.js";
import type { StyleIR, IRRule, IRDeclaration } from "../ir/types.js";
import type { LoweringPass, LoweringResult } from "../pipeline-types.js";
import { createDeclaration } from "../ir/index.js";
import { resolveSemantic } from "../../tokens/semantic-tokens.js";
import { TokenResolver } from "../../tokens/token-resolver.js";

export interface TokenLoweringOptions {
  inlineLiterals?: boolean;
  activeTheme?: string;
}

// Regex matching unescaped $token paths (e.g. $colors.primary or $spacing.md)
const TOKEN_REGEX = /(?<!\\)\$([a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*)/g;

/**
 * Converts a dot-separated token path to a standard CSS custom variable name.
 * e.g., "colors.primary.500" -> "--colors-primary-500"
 */
function tokenPathToVarName(rawPath: string): string {
  return `--${rawPath.replace(/\./g, "-")}`;
}

/**
 * Performs single-pass regex resolution on a string value to avoid replacement collisions.
 */
function processTokenString(
  input: string,
  resolver: TokenResolver,
  options: TokenLoweringOptions
): {
  result: string;
  unresolvedTokens: string[];
  isModified: boolean;
} {
  let isModified = false;
  const unresolvedTokens: string[] = [];

  const result = input.replace(TOKEN_REGEX, (match, rawPath) => {
    isModified = true;
    const literal = resolver.getLiteralValue(rawPath, options.activeTheme);

    if (options.inlineLiterals) {
      if (literal !== undefined && literal !== null) {
        return String(literal);
      }
      unresolvedTokens.push(match);
      return `var(${tokenPathToVarName(rawPath)})`;
    }

    if (literal === undefined) {
      unresolvedTokens.push(match);
    }
    return `var(${tokenPathToVarName(rawPath)})`;
  });

  return { result, unresolvedTokens, isModified };
}

/**
 * Resolves $token references inside an array of declarations.
 */
function processDeclarations(
  declarations: IRDeclaration[],
  resolver: TokenResolver,
  options: TokenLoweringOptions,
  ruleId: string,
  diagnostics: any[]
): number {
  let count = 0;

  for (const decl of declarations) {
    if (typeof decl.value !== "string" || !decl.value.includes("$")) {
      continue;
    }

    const originalValue = decl.value;
    const { result, unresolvedTokens, isModified } = processTokenString(
      originalValue,
      resolver,
      options
    );

    if (isModified && result !== originalValue) {
      decl.value = result;
      recordHistory(
        decl,
        "token-resolver",
        "resolved-token",
        originalValue,
        `${originalValue} → ${result}`
      );
      count++;
    }

    for (const unresolved of unresolvedTokens) {
      diagnostics.push({
        id: `unresolved-token-${ruleId}-${decl.property}-${Date.now()}`,
        nodeId: ruleId,
        severity: "warning",
        message: `Unresolved token string '${unresolved}' in property '${decl.property}' (${originalValue})`,
        suggestion:
          "Verify that the key footprint is defined inside your active theme contract.",
        pass: "token-resolver",
      });
    }
  }

  return count;
}

/**
 * Recursively walks rules, nested rules, pseudo-classes, and at-rules to lower tokens.
 */
function processRuleTree(
  rule: IRRule,
  resolver: TokenResolver,
  options: TokenLoweringOptions,
  diagnostics: any[]
): number {
  let generatedNodes = 0;

  // 1. Rule declarations
  if (rule.declarations && rule.declarations.length > 0) {
    generatedNodes += processDeclarations(
      rule.declarations,
      resolver,
      options,
      rule.id,
      diagnostics
    );
  }

  // 2. Rule pseudo-classes
  if (rule.pseudoClasses && rule.pseudoClasses.length > 0) {
    for (const pc of rule.pseudoClasses) {
      if (pc.declarations && pc.declarations.length > 0) {
        generatedNodes += processDeclarations(
          pc.declarations,
          resolver,
          options,
          `${rule.id}:${pc.name}`,
          diagnostics
        );
      }
    }
  }

  // 3. Nested rules
  if (rule.nestedRules && rule.nestedRules.length > 0) {
    for (const nested of rule.nestedRules) {
      generatedNodes += processRuleTree(nested, resolver, options, diagnostics);
    }
  }

  // 4. At-rules attached to this rule
  if (rule.atRules && Array.isArray(rule.atRules)) {
    for (const atRule of rule.atRules as any[]) {
      if (typeof atRule.params === "string" && atRule.params.includes("$")) {
        const origParams = atRule.params;
        const { result, unresolvedTokens } = processTokenString(
          origParams,
          resolver,
          options
        );
        if (result !== origParams) {
          atRule.params = result;
          generatedNodes++;
        }
        for (const unresolved of unresolvedTokens) {
          diagnostics.push({
            id: `unresolved-token-atrule-${rule.id}-${Date.now()}`,
            nodeId: rule.id,
            severity: "warning",
            message: `Unresolved token string '${unresolved}' in @rule params (${origParams})`,
            suggestion: "Verify token definition in active theme.",
            pass: "token-resolver",
          });
        }
      }

      if (atRule.rules && Array.isArray(atRule.rules)) {
        for (const subRule of atRule.rules) {
          generatedNodes += processRuleTree(subRule, resolver, options, diagnostics);
        }
      }
    }
  }

  return generatedNodes;
}

/**
 * Recursively expands semantic layout intents before token resolution occurs.
 */
function expandSemanticIntents(rule: IRRule): number {
  let addedCount = 0;
  const semanticIntents = (rule.passMeta?.analysis?.semantic?.tokens ??
    (rule as any).meta?._semantic ??
    []) as Array<{ category: string; intent: string; theme?: any }>;

  if (!rule.declarations) rule.declarations = [];
  if (!rule.pseudoClasses) rule.pseudoClasses = [];

  const resolvedProps = new Set<string>();

  for (const { category, intent, theme } of semanticIntents) {
    const intentKey = `${category}:${intent}`;
    if (resolvedProps.has(intentKey)) continue;
    resolvedProps.add(intentKey);

    const resolved = resolveSemantic(category as any, intent, theme);
    if (!resolved || !resolved.properties) continue;

    for (const [prop, value] of Object.entries(resolved.properties)) {
      const decl = createDeclaration(prop, value);
      recordHistory(
        decl,
        "token-resolver",
        "resolved-semantic-intent",
        undefined,
        `${category}:${intent} → ${prop}: ${value}`
      );

      if (!decl.meta) decl.meta = {};
      decl.meta.semantic = { category, intent };

      if (resolved.pseudoClass) {
        let pc = rule.pseudoClasses.find((p) => p.name === resolved.pseudoClass);
        if (!pc) {
          pc = {
            id: `token-pc-${rule.id}-${resolved.pseudoClass}`,
            name: resolved.pseudoClass!,
            parentId: rule.id,
            declarations: [],
            source: rule.source,
            history: [],
          };
          rule.pseudoClasses.push(pc);
        }
        pc.declarations.push(decl);
      } else {
        rule.declarations.push(decl);
      }
      addedCount++;
    }
  }

  if (rule.nestedRules) {
    for (const nested of rule.nestedRules) {
      addedCount += expandSemanticIntents(nested);
    }
  }

  return addedCount;
}

// ============================================================================
// Pass Definition
// ============================================================================

export const tokenLowering: LoweringPass = {
  name: "token-resolver",

  generate(ir: StyleIR, context?: any): LoweringResult {
    let generatedNodes = 0;

    if (!ir || !ir.rules || ir.rules.length === 0) {
      return { ir, generatedNodes: 0 };
    }

    if (!ir.diagnostics) {
      ir.diagnostics = [];
    }

    const tokenContract = context?.tokenContract || {};
    const resolver = new TokenResolver(tokenContract);
    const options: TokenLoweringOptions = context?.options || {};

    // Phase 1: Expand semantic intents FIRST so generated tokens can be resolved in Phase 2
    for (const rule of ir.rules) {
      generatedNodes += expandSemanticIntents(rule);
    }

    // Phase 2: Recursively resolve tokens across all declarations, pseudo-classes, and nested rules
    for (const rule of ir.rules) {
      generatedNodes += processRuleTree(rule, resolver, options, ir.diagnostics);
    }

    return { ir, generatedNodes };
  },
};