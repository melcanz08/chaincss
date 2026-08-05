// ============================================================================
// FILE: src/compiler/pipeline/optimizers/atomic-extractor.ts
// ============================================================================

import { recordHistory } from "../ir/utils.js";
import { createRule, createDeclaration } from "../ir/index.js";
import type { StyleIR, IRRule } from "../ir/types.js";
import type {
  OptimizationPass,
  OptimizationResult,
} from "../pipeline-types.js";

/**
 * Safely escapes characters for standard CSS selector compatibility.
 */
function escapeCSSIdentifier(str: string): string {
  return str
    .replace(/^([0-9])/, "\\3$1 ")
    .replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

/**
 * Generates a concise, predictable utility class name for a property/value pair.
 */
// src/compiler/pipeline/optimizers/atomic-extractor.ts

function generateAtomicClassName(
  property: string,
  value: string | number,
  important: boolean,
  pseudo: string = "root",
  media: string = "all",
  context?: any,
): string {
  const customShorthands =
    context?.shorthands || context?.config?.shorthands || {};
  const val = String(value).trim();
  const isNegative = val.startsWith("-");

  const abbreviations: Record<string, string> = {
    display: "",
    position: "",
    color: "color-",
    "background-color": "bg-",
    "font-size": "text-",
    "font-weight": "font-",
    padding: "p-",
    "padding-top": "pt-",
    "padding-right": "pr-",
    "padding-bottom": "pb-",
    "padding-left": "pl-",
    margin: "m-",
    "margin-top": "mt-",
    "margin-right": "mr-",
    "margin-bottom": "mb-",
    "margin-left": "ml-",
    width: "w-",
    height: "h-",
    "border-radius": "rounded-",
    border: "border-",
    opacity: "opacity-",
    "z-index": "z-",
    cursor: "cursor-",
    overflow: "overflow-",
    "text-align": "text-",
    "justify-content": "justify-",
    "align-items": "items-",
    gap: "gap-",
    "box-shadow": "shadow-",
    transition: "transition-",
    "flex-direction": "flex-",
    ...customShorthands,
  };

  const prefix = abbreviations[property] ?? `${property}-`;

  // Clean value while preserving negative sign distinction
  const rawVal = isNegative ? val.slice(1) : val;
  let cleanValue = rawVal
    .replace(/^#/, "")
    .replace(/\./g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  if (!cleanValue) {
    cleanValue = "val";
  }

  let baseName = "";
  if (property === "display" || property === "position") {
    baseName = cleanValue;
  } else {
    baseName = `${prefix}${cleanValue}`;
  }

  // --- FIX: Prevent collision with bare utility names ---
  const reservedShorthands = new Set(["flex", "grid", "block", "inline", "hidden", "absolute", "relative", "fixed"]);
  if (reservedShorthands.has(baseName)) {
    baseName = `_${baseName}`;
  }
  // ------------------------------------------------------

  if (isNegative) {
    baseName = `neg-${baseName}`;
  }

  if (important) {
    baseName = `imp-${baseName}`;
  }

  if (pseudo !== "root") {
    const cleanPseudo = pseudo.replace(/[^a-zA-Z0-9]/g, "");
    baseName = `${cleanPseudo}-${baseName}`;
  }

  if (media !== "all") {
    const cleanMedia = media.replace(/[^a-zA-Z0-9]/g, "");
    baseName = `${cleanMedia}-${baseName}`;
  }

  return baseName;
}

export const atomicExtractor: OptimizationPass = {
  name: "atomic-extractor",
  cost: "moderate",
  requiredFor: ["atomic-css"],

  optimize(ir: StyleIR, context?: any): OptimizationResult {
    if (!ir || !ir.rules) {
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

    interface UsageEntry {
      count: number;
      property: string;
      value: string | number;
      important: boolean;
      pseudo: string;
      media: string;
    }

    const usageMap = new Map<string, UsageEntry>();

    // 1. Gather usage frequencies
    for (const rule of ir.rules) {
      if (rule.isDead || (rule as any).meta?.atomic) continue;
      if ((rule as any).pseudoClasses?.length || rule.atRules?.length) continue;

      const scopeKey = "root::all";
      const pseudo = "root";
      const media = "all";

      for (const decl of rule.declarations || []) {
        if (!decl || decl.property == null || decl.value == null) continue;

        const impFlag = decl.important ? "!imp" : "";
        const key = `${scopeKey}::${decl.property}:${String(decl.value)}${impFlag}`;
        const existing = usageMap.get(key);

        if (existing) {
          existing.count++;
        } else {
          usageMap.set(key, {
            count: 1,
            property: decl.property,
            value: decl.value,
            important: Boolean(decl.important),
            pseudo,
            media,
          });
        }
      }
    }

    const atomicRules: IRRule[] = [];
    const atomicClassMap = new Map<string, string>();
    const threshold = context?.config?.atomicThreshold ?? 3;

    // 2. Extract entries meeting usage threshold
    for (const [key, data] of usageMap) {
      if (data.count < threshold) continue;

      const rawName = generateAtomicClassName(
        data.property,
        data.value,
        data.important,
        data.pseudo,
        data.media,
        context,
      );

      atomicClassMap.set(key, rawName);

      const escapedSelector = "." + escapeCSSIdentifier(rawName);
      const atomicRule = createRule(escapedSelector);

      const atomicDecl = createDeclaration(data.property, data.value, undefined, {
        atomic: true,
        usageCount: data.count,
        atomicSource: "extracted",
      } as any);

      if (data.important) {
        atomicDecl.important = true;
      }

      atomicRule.declarations.push(atomicDecl);

      atomicRule.meta = {
        ...atomicRule.meta,
        atomic: true,
        usageCount: data.count,
        pseudoState: data.pseudo !== "root" ? data.pseudo : undefined,
        mediaQuery: data.media !== "all" ? data.media : undefined,
      };

      if (!(atomicRule as any).history) (atomicRule as any).history = [];
      (atomicRule as any).history.push({
        pass: "atomic-extractor",
        action: "extracted",
        timestamp: Date.now(),
        reason: `Extracted from ${data.count} usages. Key: "${key}"`,
      } as any);

      atomicRules.push(atomicRule);
    }

    // 3. Substitute original rules with atomic token references
    let declarationsReplaced = 0;
    let rulesEliminated = 0;
    let bytesSaved = 0;

    for (const rule of ir.rules) {
      if (rule.isDead || (rule as any).meta?.atomic) continue;
      if ((rule as any).pseudoClasses?.length || rule.atRules?.length) continue;

      const scopeKey = "root::all";
      const atomicClasses: string[] = [];

      if (!(rule as any).meta) (rule as any).meta = {};
      if (!(rule as any).history) (rule as any).history = [];

      rule.declarations = (rule.declarations || []).filter((decl: any) => {
        if (!decl) return false;

        const impFlag = decl.important ? "!imp" : "";
        const key = `${scopeKey}::${decl.property}:${String(decl.value)}${impFlag}`;
        const className = atomicClassMap.get(key);

        if (className) {
          atomicClasses.push(className);
          declarationsReplaced++;

          const origBytes =
            decl.property.length +
            String(decl.value).length +
            (decl.important ? 15 : 4);
          const refBytes = className.length + 1;
          bytesSaved += Math.max(0, origBytes - refBytes);

          try {
            recordHistory(
              decl as any,
              "atomic-extractor",
              "extracted-to-atomic",
              key,
              `Moved to atomic class .${className}`,
            );
          } catch {}
          return false;
        }
        return true;
      });

      if (atomicClasses.length > 0) {
        (rule.meta as any).atomicClasses = [
          ...((rule.meta as any).atomicClasses || []),
          ...atomicClasses,
        ];
        (rule.meta as any).atomicCount =
          (rule.meta as any).atomicClasses?.length ?? 0;

        (rule as any).history.push({
          pass: "atomic-extractor",
          action: "atomic-replace",
          timestamp: Date.now(),
          reason: `Replaced declarations with ${atomicClasses.length} atomic tokens in "${rule.selector}"`,
        } as any);

        // Mark fully emptied rules as dead
        if (rule.declarations.length === 0) {
          rule.isDead = true;
          rulesEliminated++;
        }
      }
    }

    // Prepend generated atomic rules to preserve cascade
    const combinedRules = [...atomicRules, ...ir.rules];

    if (atomicRules.length > 0) {
      ir.diagnostics.push({
        id: `atomic-extract-${ir.id}-${atomicRules.length}`,
        nodeId: ir.id,
        severity: "info",
        message: `Extracted ${atomicRules.length} utility blocks from ${declarationsReplaced} declarations (${rulesEliminated} rules emptied).`,
        suggestion: `${bytesSaved} bytes saved`,
        pass: "atomic-extractor",
      });
    }

    return {
      ir: { ...ir, rules: combinedRules },
      savings: {
        rulesEliminated,
        declarationsEliminated: declarationsReplaced,
        bytesSaved,
      },
      changes: atomicRules.length + declarationsReplaced,
    };
  },
};