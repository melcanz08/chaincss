// ============================================================================
// FILE: src/compiler/pipeline/ir/parser.ts
// ============================================================================

import type { StyleDefinition } from "@shared/types/index.js";
import {
  createIR,
  createRule,
  createDeclaration,
  nextId,
  record,
} from "./index.js";
import type {
  SourceLocation,
  IRPseudoClass,
  IRAtRule,
  IRCondition,
  StyleIR,
  IRRule,
  IRKeyframeFrame,
} from "./types.js";

import { getDynamicVariableName } from "../dynamic/dynamic-variable.js";

// Fix #1: Reuse quoted dollar-brace regex from value-classifier
const QUOTED_DOLLAR_BRACE = /(['"])(?:(?!\1).)*\$\{(?:(?!\1).)*\1/;

function isDynamicToken(value: string): boolean {
  // ${ inside quotes is static CSS content — not dynamic
  if (value.includes("${") && !QUOTED_DOLLAR_BRACE.test(value)) return true;
  // theme.* and props.* only when valid token path
  if (
    value.startsWith("theme.") &&
    /^theme\.[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*$/.test(value)
  ) return true;
  if (
    value.startsWith("props.") &&
    /^props\.[a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*$/.test(value)
  ) return true;
  return false;
}

// ============================================================================
// Case Normalization
// ============================================================================

// Fix #5: LRU cache for normalizeProperty
const propCache = new Map<string, string>();
const PROP_CACHE_LIMIT = 500;

function parseNestedObject(
  selector: string,
  value: any,
  rule: IRRule,
  source?: SourceLocation,
): void {
  if (!value || typeof value !== "object") return;

  for (const [p, v] of Object.entries(value)) {
    if (p.startsWith("&")) {
      const nestedSelector = p.replace(/&/g, selector);
      const nestedRule = createRule(nestedSelector, source, rule.id);
      parseNestedObject(nestedSelector, v, nestedRule, source);
      rule.nestedRules.push(nestedRule);
      continue;
    }

    if (typeof v === "string" || typeof v === "number") {
      rule.declarations.push(
        createDeclaration(normalizeProperty(p), v, source),
      );
      continue;
    }

    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" || typeof item === "number") {
          rule.declarations.push(
            createDeclaration(normalizeProperty(p), item, source),
          );
        }
      }
      continue;
    }

    if (typeof v === "object" && v !== null) {
      const nestedSelector = `${selector} ${p}`.trim();
      const nestedRule = createRule(nestedSelector, source, rule.id);
      parseNestedObject(nestedSelector, v, nestedRule, source);
      rule.nestedRules.push(nestedRule);
    }
  }
}

function normalizeProperty(prop: string): string {
  if (propCache.has(prop)) return propCache.get(prop)!;

  let result: string;
  if (prop.startsWith("--")) {
    result = prop; // Preserve CSS custom properties
  } else if (!/[A-Z]/.test(prop)) {
    result = prop;
  } else {
    const needsLeadingDash = /^[A-Z]/.test(prop) || /^ms[A-Z]/.test(prop);
    const kebabed = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
    result = needsLeadingDash
      ? kebabed.startsWith("-")
        ? kebabed
        : "-" + kebabed
      : kebabed;
  }

  if (propCache.size >= PROP_CACHE_LIMIT) {
    const firstKey = propCache.keys().next().value as string | undefined;
    if (firstKey) propCache.delete(firstKey);
  }
  propCache.set(prop, result);
  return result;
}

// ============================================================================
// Parser: StyleDefinition → StyleIR
// ============================================================================

export function parseIR(
  styles: Record<string, StyleDefinition> | Record<string, any>,
  sourceFile?: string,
): StyleIR {
  const ir = createIR(sourceFile ? [sourceFile] : []);

  for (const [componentName, styleDef] of Object.entries(styles)) {
    if (!styleDef || typeof styleDef !== "object") continue;

    const selectors = Array.isArray(styleDef.selectors)
      ? styleDef.selectors
      : styleDef.selector
        ? [styleDef.selector]
        : ["." + componentName];

    const componentRules: IRRule[] = [];

    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      const rule = createRule(selector, {
        file: sourceFile,
        component: componentName,
      });

      const entries = Object.entries(styleDef);
      for (let j = 0; j < entries.length; j++) {
        const [prop, value] = entries[j];

        if (prop === "selectors" || prop === "selector" || prop.startsWith("_"))
          continue;
        if (prop === "atRules" || prop === "nestedRules" || prop === "themes")
          continue;

        // ── Pseudo-classes & pseudo-elements ──
        if (
          (prop.startsWith("&:") || prop.startsWith("&::")) &&
          typeof value === "object" &&
          value !== null
        ) {
          const isElement = prop.startsWith("&::");
          const pseudoName = prop.replace(/^&::?/, "");
          const pc: IRPseudoClass = {
            id: nextId(pseudoName),
            parentId: rule.id,
            name: isElement ? `::${pseudoName}` : pseudoName,
            declarations: [],
            source: rule.source,
            history: [
              record("parser", "created", undefined, `Parsed ${pseudoName}`),
            ],
          };
          for (const [p, v] of Object.entries(value)) {
            if (typeof v === "string" || typeof v === "number") {
              pc.declarations.push(
                createDeclaration(normalizeProperty(p), v, rule.source),
              );
            }
            // Fix #3: Array fallback values in pseudo-classes
            else if (Array.isArray(v)) {
              for (const item of v) {
                if (typeof item === "string" || typeof item === "number") {
                  pc.declarations.push(
                    createDeclaration(normalizeProperty(p), item, rule.source),
                  );
                }
              }
            }
          }
          if (pc.declarations.length) rule.pseudoClasses.push(pc);
          continue;
        }

        // ── Nested selectors ──
        if (
          prop.startsWith("&") &&
          typeof value === "object" &&
          value !== null
        ) {
          // Fix #2: Global ampersand replace — handles && and multiple &
          const nestedSelector = prop.replace(/&/g, rule.selector);
          const nestedRule = createRule(nestedSelector, rule.source, rule.id);
          for (const [p, v] of Object.entries(value)) {
            if (typeof v === "string" || typeof v === "number") {
              nestedRule.declarations.push(
                createDeclaration(normalizeProperty(p), v, rule.source),
              );
            }
            // Fix #3: Array fallback values in nested rules
            else if (Array.isArray(v)) {
              for (const item of v) {
                if (typeof item === "string" || typeof item === "number") {
                  nestedRule.declarations.push(
                    createDeclaration(normalizeProperty(p), item, rule.source),
                  );
                }
              }
            }
          }
          rule.nestedRules.push(nestedRule);
          continue;
        }

                // ── Nested selectors (recursive) ──
        if (
          prop.startsWith("&") &&
          typeof value === "object" &&
          value !== null
        ) {
          const nestedSelector = prop.replace(/&/g, rule.selector);
          const nestedRule = createRule(nestedSelector, rule.source, rule.id);
          parseNestedObject(nestedSelector, value, nestedRule, rule.source);
          rule.nestedRules.push(nestedRule);
          continue;
        }

        // ── Legacy `hover` key fallback ──
        if (
          prop === "hover" &&
          typeof value === "object" &&
          value !== null &&
          !styleDef["&:hover"]
        ) {
          const pc: IRPseudoClass = {
            id: nextId("hover"),
            parentId: rule.id,
            name: "hover",
            declarations: [],
            source: rule.source,
            history: [
              record("parser", "created", undefined, "Parsed hover block"),
            ],
          };

          const hEntries = Object.entries(value);
          for (let k = 0; k < hEntries.length; k++) {
            const [p, v] = hEntries[k];
            if (typeof v === "string" || typeof v === "number") {
              pc.declarations.push(
                createDeclaration(normalizeProperty(p), v, rule.source),
              );
            } else if (Array.isArray(v)) {
              for (const item of v) {
                if (typeof item === "string" || typeof item === "number") {
                  pc.declarations.push(
                    createDeclaration(normalizeProperty(p), item, rule.source),
                  );
                }
              }
            }
          }
          if (pc.declarations.length > 0) {
            rule.pseudoClasses.push(pc);
          }
          continue;
        }

        // ── Dynamic Values (functions) ──
        if (typeof value === "function") {
          const variable = getDynamicVariableName(selector, prop);
          rule.declarations.push(
            createDeclaration(normalizeProperty(prop), "", rule.source, {
              dynamic: {
                kind: "function",
                variable,
                // Fix #4: Store original function reference for runtime
                originalValue: value,
              },
            }),
          );
          continue;
        }

        // ── Dynamic Values (token/prop strings) ──
        if (typeof value === "string" && isDynamicToken(value)) {
          const variable = getDynamicVariableName(selector, prop);
          const kind: "token" | "prop" = value.startsWith("theme.") ? "token" : "prop";
          rule.declarations.push(
            createDeclaration(normalizeProperty(prop), value, rule.source, {
              dynamic: {
                kind,
                variable,
                // Fix #4: Store original token string for runtime
                originalValue: value,
              },
            }),
          );
          continue;
        }

        // Fix #3: Array fallback values — push each item as declaration
        if (Array.isArray(value)) {
          for (const item of value) {
            if (typeof item === "string" || typeof item === "number") {
              rule.declarations.push(
                createDeclaration(normalizeProperty(prop), item, rule.source),
              );
            }
          }
          continue;
        }

        // Fix #6: Responsive objects should be expanded by StyleCollector
        if (typeof value === "object" && value !== null) {
          if (
            typeof process !== "undefined" &&
            process.env?.NODE_ENV === "development"
          ) {
            console.warn(
              `[ChainCSS] Responsive object not expanded for "${prop}" — check StyleCollector. Value:`,
              value,
            );
          }
          continue;
        }

        // ── Regular CSS Declarations ──
        if (typeof value === "string" || typeof value === "number") {
          rule.declarations.push(
            createDeclaration(normalizeProperty(prop), value, rule.source),
          );
        }
      }

      ir.rules.push(rule);
      componentRules.push(rule);
    }

    // ── Parse At-Rules ──
    const allAtRules = styleDef._atRules || styleDef.atRules;
    if (allAtRules && Array.isArray(allAtRules)) {
      for (let i = 0; i < allAtRules.length; i++) {
        const atRule = allAtRules[i];
        if (!atRule || typeof atRule !== "object") continue;

        const type = atRule.type || "media";

        const templateAtRule: IRAtRule = {
          id: nextId("atrule"),
          type,
          query: atRule.query,
          name: atRule.name,
          declarations: [],
          nestedRules: [],
          keyframes: [],
          source: { file: sourceFile, component: componentName },
          history: [
            record("parser", "created", undefined, `Parsed @${type} block`),
          ],
        };

        if (atRule.styles && typeof atRule.styles === "object") {
          const sEntries = Object.entries(atRule.styles);
          for (let j = 0; j < sEntries.length; j++) {
            const [prop, value] = sEntries[j];
            if (typeof value === "string" || typeof value === "number") {
              templateAtRule.declarations.push(
                createDeclaration(
                  normalizeProperty(prop),
                  value,
                  templateAtRule.source,
                ),
              );
            } else if (Array.isArray(value)) {
              for (const item of value) {
                if (typeof item === "string" || typeof item === "number") {
                  templateAtRule.declarations.push(
                    createDeclaration(normalizeProperty(prop), item, templateAtRule.source),
                  );
                }
              }
            }
          }
        }

        if (
          type === "keyframes" &&
          atRule.frames &&
          typeof atRule.frames === "object"
        ) {
          const fEntries = Object.entries(atRule.frames);
          for (let j = 0; j < fEntries.length; j++) {
            const [keyText, frameStyles] = fEntries[j];
            if (frameStyles && typeof frameStyles === "object") {
              const frame: IRKeyframeFrame = {
                id: nextId("frame"),
                keyText,
                declarations: [],
                source: templateAtRule.source,
              };

              const fsEntries = Object.entries(frameStyles);
              for (let k = 0; k < fsEntries.length; k++) {
                const [p, v] = fsEntries[k];
                if (typeof v === "string" || typeof v === "number") {
                  frame.declarations.push(
                    createDeclaration(normalizeProperty(p), v, frame.source),
                  );
                }
              }
              templateAtRule.keyframes!.push(frame);
            }
          }
        }

        for (let j = 0; j < componentRules.length; j++) {
          const rule = componentRules[j];
          rule.atRules.push({
            ...templateAtRule,
            id: nextId("atrule"),
            parentId: rule.id,
            declarations: [...templateAtRule.declarations],
            keyframes: templateAtRule.keyframes
              ? templateAtRule.keyframes.map((f) => ({
                  ...f,
                  id: nextId("frame"),
                  declarations: [...f.declarations],
                }))
              : undefined,
            nestedRules: [...templateAtRule.nestedRules],
          });
        }
      }
    }

    // ── Parse Nested Rules ──
    const allNestedRules = styleDef._nestedRules || styleDef.nestedRules;
    if (allNestedRules && Array.isArray(allNestedRules)) {
      for (let i = 0; i < allNestedRules.length; i++) {
        const nestedDef = allNestedRules[i];
        if (!nestedDef || typeof nestedDef !== "object") continue;

        const nestedSelector = nestedDef.selector || "";
        const nestedStyles = nestedDef.styles || {};

        for (let j = 0; j < componentRules.length; j++) {
          const rule = componentRules[j];
          // Fix #2: Global ampersand replace
          const resolvedSelector = nestedSelector.includes("&")
            ? nestedSelector.replace(/&/g, rule.selector)
            : `${rule.selector} ${nestedSelector}`.trim();

          const nestedRule = createRule(resolvedSelector, rule.source, rule.id);

          for (const [p, v] of Object.entries(nestedStyles)) {
            if (typeof v === "string" || typeof v === "number") {
              nestedRule.declarations.push(
                createDeclaration(normalizeProperty(p), v, rule.source),
              );
            } else if (Array.isArray(v)) {
              for (const item of v) {
                if (typeof item === "string" || typeof item === "number") {
                  nestedRule.declarations.push(
                    createDeclaration(normalizeProperty(p), item, rule.source),
                  );
                }
              }
            }
          }
          rule.nestedRules.push(nestedRule);
        }
      }
    }

    // ── Parse Semantic Intents ──
    const allIntents: string[] = styleDef._intents || [];
    if (allIntents.length > 0) {
      for (let j = 0; j < componentRules.length; j++) {
        const rule = componentRules[j];
        if (!rule.passMeta) rule.passMeta = {};
        if (!rule.passMeta.analysis) rule.passMeta.analysis = {};
        if (!rule.passMeta.analysis.semantic) {
          rule.passMeta.analysis.semantic = {
            tokens: [],
            intents: [],
            constraints: [],
          };
        }
        rule.passMeta.analysis.semantic.intents = [
          ...(rule.passMeta.analysis.semantic.intents || []),
          ...allIntents,
        ];
      }
    }

    // ── Parse CSS if() Conditions ──
    if (styleDef._ifConditions && Array.isArray(styleDef._ifConditions)) {
      for (let i = 0; i < styleDef._ifConditions.length; i++) {
        const cond = styleDef._ifConditions[i];
        if (!cond.property || !cond.variable) {
          ir.diagnostics.push({
            id: nextId("diag"),
            nodeId: ir.id,
            severity: "warning",
            message: `Skipping malformed if() condition in ${componentName}: missing property or variable`,
            pass: "parser",
          });
          continue;
        }

        const templateCond: IRCondition = {
          id: nextId("cond"),
          property: normalizeProperty(cond.property),
          variable: cond.variable,
          conditions: cond.conditions || {},
          defaultValue: cond.defaultValue || "",
          source: { file: sourceFile, component: componentName },
        };

        for (let j = 0; j < componentRules.length; j++) {
          const rule = componentRules[j];
          rule.conditions.push({ ...templateCond, id: nextId("cond") });
        }
      }
    }
  }

  return ir;
}