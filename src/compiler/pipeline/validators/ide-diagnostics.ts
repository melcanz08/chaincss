// ============================================================================
// FILE: src/compiler/pipeline/validators/ide-diagnostics.ts
// ============================================================================
// IDE-aware diagnostics: quick fixes, hover info, unused token detection.
// Runs as a validation pass so suggestions flow through to inspector JSON,
// CLI output, and dev server.

import type { StyleIR, IRRule, IRDeclaration } from '../ir/types.js';
import type { ValidationPass, ValidationResult, Diagnostic } from '../pipeline-types.js';
import type { SymbolTable } from '../symbol-table.js';
import { buildSymbolTable, findUnusedSymbols, findDependents } from '../symbol-table.js';

// ============================================================================
// Quick Fix: Add transition when hover is present without one
// ============================================================================

function detectMissingTransition(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];
  const pseudoClasses = rule.pseudoClasses || [];

  const hasHover = pseudoClasses.some(
    pc => pc.name === 'hover' && pc.declarations?.length > 0
  );
  if (!hasHover) return issues;

  const allDecls = [
    ...rule.declarations,
    ...pseudoClasses.flatMap(pc => pc.declarations || []),
  ];

  const hasTransition = allDecls.some(
    d => d.property === 'transition'
  );

  if (!hasTransition) {
    issues.push({
      id: `ide-transition-${rule.id}`,
      nodeId: rule.id,
      severity: 'hint',
      category: 'quick-fix',
      message: `"${rule.selector}" has :hover styles but no transition for smooth animation.`,
      suggestion: 'transition: all 0.2s ease;',
      autoFixable: true,
    });
  }

  return issues;
}

// ============================================================================
// Quick Fix: Use margin-inline when margin-left + margin-right are equal
// ============================================================================

function detectMarginInlineOpportunity(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];

  const marginLeft = rule.declarations.find(
    d => d.property === 'margin-left' || d.property === 'marginLeft'
  );
  const marginRight = rule.declarations.find(
    d => d.property === 'margin-right' || d.property === 'marginRight'
  );

  if (!marginLeft || !marginRight) return issues;

  const leftVal = String(marginLeft.value).trim();
  const rightVal = String(marginRight.value).trim();

  if (leftVal === rightVal) {
    issues.push({
      id: `ide-margin-inline-${rule.id}`,
      nodeId: rule.id,
      severity: 'hint',
      category: 'quick-fix',
      message: `"${rule.selector}" uses margin-left + margin-right with identical values.`,
      suggestion: `margin-inline: ${leftVal};`,
      autoFixable: true,
    });
  }

  // Same for padding
  const paddingLeft = rule.declarations.find(
    d => d.property === 'padding-left' || d.property === 'paddingLeft'
  );
  const paddingRight = rule.declarations.find(
    d => d.property === 'padding-right' || d.property === 'paddingRight'
  );

  if (paddingLeft && paddingRight) {
    const plVal = String(paddingLeft.value).trim();
    const prVal = String(paddingRight.value).trim();

    if (plVal === prVal) {
      issues.push({
        id: `ide-padding-inline-${rule.id}`,
        nodeId: rule.id,
        severity: 'hint',
        category: 'quick-fix',
        message: `"${rule.selector}" uses padding-left + padding-right with identical values.`,
        suggestion: `padding-inline: ${plVal};`,
        autoFixable: true,
      });
    }
  }

  return issues;
}

// ============================================================================
// Quick Fix: margin-top + margin-bottom → margin-block
// ============================================================================

function detectMarginBlockOpportunity(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];

  const marginTop = rule.declarations.find(
    d => d.property === 'margin-top' || d.property === 'marginTop'
  );
  const marginBottom = rule.declarations.find(
    d => d.property === 'margin-bottom' || d.property === 'marginBottom'
  );

  if (marginTop && marginBottom) {
    const topVal = String(marginTop.value).trim();
    const bottomVal = String(marginBottom.value).trim();

    if (topVal === bottomVal) {
      issues.push({
        id: `ide-margin-block-${rule.id}`,
        nodeId: rule.id,
        severity: 'hint',
        category: 'quick-fix',
        message: `"${rule.selector}" uses margin-top + margin-bottom with identical values.`,
        suggestion: `margin-block: ${topVal};`,
        autoFixable: true,
      });
    }
  }

  const paddingTop = rule.declarations.find(
    d => d.property === 'padding-top' || d.property === 'paddingTop'
  );
  const paddingBottom = rule.declarations.find(
    d => d.property === 'padding-bottom' || d.property === 'paddingBottom'
  );

  if (paddingTop && paddingBottom) {
    const ptVal = String(paddingTop.value).trim();
    const pbVal = String(paddingBottom.value).trim();

    if (ptVal === pbVal) {
      issues.push({
        id: `ide-padding-block-${rule.id}`,
        nodeId: rule.id,
        severity: 'hint',
        category: 'quick-fix',
        message: `"${rule.selector}" uses padding-top + padding-bottom with identical values.`,
        suggestion: `padding-block: ${ptVal};`,
        autoFixable: true,
      });
    }
  }

  return issues;
}

// ============================================================================
// Quick Fix: border-left + border-right → border-inline (same pattern)
// ============================================================================

function detectBorderInlineOpportunity(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];

  const borderLeft = rule.declarations.find(
    d => d.property === 'border-left' || d.property === 'borderLeft'
  );
  const borderRight = rule.declarations.find(
    d => d.property === 'border-right' || d.property === 'borderRight'
  );

  if (borderLeft && borderRight) {
    const leftVal = String(borderLeft.value).trim();
    const rightVal = String(borderRight.value).trim();

    if (leftVal === rightVal) {
      issues.push({
        id: `ide-border-inline-${rule.id}`,
        nodeId: rule.id,
        severity: 'hint',
        category: 'quick-fix',
        message: `"${rule.selector}" uses border-left + border-right with identical values.`,
        suggestion: `border-inline: ${leftVal};`,
        autoFixable: true,
      });
    }
  }

  return issues;
}

// ============================================================================
// Quick Fix: width + max-width that are identical
// ============================================================================

function detectRedundantMaxWidth(rule: IRRule): Diagnostic[] {
  const issues: Diagnostic[] = [];

  const width = rule.declarations.find(
    d => d.property === 'width'
  );
  const maxWidth = rule.declarations.find(
    d => d.property === 'max-width' || d.property === 'maxWidth'
  );

  if (width && maxWidth && String(width.value) === String(maxWidth.value)) {
    issues.push({
      id: `ide-redundant-maxwidth-${rule.id}`,
      nodeId: rule.id,
      severity: 'hint',
      category: 'quick-fix',
      message: `"${rule.selector}" has identical width and max-width values.`,
      suggestion: `Remove max-width (redundant when equal to width).`,
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
  symbols: SymbolTable
): Diagnostic[] {
  const issues: Diagnostic[] = [];

  // Find all tokens referenced by this rule
  for (const decl of (rule.declarations || [])) {
    const val = String(decl.value);
    const tokenMatches = val.matchAll(/\$([a-zA-Z0-9_.-]+)/g);
    for (const match of tokenMatches) {
      const tokenName = match[1];
      const symbol = symbols.symbols.get(tokenName);
      if (!symbol) continue;

      // Build dependency chain string
      const chain = buildTokenChain(tokenName, symbols);
      if (chain.length > 1) {
        issues.push({
          id: `ide-token-chain-${rule.id}-${tokenName.replace(/\./g, '-')}`,
          nodeId: rule.id,
          severity: 'info',
          category: 'hover-info',
          message: `Token $${tokenName} dependency chain: ${chain.join(' → ')}`,
          suggestion: `Trace: ${chain.join(' → ')}`,
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
    // Only flag tokens and variables (not selectors/components which are always "used" by existing)
    if (symbol.kind === 'token' || symbol.kind === 'variable' || symbol.kind === 'animation') {
      issues.push({
        id: `ide-unused-${symbol.kind}-${symbol.name.replace(/[^a-zA-Z0-9]/g, '-')}`,
        nodeId: symbol.nodeId,
        severity: 'warning',
        category: 'unused-symbol',
        message: `${symbol.kind === 'token' ? 'Token' : symbol.kind === 'animation' ? 'Animation' : 'Variable'} "${symbol.name}" is defined but never referenced.`,
        suggestion: symbol.kind === 'token'
          ? `Remove unused token "${symbol.name}" from your token definitions.`
          : symbol.kind === 'animation'
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
  name: 'ide-diagnostics',

  validate(ir: StyleIR): ValidationResult {
    const diagnostics: Diagnostic[] = [];

    if (!ir || !ir.rules) {
      return { diagnostics: [], passed: true, stats: { errors: 0, warnings: 0, info: 0, hints: 0 } };
    }

    // Build symbol table once for all checks
    const symbols = buildSymbolTable(ir);

    for (const rule of ir.rules) {
      if (rule.isDead) continue;

      diagnostics.push(
        // Quick Fixes
        ...detectMissingTransition(rule),
        ...detectMarginInlineOpportunity(rule),
        ...detectMarginBlockOpportunity(rule),
        ...detectBorderInlineOpportunity(rule),
        ...detectRedundantMaxWidth(rule),
        // Hover Info
        ...detectTokenDependencyChains(rule, symbols),
      );
    }

    // Global checks (not per-rule)
    diagnostics.push(...detectUnusedTokens(symbols));

    const errors = diagnostics.filter(d => d.severity === 'error').length;
    const warnings = diagnostics.filter(d => d.severity === 'warning').length;
    const info = diagnostics.filter(d => d.severity === 'info').length;
    const hints = diagnostics.filter(d => d.severity === 'hint').length;

    return {
      diagnostics,
      passed: errors === 0,
      stats: { errors, warnings, info, hints },
    };
  },
};