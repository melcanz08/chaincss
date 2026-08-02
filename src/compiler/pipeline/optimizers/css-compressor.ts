// ============================================================================
// FILE: src/compiler/pipeline/optimizers/css-compressor.ts
// AST-based CSS compressor. Operates directly on the dependency graph.
// ============================================================================

import type { StyleIR, IRDeclaration, IRRule } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";
import type { CSSValueNode } from "../ir/css-ast.js";
import { printAST, parseCSSValue } from "../ir/css-ast.js";

function compressNode(
  node: CSSValueNode,
  decl: IRDeclaration,
  lowerProp: string,
): { node: CSSValueNode; changed: boolean } {
  switch (node.kind) {
    case "color": {
      const hex = node.hex;
      if (
        hex.length === 7 &&
        hex[0] === "#" &&
        hex[1] === hex[2] &&
        hex[3] === hex[4] &&
        hex[5] === hex[6]
      ) {
        return {
          node: { ...node, hex: `#${hex[1]}${hex[3]}${hex[5]}` },
          changed: true,
        };
      }
      return { node, changed: false };
    }

    case "dimension": {
      if (node.value === 0 && node.unit !== "s" && node.unit !== "ms") {
        return { node: { kind: "number", value: 0 }, changed: true };
      }
      return { node, changed: false };
    }

    case "keyword": {
      if (
        (lowerProp === "fontweight" || lowerProp === "font-weight") &&
        node.value === "normal"
      ) {
        return { node: { kind: "number", value: 400 }, changed: true };
      }
      if (
        (lowerProp === "fontweight" || lowerProp === "font-weight") &&
        node.value === "bold"
      ) {
        return { node: { kind: "number", value: 700 }, changed: true };
      }
      return { node, changed: false };
    }

    case "function": {
      let changed = false;
      const args = node.args;
      const newArgs = new Array(args.length);
      for (let i = 0, len = args.length; i < len; i++) {
        const r = compressNode(args[i], decl, lowerProp);
        if (r.changed) changed = true;
        newArgs[i] = r.node;
      }
      return { node: { ...node, args: newArgs }, changed };
    }

    case "list": {
      let changed = false;
      const items = node.items;
      const newItems = new Array(items.length);
      for (let i = 0, len = items.length; i < len; i++) {
        const r = compressNode(items[i], decl, lowerProp);
        if (r.changed) changed = true;
        newItems[i] = r.node;
      }

      // Box model shorthand: 4 identical values → 1
      if (newItems.length === 4) {
        const s0 = printAST(newItems[0]);
        const s1 = printAST(newItems[1]);
        const s2 = printAST(newItems[2]);
        const s3 = printAST(newItems[3]);
        if (s0 === s1 && s0 === s2 && s0 === s3) {
          return {
            node: { kind: "list", items: [newItems[0]], separator: " " },
            changed: true,
          };
        }
        if (s0 === s2 && s1 === s3) {
          return {
            node: {
              kind: "list",
              items: [newItems[0], newItems[1]],
              separator: " ",
            },
            changed: true,
          };
        }
      }
      return { node: { ...node, items: newItems }, changed };
    }

    case "binary": {
      const left = compressNode(node.left, decl, lowerProp);
      const right = compressNode(node.right, decl, lowerProp);
      return {
        node: { ...node, left: left.node, right: right.node },
        changed: left.changed || right.changed,
      };
    }

    default:
      return { node, changed: false };
  }
}

function compressRule(rule: IRRule): number {
  let changes = 0;
  const decls = rule.declarations;
  if (!decls) return 0;

  for (let i = 0, len = decls.length; i < len; i++) {
    const decl = decls[i];
    if (!decl || !decl.property) continue;

    let ast = (decl.meta as any)?.ast as CSSValueNode | undefined;
    if (!ast && typeof decl.value === "string") {
      ast = parseCSSValue(decl.value);
    }
    if (!ast || typeof decl.value !== "string") continue;

    const lowerProp = decl.property.toLowerCase();
    const { node, changed } = compressNode(ast, decl, lowerProp);
    if (changed) {
      decl.value = printAST(node);
      if (!decl.meta) decl.meta = {};
      (decl.meta as any).ast = node;
      changes++;
    }
  }
  return changes;
}

export const cssCompressor: OptimizationPass = {
  name: "css-compressor",
  cost: "cheap",
  requiredFor: ["css", "atomic-css"],

  optimize(ir: StyleIR): OptimizationResult {
    let changes = 0;
    const rules = ir?.rules;
    if (!rules)
      return {
        ir,
        savings: {
          rulesEliminated: 0,
          declarationsEliminated: 0,
          bytesSaved: 0,
        },
        changes: 0,
      };

    for (let i = 0, len = rules.length; i < len; i++) {
      const rule = rules[i];
      if (!rule || rule.isDead) continue;
      changes += compressRule(rule);
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: 0,
        bytesSaved: changes * 5,
      },
      changes,
    };
  },
};
