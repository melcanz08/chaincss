// ============================================================================
// FILE: src/compiler/pipeline/normalizers/unit-normalizer.ts
// ============================================================================

import { recordHistory } from "../ir/utils.js";

import type { StyleIR, IRRule, IRAtRule } from "../ir/types.js";
import type {
  NormalizationPass,
  NormalizationResult,
  Correction,
} from "../pipeline-types.js";

const UNITLESS_PROPERTIES = new Set([
  "animation-composition",
  "animation-iteration-count",
  "aspect-ratio",
  "border-image-outset",
  "border-image-slice",
  "border-image-width",
  "box-flex",
  "box-flex-group",
  "box-ordinal-group",
  "column-count",
  "column-span",
  "counter-increment",
  "counter-reset",
  "counter-set",
  "fill-opacity",
  "flex",
  "flex-grow",
  "flex-order",
  "flex-shrink",
  "font-weight",
  "grid-area",
  "grid-column",
  "grid-column-end",
  "grid-column-span",
  "grid-column-start",
  "grid-row",
  "grid-row-end",
  "grid-row-span",
  "grid-row-start",
  "hyphenate-limit-chars",
  "line-clamp",
  "line-height",
  "mask-border-outset",
  "mask-border-slice",
  "mask-border-width",
  "math-depth",
  "opacity",
  "order",
  "orphans",
  "scale",
  "stroke-dasharray",
  "stroke-dashoffset",
  "stroke-miterlimit",
  "stroke-opacity",
  "stroke-width",
  "tab-size",
  "widows",
  "z-index",
  "zoom",
]);

// Pre-compiled regex constants
const REGEX_UPPER_CASE = /[A-Z]/g;
const REGEX_VENDOR_PREFIX = /^-?(?:webkit|moz|ms|o)-/;
const REGEX_NUMERIC_STRING = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i;

function toUnprefixedKebab(prop: string): { kebab: string; clean: string } {
  const propLower = prop.toLowerCase();
  const kebab =
    propLower === prop
      ? prop
      : prop.replace(
          REGEX_UPPER_CASE,
          (m, offset) => (offset > 0 ? "-" : "") + m.toLowerCase(),
        );

  const clean = kebab.replace(REGEX_VENDOR_PREFIX, "");
  return { kebab, clean };
}

export const unitNormalizer: NormalizationPass = {
  name: "unit-normalizer",

  normalize(ir: StyleIR): NormalizationResult {
    const corrections: Correction[] = [];

    function normalizeRule(rule: IRRule | IRAtRule) {
      if (!rule || ("isDead" in rule && rule.isDead)) return;

      const decls = rule.declarations;
      if (decls) {
        for (let i = 0, len = decls.length; i < len; i++) {
          const decl = decls[i];
          if (!decl || !decl.property) continue;
          if (decl.property.startsWith("--")) continue;

          const { kebab, clean } = toUnprefixedKebab(decl.property);

          if (
            UNITLESS_PROPERTIES.has(clean) ||
            UNITLESS_PROPERTIES.has(kebab)
          ) {
            continue;
          }

          const val = decl.value;
          if (typeof val === "number") {
            if (val === 0) continue;

            const original = val;
            decl.value = val + "px";
            corrections.push({
              nodeId: decl.id,
              property: decl.property,
              original,
              corrected: decl.value,
              reason: "Added px unit to number value",
            });
            recordHistory(
              decl,
              "unit-normalizer",
              "added-unit",
              original,
              "Added px unit to number value",
            );
          } else if (
            typeof val === "string" &&
            REGEX_NUMERIC_STRING.test(val)
          ) {
            if (parseFloat(val) === 0) continue;

            const original = val;
            decl.value = val + "px";
            corrections.push({
              nodeId: decl.id,
              property: decl.property,
              original,
              corrected: decl.value,
              reason: "Added px unit to numeric string value",
            });
            recordHistory(
              decl,
              "unit-normalizer",
              "added-unit",
              original,
              "Added px unit to numeric string value",
            );
          }
        }
      }

      if ("pseudoClasses" in rule && rule.pseudoClasses) {
        const pseudoClasses = rule.pseudoClasses;
        for (let i = 0, len = pseudoClasses.length; i < len; i++) {
          normalizeRule(pseudoClasses[i] as unknown as IRRule);
        }
      }

      const nestedRules = rule.nestedRules;
      if (nestedRules) {
        for (let i = 0, len = nestedRules.length; i < len; i++) {
          normalizeRule(nestedRules[i]);
        }
      }

      if ("atRules" in rule && rule.atRules) {
        const atRules = rule.atRules;
        for (let i = 0, len = atRules.length; i < len; i++) {
          const at = atRules[i];
          normalizeRule(at);

          if ("keyframes" in at && at.keyframes) {
            const keyframes = at.keyframes;
            for (let j = 0, jLen = keyframes.length; j < jLen; j++) {
              normalizeRule(keyframes[j] as unknown as IRRule);
            }
          }
        }
      }
    }

    const rules = ir?.rules;
    if (rules) {
      for (let i = 0, len = rules.length; i < len; i++) {
        normalizeRule(rules[i]);
      }
    }

    return { ir, corrections };
  },
};