// src/compiler/pipeline/normalizers/intent-dat.ts

import type { CorrectionResult, IntentContext } from "@shared/types/index.js";

export interface ValueCorrection {
  wrong: string;
  correct: string;
  confidence: number;
}

export interface SemanticIntent {
  pattern: RegExp;
  handler: (value: string, ctx: IntentContext) => CorrectionResult | null;
  description: string;
}

function toKebabCase(prop: string): string {
  return prop
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

const BUILTIN_SEMANTIC_INTENTS: SemanticIntent[] = [
  {
    pattern: /^flexbox$/i,
    handler: (v: string, ctx: IntentContext): CorrectionResult => ({
      original: v,
      property: ctx.property || "display",
      corrected: "flex",
      defaults: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      },
      confidence: 0.95,
      intent: "flexbox-centering",
      explanation: '"flexbox" mapped to display: flex with centering defaults.',
    }),
    description: "flexbox -> flex + centering",
  },
  {
    pattern: /^(absolutely|abs)$/i,
    handler: (v: string, ctx: IntentContext): CorrectionResult => ({
      original: v,
      property: ctx.property || "position",
      corrected: "absolute",
      defaults: { position: "absolute" },
      confidence: 0.9,
      intent: "absolute-position",
      explanation: '"abs/absolutely" -> position: absolute',
    }),
    description: "abs -> absolute",
  },
  {
    pattern: /^(rel|relatively)$/i,
    handler: (v: string, ctx: IntentContext): CorrectionResult => ({
      original: v,
      property: ctx.property || "position",
      corrected: "relative",
      defaults: { position: "relative" },
      confidence: 0.9,
      intent: "relative-position",
      explanation: '"rel/relatively" -> position: relative',
    }),
    description: "rel -> relative",
  },
  {
    pattern: /^(hidden|invisible)$/i,
    handler: (v: string, ctx: IntentContext): CorrectionResult | null => {
      const prop = (ctx.property || "").toLowerCase();
      if (prop.startsWith("overflow")) return null;

      const low = v.toLowerCase();
      if (prop === "display") {
        return {
          original: v,
          property: "display",
          corrected: "none",
          defaults: { display: "none" },
          confidence: 0.95,
          intent: "display-none",
          explanation: '"' + v + '" on display -> display: none',
        };
      }

      return {
        original: v,
        property: ctx.property || "visibility",
        corrected: low === "invisible" ? "hidden" : low,
        defaults: { visibility: "hidden" },
        confidence: 0.9,
        intent: "visibility-toggle",
        explanation: '"' + v + '" -> visibility: hidden',
      };
    },
    description: "invisible/hidden -> visibility: hidden or display: none",
  },
  {
    pattern: /^(full|fullscreen|full-screen)$/i,
    handler: (v: string, ctx: IntentContext): CorrectionResult => {
      const prop = (ctx.property || "").toLowerCase();
      const isWidthOnly = prop === "width" || prop === "min-width" || prop === "max-width";
      const isHeightOnly = prop === "height" || prop === "min-height" || prop === "max-height";

      const defaults: Record<string, string> = isWidthOnly
        ? { width: "100%" }
        : isHeightOnly
        ? { height: "100%" }
        : { width: "100%", height: "100%" };

      return {
        original: v,
        property: ctx.property || "size",
        corrected: "100%",
        defaults,
        confidence: 0.85,
        intent: "full-size",
        explanation: '"full/fullscreen" -> 100%',
      };
    },
    description: "full -> 100%",
  },
  {
    pattern: /^(rounded|round)$/i,
    handler: (v: string, ctx: IntentContext): CorrectionResult => ({
      original: v,
      property: ctx.property || "border-radius",
      corrected: "9999px",
      defaults: { borderRadius: "9999px" },
      confidence: 0.8,
      intent: "rounded-pill",
      explanation: '"rounded" -> border-radius: 9999px (pill)',
    }),
    description: "rounded -> pill",
  },
];

export const SEMANTIC_INTENTS: SemanticIntent[] = [...BUILTIN_SEMANTIC_INTENTS];

export function registerSemanticIntent(
  intent: SemanticIntent,
  allowOverride = false,
) {
  if (allowOverride) {
    const idx = SEMANTIC_INTENTS.findIndex(
      (i) =>
        i.description === intent.description ||
        i.pattern.source === intent.pattern.source,
    );
    if (idx !== -1) {
      SEMANTIC_INTENTS[idx] = intent;
      return;
    }
  }
  SEMANTIC_INTENTS.push(intent);
}

export function registerSemanticIntents(
  intents: SemanticIntent[],
  allowOverride = false,
) {
  for (let i = 0, len = intents.length; i < len; i++) {
    registerSemanticIntent(intents[i], allowOverride);
  }
}

export function resetSemanticIntents() {
  SEMANTIC_INTENTS.length = 0;
  SEMANTIC_INTENTS.push(...BUILTIN_SEMANTIC_INTENTS);
}

const BUILTIN_VALUE_CORRECTIONS: Record<string, ValueCorrection[]> = {
  display: [
    { wrong: "flexbox", correct: "flex", confidence: 0.95 },
    { wrong: "inline-flexbox", correct: "inline-flex", confidence: 0.95 },
  ],
  position: [
    { wrong: "abs", correct: "absolute", confidence: 0.9 },
    { wrong: "rel", correct: "relative", confidence: 0.9 },
  ],
  "text-align": [
    { wrong: "centered", correct: "center", confidence: 0.85 },
    { wrong: "justified", correct: "justify", confidence: 0.85 },
  ],
  overflow: [{ wrong: "scrollable", correct: "auto", confidence: 0.8 }],
  cursor: [{ wrong: "hand", correct: "pointer", confidence: 0.9 }],
  "user-select": [{ wrong: "unselectable", correct: "none", confidence: 0.85 }],
};

export const VALUE_CORRECTIONS: Record<string, ValueCorrection[]> = {
  ...BUILTIN_VALUE_CORRECTIONS,
};

export function registerValueCorrections(
  prop: string,
  corrections: ValueCorrection[],
) {
  const kebab = toKebabCase(prop);
  VALUE_CORRECTIONS[kebab] = [
    ...(VALUE_CORRECTIONS[kebab] || []),
    ...corrections,
  ];
}

export function resetValueCorrections() {
  for (const k of Object.keys(VALUE_CORRECTIONS)) {
    delete VALUE_CORRECTIONS[k];
  }
  Object.assign(VALUE_CORRECTIONS, BUILTIN_VALUE_CORRECTIONS);
}

const BUILTIN_KNOWN = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "inset",
  "inset-block",
  "inset-inline",
  "size",
  "width",
  "height",
  "min-width",
  "max-width",
  "min-height",
  "max-height",
  "margin",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "box-sizing",
  "overflow",
  "overflow-x",
  "overflow-y",
  "color",
  "background",
  "background-color",
  "background-image",
  "background-position",
  "background-size",
  "background-repeat",
  "background-clip",
  "opacity",
  "box-shadow",
  "font-size",
  "font-weight",
  "font-family",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-decoration",
  "text-transform",
  "text-overflow",
  "white-space",
  "word-break",
  "vertical-align",
  "direction",
  "flex",
  "flex-direction",
  "flex-wrap",
  "flex-basis",
  "flex-grow",
  "flex-shrink",
  "justify-content",
  "align-items",
  "align-content",
  "align-self",
  "order",
  "gap",
  "row-gap",
  "column-gap",
  "grid",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "grid-area",
  "grid-auto-columns",
  "grid-auto-rows",
  "grid-auto-flow",
  "visibility",
  "transform",
  "transition",
  "animation",
  "backdrop-filter",
  "filter",
  "mix-blend-mode",
  "cursor",
  "pointer-events",
  "user-select",
  "appearance",
  "outline",
  "outline-style",
  "outline-width",
  "outline-color",
  "outline-offset",
  "resize",
  "caret-color",
  "accent-color",
  "scroll-behavior",
  "overscroll-behavior",
  "z-index",
  "isolation",
  "border-collapse",
  "border-spacing",
  "table-layout",
  "fill",
  "stroke",
  "stroke-width",
  "object-fit",
  "object-position",
  "aspect-ratio",
  "content",
  "will-change",
  "contain",
  "clip",
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-delay",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "animation-play-state",
  "scroll-timeline",
  "scroll-timeline-name",
  "scroll-timeline-axis",
  "view-timeline",
  "view-timeline-name",
  "view-timeline-axis",
  "view-timeline-inset",
  "timeline-scope",
  "animation-timeline",
  "animation-range",
  "animation-composition",
  "container",
  "container-name",
  "container-type",
];

export const KNOWN_PROPERTIES: string[] = [...BUILTIN_KNOWN];
const knownSet = new Set<string>(BUILTIN_KNOWN.map((p) => p.toLowerCase()));
const customKnown = new Set<string>();
const customKnownProperties = new Set<string>();
const propertyCache = new Map<string, string | null>();

export function registerCustomKnownProperties(props: string[]): void {
  for (const prop of props) {
    const kebab = toKebabCase(prop);
    customKnown.add(kebab);
    customKnownProperties.add(prop);
  }
}

export function isKnownProperty(prop: string): boolean {
  if (!prop) return false;
  if (prop.startsWith("--")) return true;
  const kebab = toKebabCase(prop);
  return knownSet.has(kebab) || customKnown.has(kebab);
}

export function resetKnownProperties() {
  KNOWN_PROPERTIES.length = 0;
  KNOWN_PROPERTIES.push(...BUILTIN_KNOWN);
  knownSet.clear();
  for (let i = 0, len = BUILTIN_KNOWN.length; i < len; i++) {
    knownSet.add(BUILTIN_KNOWN[i].toLowerCase());
  }
  customKnown.clear();
  customKnownProperties.clear();
  propertyCache.clear();
}

let prevRow = new Int32Array(128);
let curRow = new Int32Array(128);

export function levenshtein(a: string, b: string, maxDist = 4): number {
  if (Math.abs(a.length - b.length) > maxDist) return maxDist + 1;
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;

  if (bl + 1 > prevRow.length) {
    prevRow = new Int32Array(bl + 64);
    curRow = new Int32Array(bl + 64);
  }

  for (let j = 0; j <= bl; j++) prevRow[j] = j;

  for (let i = 1; i <= al; i++) {
    curRow[0] = i;
    let minInRow = curRow[0];
    const ca = a.charCodeAt(i - 1);

    for (let j = 1; j <= bl; j++) {
      const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
      curRow[j] = Math.min(prevRow[j] + 1, curRow[j - 1] + 1, prevRow[j - 1] + cost);
      if (curRow[j] < minInRow) minInRow = curRow[j];
    }

    if (minInRow > maxDist) return maxDist + 1;
    for (let j = 0; j <= bl; j++) prevRow[j] = curRow[j];
  }

  return prevRow[bl];
}

export function findClosestProperty(input: string): string | null {
  // Merge static built-in properties with dynamically registered custom properties
  const allProperties = [
    ...BUILTIN_KNOWN,
    ...customKnownProperties,
  ];

  let bestMatch: string | null = null;
  let minDistance = Infinity;

  // Max distance threshold (typically 2 for typos)
  const maxAllowedDistance = Math.min(3, Math.floor(input.length / 2) + 1);

  for (const candidate of allProperties) {
    // Early length check optimization
    if (Math.abs(candidate.length - input.length) > maxAllowedDistance) {
      continue;
    }

    const dist = levenshtein(input, candidate, maxAllowedDistance);
    if (dist < minDistance && dist <= maxAllowedDistance) {
      minDistance = dist;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

export function clearPropertyCache() {
  propertyCache.clear();
}

export function detectIntent(
  value: string,
  ctx: IntentContext = {},
): CorrectionResult | null {
  const lv = value.toLowerCase();
  for (let i = 0, len = SEMANTIC_INTENTS.length; i < len; i++) {
    const rule = SEMANTIC_INTENTS[i];
    if (rule.pattern.test(lv)) {
      const r = rule.handler(value, ctx);
      if (r) return r;
    }
  }
  return null;
}