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

function escapeCSSIdentifier(str: string): string {
  return str
    .replace(/^([0-9])/, "\\3$1 ")
    .replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

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

  const reservedShorthands = new Set(["flex", "grid", "block", "inline", "hidden", "absolute", "relative", "fixed"]);
  if (reservedShorthands.has(baseName)) {
    baseName = `_${baseName}`;
  }

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

// ============================================================================
// Helpers
// ============================================================================

const DELIM = "\x00";

function makeKey(
  scopeKey: string,
  property: string,
  value: string | number,
  impFlag: string,
): string {
  return `${scopeKey}${DELIM}${property}${DELIM}${String(value)}${DELIM}${impFlag}`;
}

interface UsageEntry {
  count: number;
  property: string;
  value: string | number;
  important: boolean;
  pseudo: string;
  media: string;
}

function gatherDeclarations(
  usageMap: Map<string, UsageEntry>,
  declarations: any[] | undefined,
  scopeKey: string,
  pseudo: string,
  media: string,
): void {
  if (!declarations) return;
  for (const decl of declarations) {
    if (!decl || decl.property == null) continue;

    // Fix #2: Expand array fallback values
    const values = Array.isArray(decl.value) ? decl.value : [decl.value];

    for (const val of values) {
      if (val == null) continue;

      const impFlag = decl.important ? "!imp" : "";
      const key = makeKey(scopeKey, decl.property, val, impFlag);
      const existing = usageMap.get(key);

      if (existing) {
        existing.count++;
      } else {
        usageMap.set(key, {
          count: 1,
          property: decl.property,
          value: val,
          important: Boolean(decl.important),
          pseudo,
          media,
        });
      }
    }
  }
}

// ============================================================================
// Main Optimizer
// ============================================================================

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

    const usageMap = new Map<string, UsageEntry>();

    function walkRule(rule: IRRule, parentMedia: string): void {
      if (rule.isDead || (rule as any).meta?.atomic) return;

      const media = parentMedia;

      gatherDeclarations(usageMap, rule.declarations, "root", "root", media);

      for (const pc of rule.pseudoClasses || []) {
        const pseudo = pc.name || "root";
        gatherDeclarations(usageMap, pc.declarations, pseudo, pseudo, media);
      }

      for (const atRule of rule.atRules || []) {
        const atMedia = atRule.query
          ? `${atRule.type}:${atRule.query}`
          : atRule.type;
        for (const nested of atRule.nestedRules || []) {
          walkRule(nested, atMedia);
        }
      }

      for (const nested of rule.nestedRules || []) {
        walkRule(nested, media);
      }
    }

    for (const rule of ir.rules) {
      walkRule(rule, "all");
    }

    const atomicRules: IRRule[] = [];
    const atomicClassMap = new Map<string, string>();
    const threshold = context?.config?.atomicThreshold ?? 3;

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

      if (data.media !== "all") {
        const parts = data.media.split(":");
        const type = parts[0] as any;
        const query = parts.slice(1).join(":");
        const atRule = {
          id: `at-${rawName}`,
          type,
          query,
          name: undefined,
          declarations: [atomicDecl],
          nestedRules: [],
          source: atomicRule.source,
          history: [],
        };
        atomicRule.atRules = [atRule];
        atomicRule.declarations = [];
      } else {
        atomicRule.declarations.push(atomicDecl);
      }

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

    // Fix #5: Sort atomicRules for deterministic output
    atomicRules.sort((a, b) => a.selector.localeCompare(b.selector));

    let declarationsReplaced = 0;
    let rulesEliminated = 0;
    let bytesSaved = 0;

    function substituteRule(rule: IRRule, parentMedia: string): void {
      if (rule.isDead || (rule as any).meta?.atomic) return;

      const atomicClasses: string[] = [];

      if (!(rule as any).meta) (rule as any).meta = {};
      if (!(rule as any).history) (rule as any).history = [];

      rule.declarations = (rule.declarations || []).filter((decl: any) => {
        if (!decl) return false;

        // Fix #2: Substitute array fallback values
        const values = Array.isArray(decl.value) ? decl.value : [decl.value];

        for (const val of values) {
          const impFlag = decl.important ? "!imp" : "";
          const key = makeKey("root", decl.property, val, impFlag);
          const className = atomicClassMap.get(key);

          if (className) {
            atomicClasses.push(className);
            declarationsReplaced++;

            const origBytes =
              decl.property.length +
              String(val).length +
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
        }
        return true;
      });

      const keptPseudoClasses: typeof rule.pseudoClasses = [];
      for (const pc of rule.pseudoClasses || []) {
        const pseudo = pc.name || "root";

        pc.declarations = (pc.declarations || []).filter((decl: any) => {
          if (!decl) return false;

          const values = Array.isArray(decl.value) ? decl.value : [decl.value];

          for (const val of values) {
            const impFlag = decl.important ? "!imp" : "";
            const key = makeKey(pseudo, decl.property, val, impFlag);
            const className = atomicClassMap.get(key);

            if (className) {
              atomicClasses.push(className);
              declarationsReplaced++;

              const origBytes =
                decl.property.length +
                String(val).length +
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
          }
          return true;
        });

        if (pc.declarations.length > 0) {
          keptPseudoClasses.push(pc);
        }
      }
      rule.pseudoClasses = keptPseudoClasses;

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

      // Fix #1: Check all structural collections before marking dead
      if (
        rule.declarations.length === 0 &&
        (rule.pseudoClasses || []).length === 0 &&
        (rule.atRules || []).length === 0 &&
        (rule.nestedRules || []).length === 0
      ) {
        rule.isDead = true;
        rulesEliminated++;
      }

      for (const nested of rule.nestedRules || []) {
        substituteRule(nested, parentMedia);
      }

      for (const atRule of rule.atRules || []) {
        for (const nested of atRule.nestedRules || []) {
          substituteRule(nested, parentMedia);
        }
      }
    }

    for (const rule of ir.rules) {
      substituteRule(rule, "all");
    }

    // Fix #5: combinedRules uses sorted atomicRules
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