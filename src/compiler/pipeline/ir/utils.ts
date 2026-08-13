// ============================================================================
// FILE: src/compiler/pipeline/ir/utils.ts
// ============================================================================

import type {
  StyleIR,
  IRRule,
  IRDeclaration,
  IRAtRule,
  IRKeyframeFrame,
  IRDeclarationMeta,
} from "./types.js";
import type { PassMetadata } from "./metadata.js";
import { clonePassMeta } from "./immutable.js";

/** Ensures an IRRule's meta object is initialized and returns a mutable reference */
export function ensureRuleMeta(rule: IRRule): NonNullable<IRRule["meta"]> {
  rule.meta ??= {};
  return rule.meta as NonNullable<IRRule["meta"]>;
}

/** Ensures an IRDeclaration's meta object is initialized and returns a mutable reference */
export function ensureDeclMeta(decl: IRDeclaration): IRDeclarationMeta {
  return (decl.meta ??= {});
}

/** Ensures an IRRule's passMeta object is initialized and returns a mutable reference */
export function ensurePassMeta(rule: IRRule): PassMetadata {
  return (rule.passMeta ??= {
    analysis: {},
    optimization: {},
    transformation: {},
  });
}

/** Generic metadata initializer for any object with an optional `meta` field */
export function ensureMeta<T extends { meta?: Record<string, unknown> }>(
  node: T
): NonNullable<T["meta"]> {
  return (node.meta ??= {} as NonNullable<T["meta"]>);
}

/** Count all nodes in the IR recursively */
export function countNodes(ir: StyleIR): {
  rules: number;
  declarations: number;
  pseudoClasses: number;
  atRules: number;
  conditions: number;
} {
  const counts = {
    rules: 0,
    declarations: 0,
    pseudoClasses: 0,
    atRules: 0,
    conditions: 0,
  };

  function visitAtRule(at: IRAtRule): void {
    counts.atRules++;
    counts.declarations += at.declarations?.length ?? 0;

    if (at.keyframes) {
      for (let i = 0; i < at.keyframes.length; i++) {
        counts.declarations += at.keyframes[i].declarations?.length ?? 0;
      }
    }

    if (at.nestedRules) {
      for (let i = 0; i < at.nestedRules.length; i++) {
        visitRule(at.nestedRules[i]);
      }
    }
  }

  function visitRule(rule: IRRule): void {
    counts.rules++;
    counts.declarations += rule.declarations?.length ?? 0;
    counts.pseudoClasses += rule.pseudoClasses?.length ?? 0;
    counts.conditions += rule.conditions?.length ?? 0;

    if (rule.atRules) {
      for (let i = 0; i < rule.atRules.length; i++) {
        visitAtRule(rule.atRules[i]);
      }
    }

    if (rule.nestedRules) {
      for (let i = 0; i < rule.nestedRules.length; i++) {
        visitRule(rule.nestedRules[i]);
      }
    }
  }

  if (ir.rules) {
    for (let i = 0; i < ir.rules.length; i++) {
      visitRule(ir.rules[i]);
    }
  }

  return counts;
}

/** Find a rule by selector (shallow top-level match by default, or deep tree search) */
export function findRule(
  ir: StyleIR,
  selector: string,
  options?: { deep?: boolean },
): IRRule | undefined {
  if (!options?.deep) {
    return ir.rules.find((r) => r.selector === selector);
  }

  function searchRule(rule: IRRule): IRRule | undefined {
    if (rule.selector === selector) return rule;

    for (let i = 0; i < rule.nestedRules.length; i++) {
      const found = searchRule(rule.nestedRules[i]);
      if (found) return found;
    }

    for (let i = 0; i < rule.atRules.length; i++) {
      const at = rule.atRules[i];
      if (at.nestedRules) {
        for (let j = 0; j < at.nestedRules.length; j++) {
          const found = searchRule(at.nestedRules[j]);
          if (found) return found;
        }
      }
    }

    return undefined;
  }

  for (let i = 0; i < ir.rules.length; i++) {
    const found = searchRule(ir.rules[i]);
    if (found) return found;
  }

  return undefined;
}

function cloneDecl(decl: IRDeclaration): IRDeclaration {
  return {
    ...decl,
    history: decl.history ? [...decl.history] : [],
    meta: decl.meta ? { ...decl.meta } : undefined,
  };
}

function cloneKeyframeFrame(frame: IRKeyframeFrame): IRKeyframeFrame {
  return {
    ...frame,
    declarations: frame.declarations.map(cloneDecl),
  };
}

function cloneAtRule(atRule: IRAtRule): IRAtRule {
  const cloned: IRAtRule = {
    ...atRule,
    declarations: atRule.declarations.map(cloneDecl),
    nestedRules: atRule.nestedRules ? atRule.nestedRules.map(cloneRule) : [],
    history: atRule.history ? [...atRule.history] : [],
  };

  if (atRule.keyframes) {
    cloned.keyframes = atRule.keyframes.map(cloneKeyframeFrame);
  }

  return cloned;
}

function cloneRule(rule: IRRule): IRRule {
  return {
    ...rule,
    declarations: rule.declarations.map(cloneDecl),
    pseudoClasses: rule.pseudoClasses.map((pc) => ({
      ...pc,
      declarations: pc.declarations.map(cloneDecl),
      history: pc.history ? [...pc.history] : [],
    })),
    atRules: rule.atRules.map(cloneAtRule),
    nestedRules: rule.nestedRules.map(cloneRule),
    conditions: rule.conditions.map((cond) => ({ ...cond })),
    history: rule.history ? [...rule.history] : [],
    meta: rule.meta ? { ...rule.meta } : undefined,
    passMeta: rule.passMeta ? clonePassMeta(rule.passMeta) : undefined,
  };
}

/** Clone an IR (deep copy) preserving structural relationships */
export function cloneIR(ir: StyleIR): StyleIR {
  return {
    ...ir,
    id: ir.id,
    rules: ir.rules.map(cloneRule),
    diagnostics: ir.diagnostics.map((diag) => ({ ...diag })),
    meta: {
      ...ir.meta,
      passes: [...ir.meta.passes],
      sourceFiles: [...ir.meta.sourceFiles],
    },
  };
}

/** Debug: print IR summary */
export function debugIR(ir: StyleIR): string {
  const counts = countNodes(ir);
  return [
    "StyleIR {",
    "  id: " + ir.id,
    "  rules: " + counts.rules,
    "  declarations: " + counts.declarations,
    "  pseudoClasses: " + counts.pseudoClasses,
    "  atRules: " + counts.atRules,
    "  conditions: " + counts.conditions,
    "  diagnostics: " + ir.diagnostics.length,
    "  passes: [" + ir.meta.passes.join(", ") + "]",
    "}",
  ].join("\n");
}

/** Record a transform in a declaration's history — skipped in production builds. */
export function recordHistory(
  decl: { history: any[] },
  pass: string,
  action: string,
  previous?: any,
  reason?: string,
): void {
  if (
    typeof process !== "undefined" &&
    process.env &&
    process.env.NODE_ENV === "production"
  ) {
    return;
  }

  if (!decl.history) {
    decl.history = [];
  }

  decl.history.push({
    pass,
    action,
    timestamp: Date.now(),
    previous,
    reason,
  });
}

/**
 * Derive a CSS custom property name from a selector and property.
 * Matches the algorithm in style-compiler.ts compileDeclarations().
 */
export function getDynamicVariableName(selector: string, property: string): string {
  const prefix = selector
    .replace(/^\./, "")
    .replace(/^#/, "")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "chain-dynamic";
  const kebabProp = property.replace(/([A-Z])/g, "-$1").toLowerCase();
  return `--${prefix}-${kebabProp}`;
}