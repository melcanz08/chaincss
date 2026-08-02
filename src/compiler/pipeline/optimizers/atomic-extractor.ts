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
 * Safely escapes characters for standard CSS selector compatibility
 */
function escapeCSSIdentifier(str: string): string {
  return str.replace(/[^a-zA-Z0-9_-]/g, "\\$&").replace(/^([0-9])/, "\\3$1 ");
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

    // 1. Gather usage frequencies - only pure root rules
    const usageMap = new Map<
      string,
      {
        count: number;
        property: string;
        value: string | number;
        pseudo: string;
        media: string;
      }
    >();

    for (const rule of ir.rules) {
      if (rule.isDead || (rule as any).meta?.atomic) continue;
      if ((rule as any).pseudoClasses?.length || rule.atRules?.length) continue;

      const scopeKey = "root::all";
      const pseudo = "root";
      const media = "all";

      for (const decl of rule.declarations || []) {
        const key = `${scopeKey}::${decl.property}:${String(decl.value)}`;
        const existing = usageMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          usageMap.set(key, {
            count: 1,
            property: decl.property,
            value: decl.value,
            pseudo,
            media,
          });
        }
      }
    }

    const atomicRules: IRRule[] = [];
    const atomicClassMap = new Map<string, string>();

    // Utilize an isolated local cache context mapping to guarantee deterministic builds
    const globalUsage = context?.atomicUsageMap || new Map<string, number>();

    // 2. Determine which entries cross threshold limits safely
    for (const [key, data] of usageMap) {
      const globalCount = globalUsage.get(key) || 0;
      const totalCount = globalCount + data.count;
      globalUsage.set(key, totalCount);

      // Require a threshold of 3 appearances to justify atomic transformation friction
      if (totalCount < 3) continue;

      const RESERVED = new Set([
        "block",
        "inline",
        "flex",
        "grid",
        "inline-block",
        "inline-flex",
        "hidden",
        "none",
        "static",
        "relative",
        "absolute",
        "fixed",
        "sticky",
      ]);

      const rawName = generateAtomicClassName(
        data.property,
        data.value,
        data.pseudo,
        data.media,
        context,
      );
      const safeName = RESERVED.has(rawName) ? `_${rawName}` : rawName;
      atomicClassMap.set(key, safeName);

      // Create standard escaped class token rule block
      const escapedSelector = "." + escapeCSSIdentifier(safeName);
      const atomicRule = createRule(escapedSelector);

      atomicRule.declarations.push(
        createDeclaration(data.property, data.value, undefined, {
          atomic: true,
          usageCount: data.count,
          atomicSource: "extracted",
        } as any),
      );

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

    // 3. Substitute original rules with new reference pointer mappings
    let declarationsReplaced = 0;
    let bytesSaved = 0;

    for (const rule of ir.rules) {
      if (rule.isDead || (rule as any).meta?.atomic) continue;
      if ((rule as any).pseudoClasses?.length || rule.atRules?.length) continue;

      const scopeKey = "root::all";
      const atomicClasses: string[] = [];

      if (!(rule as any).meta) (rule as any).meta = {};
      if (!(rule as any).history) (rule as any).history = [];

      rule.declarations = rule.declarations.filter((decl: any) => {
        const key = `${scopeKey}::${decl.property}:${String(decl.value)}`;
        const className = atomicClassMap.get(key);

        if (className) {
          atomicClasses.push(className);
          declarationsReplaced++;

          const origBytes =
            decl.property.length + String(decl.value).length + 4;
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
      }
    }

    // Place shared utilities safely at the top to preserve natural cascade overrides
    const combinedRules = [...atomicRules, ...ir.rules];

    if (atomicRules.length > 0) {
      ir.diagnostics.push({
        id: `atomic-extract-${ir.id}-${atomicRules.length}`,
        nodeId: ir.id,
        severity: "info",
        message: `Extracted ${atomicRules.length} utility blocks from ${declarationsReplaced} declarations.`,
        suggestion: `${bytesSaved} bytes optimized`,
        pass: "atomic-extractor",
      });
    }

    return {
      ir: { ...ir, rules: combinedRules },
      savings: {
        rulesEliminated: 0,
        declarationsEliminated: declarationsReplaced,
        bytesSaved,
      },
      changes: atomicRules.length + declarationsReplaced,
    };
  },
};

function generateAtomicClassName(
  property: string,
  value: string | number,
  pseudo: string,
  media: string,
  context?: any,
): string {
  const customShorthands =
    context?.shorthands || context?.config?.shorthands || {};
  const val = String(value);

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

  const prefix = abbreviations[property] ?? property + "-";

  // Safely capture fractional structures cleanly (e.g., 1.5 -> 1_5) instead of turning into an empty dash string
  let cleanValue = val
    .replace(/^#/, "")
    .replace(/\./g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  let name =
    property === "display" || property === "position"
      ? cleanValue
      : prefix + cleanValue;

  // Add clean modifier markers if states or media scopes are active
  if (pseudo !== "root") {
    name = `${pseudo}-${name}`;
  }
  if (media !== "all") {
    const cleanMedia = media.replace(/[^a-zA-Z0-9]/g, "");
    name = `${cleanMedia}-${name}`;
  }

  return name;
}
