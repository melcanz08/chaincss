// ============================================================================
// FILE: src/compiler/pipeline/validators/css-value-validator.ts
// ============================================================================
// Validates CSS values against standard CSS keywords and design tokens.
// Produces diagnostics with suggestions for invalid values.

import type { StyleIR, IRRule, IRDeclaration } from "../ir/types.js";
import type {
  ValidationPass,
  ValidationResult,
  Diagnostic,
} from "../pipeline-types.js";
import { DesignTokens } from "../../tokens/tokens.js";

// Singleton token resolver for this validator
const tokenResolver = new DesignTokens();

// ============================================================================
// Standard CSS Keyword Sets
// ============================================================================

const CSS_GLOBAL_KEYWORDS = new Set([
  "initial", "inherit", "unset", "revert", "revert-layer",
]);

const CSS_COLOR_KEYWORDS = new Set([
  "black", "silver", "gray", "white", "maroon", "red", "purple",
  "fuchsia", "green", "lime", "olive", "yellow", "navy", "blue",
  "teal", "aqua", "orange", "aliceblue", "antiquewhite",
  "aquamarine", "azure", "beige", "bisque", "blanchedalmond",
  "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse",
  "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson",
  "darkblue", "darkcyan", "darkgoldenrod", "darkgray", "darkgreen",
  "darkgrey", "darkkhaki", "darkmagenta", "darkolivegreen",
  "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
  "darkslateblue", "darkslategray", "darkslategrey", "darkturquoise",
  "darkviolet", "deeppink", "deepskyblue", "dimgray", "dimgrey",
  "dodgerblue", "firebrick", "floralwhite", "forestgreen",
  "gainsboro", "ghostwhite", "gold", "goldenrod", "greenyellow",
  "grey", "honeydew", "hotpink", "indianred", "indigo", "ivory",
  "khaki", "lavender", "lavenderblush", "lawngreen", "lemonchiffon",
  "lightblue", "lightcoral", "lightcyan", "lightgoldenrodyellow",
  "lightgray", "lightgreen", "lightgrey", "lightpink", "lightsalmon",
  "lightseagreen", "lightskyblue", "lightslategray", "lightslategrey",
  "lightsteelblue", "lightyellow", "limegreen", "linen", "magenta",
  "mediumaquamarine", "mediumblue", "mediumorchid", "mediumpurple",
  "mediumseagreen", "mediumslateblue", "mediumspringgreen",
  "mediumturquoise", "mediumvioletred", "midnightblue", "mintcream",
  "mistyrose", "moccasin", "navajowhite", "oldlace", "olivedrab",
  "orangered", "orchid", "palegoldenrod", "palegreen",
  "paleturquoise", "palevioletred", "papayawhip", "peachpuff",
  "peru", "pink", "plum", "powderblue", "rosybrown", "royalblue",
  "saddlebrown", "salmon", "sandybrown", "seagreen", "seashell",
  "sienna", "skyblue", "slateblue", "slategray", "slategrey",
  "snow", "springgreen", "steelblue", "tan", "thistle", "tomato",
  "turquoise", "violet", "wheat", "whitesmoke", "yellowgreen",
  "transparent", "currentColor",
]);

const CSS_DISPLAY_KEYWORDS = new Set([
  "block", "inline", "inline-block", "flex", "inline-flex", "grid",
  "inline-grid", "flow-root", "none", "contents", "table",
  "inline-table", "table-row", "table-cell", "table-column",
  "table-row-group", "table-column-group", "table-header-group",
  "table-footer-group", "table-caption", "list-item",
  "run-in", "ruby", "ruby-base", "ruby-text", "ruby-base-container",
  "ruby-text-container", "subgrid",
  "-webkit-box", "-webkit-inline-box",
]);

const CSS_FLEX_DIRECTION_KEYWORDS = new Set([
  "row", "row-reverse", "column", "column-reverse",
]);

const CSS_FLEX_WRAP_KEYWORDS = new Set([
  "nowrap", "wrap", "wrap-reverse",
]);

const CSS_ALIGN_ITEMS_KEYWORDS = new Set([
  "stretch", "center", "flex-start", "flex-end", "baseline",
  "auto", "start", "end", "self-start", "self-end",
]);

const CSS_JUSTIFY_CONTENT_KEYWORDS = new Set([
  "flex-start", "flex-end", "center", "space-between", "space-around",
  "space-evenly", "start", "end", "left", "right",
]);

const CSS_POSITION_KEYWORDS = new Set([
  "static", "relative", "absolute", "fixed", "sticky",
]);

const CSS_OVERFLOW_KEYWORDS = new Set([
  "visible", "hidden", "clip", "scroll", "auto",
]);

const CSS_BORDER_STYLE_KEYWORDS = new Set([
  "none", "hidden", "dotted", "dashed", "solid", "double",
  "groove", "ridge", "inset", "outset",
]);

const CSS_OUTLINE_STYLE_KEYWORDS = new Set([
  "none", "hidden", "dotted", "dashed", "solid", "double",
  "groove", "ridge", "inset", "outset",
]);

const CSS_TEXT_ALIGN_KEYWORDS = new Set([
  "left", "right", "center", "justify", "start", "end",
  "match-parent",
]);

const CSS_FONT_WEIGHT_KEYWORDS = new Set([
  "normal", "bold", "bolder", "lighter",
]);

const CSS_FONT_STYLE_KEYWORDS = new Set([
  "normal", "italic", "oblique",
]);

const CSS_TEXT_TRANSFORM_KEYWORDS = new Set([
  "none", "capitalize", "uppercase", "lowercase", "full-width",
  "full-size-kana",
]);

const CSS_WHITE_SPACE_KEYWORDS = new Set([
  "normal", "nowrap", "pre", "pre-wrap", "pre-line", "break-spaces",
]);

const CSS_BOX_SIZING_KEYWORDS = new Set([
  "content-box", "border-box",
]);

const CSS_FONT_FAMILY_GENERIC = new Set([
  "serif", "sans-serif", "monospace", "cursive", "fantasy",
  "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace",
  "ui-rounded", "emoji", "math", "fangsong",
]);

const CSS_CONTAINER_TYPE_KEYWORDS = new Set([
  "normal", "size", "inline-size",
]);

const CSS_ANIMATION_TIMING_KEYWORDS = new Set([
  "linear", "ease", "ease-in", "ease-out", "ease-in-out",
  "step-start", "step-end", "steps", "cubic-bezier",
]);

const CSS_ANIMATION_FILL_MODE_KEYWORDS = new Set([
  "none", "forwards", "backwards", "both",
]);

const CSS_ANIMATION_DIRECTION_KEYWORDS = new Set([
  "normal", "reverse", "alternate", "alternate-reverse",
]);

const CSS_ANIMATION_PLAY_STATE_KEYWORDS = new Set([
  "running", "paused",
]);

// Map normalized property names to their valid keyword sets
const PROPERTY_KEYWORD_MAP: Record<string, Set<string>> = {
  "display": CSS_DISPLAY_KEYWORDS,
  "flex-direction": CSS_FLEX_DIRECTION_KEYWORDS,
  "flex-wrap": CSS_FLEX_WRAP_KEYWORDS,
  "align-items": CSS_ALIGN_ITEMS_KEYWORDS,
  "justify-content": CSS_JUSTIFY_CONTENT_KEYWORDS,
  "position": CSS_POSITION_KEYWORDS,
  "overflow": CSS_OVERFLOW_KEYWORDS,
  "overflow-x": CSS_OVERFLOW_KEYWORDS,
  "overflow-y": CSS_OVERFLOW_KEYWORDS,
  "border-style": CSS_BORDER_STYLE_KEYWORDS,
  "outline-style": CSS_OUTLINE_STYLE_KEYWORDS,
  "text-align": CSS_TEXT_ALIGN_KEYWORDS,
  "font-weight": CSS_FONT_WEIGHT_KEYWORDS,
  "font-style": CSS_FONT_STYLE_KEYWORDS,
  "text-transform": CSS_TEXT_TRANSFORM_KEYWORDS,
  "white-space": CSS_WHITE_SPACE_KEYWORDS,
  "box-sizing": CSS_BOX_SIZING_KEYWORDS,
  "container-type": CSS_CONTAINER_TYPE_KEYWORDS,
  "animation-timing-function": CSS_ANIMATION_TIMING_KEYWORDS,
  "animation-fill-mode": CSS_ANIMATION_FILL_MODE_KEYWORDS,
  "animation-direction": CSS_ANIMATION_DIRECTION_KEYWORDS,
  "animation-play-state": CSS_ANIMATION_PLAY_STATE_KEYWORDS,
  "scroll-behavior": new Set(["auto", "smooth"]),
};

// ============================================================================
// Token Suggestion Engine
// ============================================================================

function getTokenSuggestion(value: string): string | null {
  // Skip pure numbers (e.g. "0", "1", "10", "0.5")
  if (/^-?\d*\.?\d+$/.test(value)) return null;
  const prefixes = [
    "colors.",
    "shadows.",
    "spacing.",
    "borderRadius.",
    "typography.fontFamily.",
    "typography.fontSize.",
    "typography.fontWeight.",
    "zIndex.",
  ];

  for (const prefix of prefixes) {
    const tokenPath = prefix + value;
    if (tokenResolver.has(tokenPath)) {
      return `$${tokenPath}`;
    }
  }

  return null;
}

// ============================================================================
// Value Validation Helpers
// ============================================================================

function isCssDimension(value: string): boolean {
  return /^-?\d*\.?\d+(px|rem|em|vh|vw|vmin|vmax|%|s|ms|deg|fr|ch|ex)$/.test(value);
}

function isCssNumber(value: string): boolean {
  return /^-?\d*\.?\d+$/.test(value);
}

function isCssColor(value: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value) ||
         /^(rgb|rgba|hsl|hsla)\(/.test(value);
}

function isCssFunction(value: string): boolean {
  return /^(var|calc|min|max|clamp|url|cubic-bezier|linear-gradient|radial-gradient)\(/.test(value);
}

function isCommaSeparatedFontFamily(value: string): boolean {
  // Font family names can be arbitrary strings, possibly quoted
  const parts = value.split(',').map(p => p.trim());
  return parts.every((part) => {
    // Quoted strings are always valid
    if (/^['"].*['"]$/.test(part)) return true;
    // Generic families are valid
    if (CSS_FONT_FAMILY_GENERIC.has(part)) return true;
    // Any non-empty string is a valid font family name
    return part.length > 0;
  });
}

function isSpaceSeparatedValue(value: string): boolean {
  if (!/\s/.test(value)) return false;
  const parts = value.trim().split(/\s+/);
  return parts.every((part) => {
    return (
      isCssDimension(part) ||
      isCssNumber(part) ||
      isCssColor(part) ||
      CSS_GLOBAL_KEYWORDS.has(part) ||
      CSS_COLOR_KEYWORDS.has(part) ||
      part === "auto" ||
      part === "solid" ||
      part === "dashed" ||
      part === "dotted" ||
      part === "none" ||
      part === "hidden"
    );
  });
}

// ============================================================================
// Declaration Validation
// ============================================================================

function validateDeclaration(decl: IRDeclaration, rule: IRRule): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  if (!decl || !decl.property || decl.value === undefined || decl.value === null) return diagnostics;

  const value = String(decl.value).trim();
  if (!value) return diagnostics;

  // If value starts with $, it's a token reference — assume valid
  if (value.startsWith("$")) return diagnostics;

  // If value is a CSS dimension (e.g. "16px", "1rem", "100%"), it's valid
  if (isCssDimension(value)) return diagnostics;

  // If value is a pure number, it's valid (ChainCSS auto-converts to px)
  if (isCssNumber(value)) return diagnostics;

  // If value contains any CSS function, assume valid
  if (/[a-zA-Z-]+\(/.test(value)) return diagnostics;

  // If value is a hex color or rgb/rgba/hsl/hsla, it's valid
  if (isCssColor(value)) return diagnostics;

  // If value is a global keyword, it's valid
  if (CSS_GLOBAL_KEYWORDS.has(value)) return diagnostics;

  // Normalize property name
  const normalizedProp = decl.property.replace(/([A-Z])/g, "-$1").toLowerCase();

  // Allow animation shorthand (e.g. "bounce 1s infinite", "slideIn 0.3s ease")
  if (normalizedProp === "animation") {
    return diagnostics;
  }

  // Allow transition shorthand (e.g. "all 0.2s ease", "transform 0.3s ease-in-out")
  if (normalizedProp === "transition") {
    return diagnostics;
  }

  // Allow arbitrary strings for the "content" property
  if (normalizedProp === "content") {
    return diagnostics;
  }

  // Skip validation for vendor-prefixed properties
  if (normalizedProp.startsWith("-webkit-") || normalizedProp.startsWith("-moz-") || normalizedProp.startsWith("-ms-") || normalizedProp.startsWith("-o-")) {
    return diagnostics;
  }

  // Allow numeric strings for properties that accept unitless numbers
  if (isCssNumber(value)) {
    const unitlessProps = new Set([
      "opacity", "line-height", "font-weight", "flex-grow", "flex-shrink", "order", "z-index", "scale", "animation-iteration-count",
    ]);
    if (unitlessProps.has(normalizedProp)) {
      return diagnostics;
    }
  }

  // Allow space-separated values (e.g. "12px 24px", "0 auto", "1px solid red")
  if (isSpaceSeparatedValue(value)) return diagnostics;

  // Allow comma-separated values (e.g. "transform 0.2s ease, box-shadow 0.2s ease")
  if (value.includes(",")) return diagnostics;

  // Allow known CSS keywords
  const ALL_CSS_KEYWORDS = new Set([
    ...CSS_COLOR_KEYWORDS,
    ...CSS_GLOBAL_KEYWORDS,
    "ellipsis", "pointer", "hidden", "touch", "vertical", "text",
    "auto", "none", "solid", "dashed", "dotted", "transparent",
    "block", "inline", "inline-block", "flex", "grid", "relative",
    "absolute", "fixed", "sticky", "static", "center", "flex-start",
    "flex-end", "space-between", "space-around", "space-evenly",
    "row", "column", "wrap", "nowrap", "baseline", "stretch",
    "normal", "bold", "italic", "oblique", "uppercase", "lowercase",
    "capitalize", "underline", "overline", "line-through",
  ]);
  if (ALL_CSS_KEYWORDS.has(value)) return diagnostics;

  // Check property-specific keyword sets
  const keywordSet = PROPERTY_KEYWORD_MAP[normalizedProp];
  if (keywordSet && keywordSet.has(value)) return diagnostics;

  // If value is a known token (without $ prefix), warn the user
  const tokenSuggestion = getTokenSuggestion(value);
  if (tokenSuggestion) {
    diagnostics.push({
      id: `css-value-token-suggestion-${rule.id}-${decl.id}`,
      nodeId: rule.id,
      severity: "warning",
      category: "css-value",
      message: `"${value}" is a design token. Use the token reference syntax instead.`,
      suggestion: `Use ${tokenSuggestion} instead of "${value}".`,
      autoFixable: true,
    });
    return diagnostics;
  }

  // Unknown value — hard error
  diagnostics.push({
    id: `css-value-invalid-${rule.id}-${decl.id}`,
    nodeId: rule.id,
    severity: "error",
    category: "css-value",
    message: `Unknown CSS value "${value}" for property "${normalizedProp}".`,
    suggestion: `Check the CSS specification or use a valid design token.`,
    autoFixable: false,
  });

  return diagnostics;
}

// ============================================================================
// Pass Definition
// ============================================================================

export const cssValueValidator: ValidationPass = {
  name: "css-value-validator",

  validate(ir: StyleIR): ValidationResult {
    const diagnostics: Diagnostic[] = [];

    if (!ir || !ir.rules) {
      return {
        diagnostics: [],
        passed: true,
        stats: { errors: 0, warnings: 0, info: 0, hints: 0 },
      };
    }

    const validateRules = (rules: IRRule[]) => {
      for (const rule of rules) {
        if (rule.isDead) continue;

        for (const decl of rule.declarations || []) {
          diagnostics.push(...validateDeclaration(decl, rule));
        }

        for (const pc of rule.pseudoClasses || []) {
          for (const decl of pc.declarations || []) {
            diagnostics.push(...validateDeclaration(decl, rule));
          }
        }

        if (rule.nestedRules?.length) {
          validateRules(rule.nestedRules);
        }
      }
    };

    validateRules(ir.rules);

    const errors = diagnostics.filter((d) => d.severity === "error").length;
    const warnings = diagnostics.filter((d) => d.severity === "warning").length;
    const info = diagnostics.filter((d) => d.severity === "info").length;
    const hints = diagnostics.filter((d) => d.severity === "hint").length;

    return {
      diagnostics,
      passed: errors === 0,
      stats: { errors, warnings, info, hints },
    };
  },
};