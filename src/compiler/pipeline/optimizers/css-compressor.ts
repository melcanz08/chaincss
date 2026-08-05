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
import { recordHistory } from "../ir/utils.js";

// Properties that safely support 1, 2, 3, or 4-value box model shorthand rules
const BOX_SHORTHAND_PROPERTIES = new Set([
  "margin",
  "padding",
  "border-width",
  "border-color",
  "border-style",
  "inset",
  "scroll-margin",
  "scroll-padding",
  "outline-width",
]);

// Units that MUST retain their unit even when the numeric value is 0
const UNSAFE_ZERO_UNITS = new Set([
  "s",
  "ms",
  "deg",
  "rad",
  "grad",
  "turn",
  "%",
  "dpi",
  "dpcm",
  "dppx",
  "hz",
  "khz",
  "fr",
]);

/**
 * Checks if a property supports standard top-right-bottom-left shorthand collapsing.
 */
function isBoxShorthandProperty(prop: string): boolean {
  return BOX_SHORTHAND_PROPERTIES.has(prop.toLowerCase().trim());
}

/**
 * Compress an individual AST value node recursively.
 */
function compressNode(
  node: CSSValueNode,
  decl: IRDeclaration,
  lowerProp: string,
  insideMathFunction = false
): { node: CSSValueNode; changed: boolean } {
  switch (node.kind) {
    case "color": {
      const hex = node.hex.toLowerCase();
      let newHex = hex;

      // #rrggbb -> #rgb
      if (
        hex.length === 7 &&
        hex[0] === "#" &&
        hex[1] === hex[2] &&
        hex[3] === hex[4] &&
        hex[5] === hex[6]
      ) {
        newHex = `#${hex[1]}${hex[3]}${hex[5]}`;
      }
      // #rrggbbaa -> #rgba
      else if (
        hex.length === 9 &&
        hex[0] === "#" &&
        hex[1] === hex[2] &&
        hex[3] === hex[4] &&
        hex[5] === hex[6] &&
        hex[7] === hex[8]
      ) {
        newHex = `#${hex[1]}${hex[3]}${hex[5]}${hex[7]}`;
      }

      if (newHex !== node.hex) {
        return { node: { ...node, hex: newHex }, changed: true };
      }
      return { node, changed: false };
    }

    case "dimension": {
      // Do not strip units inside math functions or for non-length units
      if (
        node.value === 0 &&
        !insideMathFunction &&
        !UNSAFE_ZERO_UNITS.has(node.unit.toLowerCase())
      ) {
        return { node: { kind: "number", value: 0 }, changed: true };
      }
      return { node, changed: false };
    }

    case "keyword": {
      const val = node.value.toLowerCase();

      // Optimize font-weight keyword aliases
      if (lowerProp === "font-weight" || lowerProp === "fontweight") {
        if (val === "normal") {
          return { node: { kind: "number", value: 400 }, changed: true };
        }
        if (val === "bold") {
          return { node: { kind: "number", value: 700 }, changed: true };
        }
      }
      return { node, changed: false };
    }

    case "function": {
      const fnName = node.name.toLowerCase();
      const isMathFn =
        insideMathFunction ||
        fnName === "calc" ||
        fnName === "min" ||
        fnName === "max" ||
        fnName === "clamp";

      let changed = false;
      const args = node.args;
      const newArgs = new Array(args.length);

      for (let i = 0, len = args.length; i < len; i++) {
        const r = compressNode(args[i], decl, lowerProp, isMathFn);
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
        const r = compressNode(items[i], decl, lowerProp, insideMathFunction);
        if (r.changed) changed = true;
        newItems[i] = r.node;
      }

      // Box model shorthand compression (requires space-separated values and matching property)
      const isSpaceSeparated = !node.separator || node.separator === " ";
      if (isSpaceSeparated && isBoxShorthandProperty(lowerProp)) {
        const strValues = newItems.map((item) => printAST(item));

        // 4 values: [top, right, bottom, left]
        if (strValues.length === 4) {
          const [t, r, b, l] = strValues;
          if (t === r && t === b && t === l) {
            // [10px, 10px, 10px, 10px] -> [10px]
            return {
              node: { kind: "list", items: [newItems[0]], separator: " " },
              changed: true,
            };
          }
          if (t === b && r === l) {
            // [10px, 20px, 10px, 20px] -> [10px, 20px]
            return {
              node: {
                kind: "list",
                items: [newItems[0], newItems[1]],
                separator: " ",
              },
              changed: true,
            };
          }
          if (r === l) {
            // [10px, 20px, 30px, 20px] -> [10px, 20px, 30px]
            return {
              node: {
                kind: "list",
                items: [newItems[0], newItems[1], newItems[2]],
                separator: " ",
              },
              changed: true,
            };
          }
        }

        // 3 values: [top, horizontal, bottom]
        if (strValues.length === 3) {
          const [t, h, b] = strValues;
          if (t === h && t === b) {
            // [10px, 10px, 10px] -> [10px]
            return {
              node: { kind: "list", items: [newItems[0]], separator: " " },
              changed: true,
            };
          }
          if (t === b) {
            // [10px, 20px, 10px] -> [10px, 20px]
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

        // 2 values: [vertical, horizontal]
        if (strValues.length === 2) {
          if (strValues[0] === strValues[1]) {
            // [10px, 10px] -> [10px]
            return {
              node: { kind: "list", items: [newItems[0]], separator: " " },
              changed: true,
            };
          }
        }
      }

      return { node: { ...node, items: newItems }, changed };
    }

    case "binary": {
      const left = compressNode(node.left, decl, lowerProp, insideMathFunction);
      const right = compressNode(node.right, decl, lowerProp, insideMathFunction);
      return {
        node: { ...node, left: left.node, right: right.node },
        changed: left.changed || right.changed,
      };
    }

    default:
      return { node, changed: false };
  }
}

/**
 * Compresses declarations within a rule context.
 */
function compressDeclarations(
  declarations: IRDeclaration[],
  passName: string
): { changes: number; bytesSaved: number } {
  let changes = 0;
  let bytesSaved = 0;

  for (let i = 0, len = declarations.length; i < len; i++) {
    const decl = declarations[i];
    if (!decl || !decl.property) continue;

    let ast = (decl.meta as any)?.ast as CSSValueNode | undefined;
    if (!ast && typeof decl.value === "string") {
      ast = parseCSSValue(decl.value);
    }
    if (!ast) continue;

    const lowerProp = decl.property.toLowerCase().trim();
    const oldValStr = String(decl.value || "");
    const { node, changed } = compressNode(ast, decl, lowerProp);

    if (changed) {
      const newValStr = printAST(node);
      const diff = oldValStr.length - newValStr.length;

      if (diff > 0) {
        bytesSaved += diff;
      }

      decl.value = newValStr;
      if (!decl.meta) decl.meta = {};
      (decl.meta as any).ast = node;

      changes++;
      recordHistory(
        decl as any,
        passName,
        "compressed-declaration-value",
        undefined,
        `Compressed value for "${decl.property}" from "${oldValStr}" to "${newValStr}"`
      );
    }
  }

  return { changes, bytesSaved };
}

/**
 * Recursively traverses rules, pseudo-classes, nested rules, and at-rules.
 */
function processRule(
  rule: IRRule,
  passName: string
): { changes: number; bytesSaved: number } {
  let totalChanges = 0;
  let totalBytesSaved = 0;

  if (rule.declarations) {
    const res = compressDeclarations(rule.declarations, passName);
    totalChanges += res.changes;
    totalBytesSaved += res.bytesSaved;
  }

  if (rule.pseudoClasses) {
    for (const pc of rule.pseudoClasses) {
      if (pc?.declarations) {
        const res = compressDeclarations(pc.declarations, passName);
        totalChanges += res.changes;
        totalBytesSaved += res.bytesSaved;
      }
    }
  }

  if (rule.nestedRules) {
    for (const nested of rule.nestedRules) {
      if (nested && !nested.isDead) {
        const res = processRule(nested, passName);
        totalChanges += res.changes;
        totalBytesSaved += res.bytesSaved;
      }
    }
  }

  if (rule.atRules) {
    for (const at of rule.atRules as any[]) {
      if (!at || at.isDead) continue;

      if (at.declarations) {
        const res = compressDeclarations(at.declarations, passName);
        totalChanges += res.changes;
        totalBytesSaved += res.bytesSaved;
      }

      if (at.nestedRules) {
        for (const sub of at.nestedRules) {
          if (sub && !sub.isDead) {
            const res = processRule(sub, passName);
            totalChanges += res.changes;
            totalBytesSaved += res.bytesSaved;
          }
        }
      }
    }
  }

  return { changes: totalChanges, bytesSaved: totalBytesSaved };
}

export const cssCompressor: OptimizationPass = {
  name: "css-compressor",
  cost: "cheap",
  requiredFor: ["css", "atomic-css"],

  optimize(ir: StyleIR): OptimizationResult {
    const rules = ir?.rules;
    if (!rules || rules.length === 0) {
      return {
        ir,
        savings: {
          rulesEliminated: 0,
          declarationsEliminated: 0,
          bytesSaved: 0,
        },
        changes: 0,
      };
    }

    if (!ir.diagnostics) {
      ir.diagnostics = [];
    }

    let totalChanges = 0;
    let totalBytesSaved = 0;

    for (let i = 0, len = rules.length; i < len; i++) {
      const rule = rules[i];
      if (!rule || rule.isDead) continue;

      const res = processRule(rule, "css-compressor");
      totalChanges += res.changes;
      totalBytesSaved += res.bytesSaved;
    }

    if (totalChanges > 0) {
      ir.diagnostics.push({
        id: `compress-${ir.id || "root"}-${Date.now()}`,
        nodeId: ir.id || "root",
        severity: "info",
        message: `CSS compressor: compressed ${totalChanges} declaration values (~${totalBytesSaved} bytes saved).`,
        pass: "css-compressor",
      });
    }

    return {
      ir,
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: 0,
        bytesSaved: totalBytesSaved,
      },
      changes: totalChanges,
    };
  },
};