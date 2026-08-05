// src/compiler/utils/suggestions.ts

export interface SuggestionMatch {
  name: string;
  distance: number;
  type: "shorthand" | "css-property" | "macro" | "animation" | "breakpoint";
}

// Known macros (from intent-engine and Chain.ts)
export const KNOWN_MACROS: string[] = Array.from(
  new Set([
    // Intent Macros
    "stickyHeader",
    "card",
    "hero",
    "container",
    "center",
    "gridList",
    "sidebar",
    "pill",
    "srOnly",
    "autoContrast",
    // Chain.ts special methods
    "flex",
    "grid",
    "inlineFlex",
    "inlineGrid",
    "flexCenter",
    "gridCenter",
    "stack",
    "cols",
    "rows",
    "bento",
    "gridTable",
    "mx",
    "my",
    "px",
    "py",
    "size",
    "gap",
    "gapX",
    "gapY",
    "inset",
    "insetX",
    "insetY",
    "borderX",
    "borderY",
    "absolute",
    "fixed",
    "sticky",
    "relative",
    "hide",
    "show",
    "unselectable",
    "scrollable",
    "safeArea",
    "circle",
    "square",
    "truncate",
    "fluidText",
    "aspect",
    "lineClamp",
    "glass",
    "glow",
    "textGradient",
    "meshGradient",
    "noise",
    "shimmer",
    "clickScale",
    "pressable",
    "focusRing",
    "skeleton",
    "fullScreen",
    "containerMacro",
    "outlineDebug",
    "parallax",
    "frostedNav",
    "fadeIn",
    "slideInUp",
    "zoomIn",
    "bounce",
    "pulse",
    "spin",
    "shake",
    "float",
    // Semantic macros
    "surface",
    "text",
    "elevation",
    "state",
    "spacing",
    // Intent API
    "intent",
    // Constraint
    "constrain",
  ]),
);

export const KNOWN_SHORTHANDS: string[] = [
  // Spacing
  "m",
  "mt",
  "mr",
  "mb",
  "ml",
  "p",
  "pt",
  "pr",
  "pb",
  "pl",
  "mx",
  "my",
  "px",
  "py",
  "inset",
  "insetX",
  "insetY",

  // Sizing
  "w",
  "h",
  "minW",
  "maxW",
  "minH",
  "maxH",
  "size",
  "aspect",

  // Display & Layout
  "d",
  "pos",
  "flex",
  "grid",
  "inlineFlex",
  "inlineGrid",
  "flexDir",
  "flexWrap",
  "justify",
  "items",
  "align",
  "content",
  "self",
  "center",
  "flexCenter",
  "gridCenter",
  "stack",
  "gridTable",
  "cols",
  "rows",
  "gap",
  "gapX",
  "gapY",
  "grow",
  "shrink",
  "basis",
  "order",

  // Colors & Backgrounds
  "bg",
  "c",
  "text",
  "op",

  // Borders
  "border",
  "borderW",
  "borderC",
  "borderS",
  "borderT",
  "borderR",
  "borderB",
  "borderL",
  "borderX",
  "borderY",
  "rounded",
  "br",
  "radius",
  "roundedTL",
  "roundedTR",
  "roundedBR",
  "roundedBL",

  // Typography
  "fontF",
  "fs",
  "fw",
  "lh",
  "ls",
  "align",

  // Effects
  "shadow",
  "truncate",
  "hide",
  "show",
  "unselectable",
  "scrollable",
  "glass",
  "glow",
  "textGradient",
  "meshGradient",
  "noise",

  // Positioning
  "absolute",
  "fixed",
  "sticky",
  "relative",

  // Utilities
  "pill",
  "container",
  "fullScreen",
  "shimmer",
  "bento",
  "pressable",
  "focusRing",
  "outlineDebug",
  "skeleton",
  "safeArea",
  "clickScale",
  "onInteracting",
  "children",
  "dark",
  "light",
  "fluidText",
];

export const COMMON_CSS_PROPERTIES: string[] = [
  "display",
  "position",
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
  "color",
  "background",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "border",
  "border-width",
  "border-style",
  "border-color",
  "border-radius",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "font-size",
  "font-weight",
  "font-family",
  "line-height",
  "letter-spacing",
  "text-align",
  "cursor",
  "opacity",
  "z-index",
  "overflow",
  "overflow-x",
  "overflow-y",
  "flex",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "align-self",
  "gap",
  "grid",
  "grid-template-columns",
  "grid-template-rows",
  "grid-column",
  "grid-row",
  "transition",
  "transform",
  "animation",
  "box-shadow",
  "text-shadow",
  "filter",
  "backdrop-filter",
  "clip-path",
  "mask",
  "pointer-events",
  "user-select",
  "resize",
  "appearance",
];

export const ANIMATION_PRESETS: string[] = [
  "fadeIn",
  "fadeOut",
  "fadeInUp",
  "fadeInDown",
  "fadeInLeft",
  "fadeInRight",
  "fadeOutUp",
  "fadeOutDown",
  "slideInUp",
  "slideInDown",
  "slideInLeft",
  "slideInRight",
  "slideOutUp",
  "slideOutDown",
  "zoomIn",
  "zoomOut",
  "zoomInUp",
  "zoomInDown",
  "bounce",
  "bounceIn",
  "bounceOut",
  "pulse",
  "pulseGlow",
  "shake",
  "shakeX",
  "shakeY",
  "spin",
  "spinReverse",
  "wiggle",
  "wobble",
  "flip",
  "flipX",
  "blink",
  "typing",
  "cursor",
  "shimmer",
  "ripple",
  "float",
  "sink",
  "swing",
  "flash",
  "textReveal",
  "textGlitch",
];

export const BREAKPOINTS: string[] = [
  "sm",
  "md",
  "lg",
  "xl",
  "2xl",
  "mobile",
  "tablet",
  "desktop",
  "mobile-sm",
  "mobile-md",
  "tablet-sm",
  "tablet-lg",
  "desktop-sm",
  "desktop-md",
  "desktop-lg",
  "portrait",
  "landscape",
  "dark",
  "light",
  "reducedMotion",
  "highContrast",
  "print",
  "hover",
  "no-hover",
  "fine",
  "coarse",
];

// O(1) matching sets
const MACRO_SET = new Set(KNOWN_MACROS);
const SHORTHAND_SET = new Set(KNOWN_SHORTHANDS);
const ANIMATION_SET = new Set(ANIMATION_PRESETS);
const BREAKPOINT_SET = new Set(BREAKPOINTS);
const CSS_PROPERTY_SET = new Set(COMMON_CSS_PROPERTIES);

// Static pre-constructed unified pools
const ALL_CANDIDATES = Array.from(
  new Set([
    ...KNOWN_MACROS,
    ...KNOWN_SHORTHANDS,
    ...COMMON_CSS_PROPERTIES,
    ...ANIMATION_PRESETS,
    ...BREAKPOINTS,
  ]),
);

const STATIC_AUTOCOMPLETE_ITEMS: SuggestionMatch[] = [
  ...KNOWN_SHORTHANDS.map((s) => ({
    name: s,
    type: "shorthand" as const,
    distance: 0,
  })),
  ...KNOWN_MACROS.map((s) => ({
    name: s,
    type: "macro" as const,
    distance: 0,
  })),
  ...COMMON_CSS_PROPERTIES.map((s) => ({
    name: s,
    type: "css-property" as const,
    distance: 0,
  })),
  ...ANIMATION_PRESETS.map((s) => ({
    name: s,
    type: "animation" as const,
    distance: 0,
  })),
  ...BREAKPOINTS.map((s) => ({
    name: s,
    type: "breakpoint" as const,
    distance: 0,
  })),
];

// Reusable scratchpad memory buffers for Levenshtein calculations
let prevRowBuffer = new Int32Array(128);
let currRowBuffer = new Int32Array(128);

function ensureBufferSize(size: number): void {
  if (prevRowBuffer.length < size) {
    const nextSize = Math.max(size, prevRowBuffer.length * 2);
    prevRowBuffer = new Int32Array(nextSize);
    currRowBuffer = new Int32Array(nextSize);
  }
}

/**
 * Zero-allocation Levenshtein distance using persistent module buffers.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const targetSize = a.length + 1;
  ensureBufferSize(targetSize);

  let prevRow = prevRowBuffer;
  let currRow = currRowBuffer;

  for (let j = 0; j <= a.length; j++) {
    prevRow[j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    currRow[0] = i;
    const charB = b[i - 1];

    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === charB ? 0 : 1;
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost,
      );
    }

    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[a.length];
}

function getTypeForCandidate(candidate: string): SuggestionMatch["type"] {
  if (MACRO_SET.has(candidate)) return "macro";
  if (SHORTHAND_SET.has(candidate)) return "shorthand";
  if (ANIMATION_SET.has(candidate)) return "animation";
  if (BREAKPOINT_SET.has(candidate)) return "breakpoint";
  if (CSS_PROPERTY_SET.has(candidate)) return "css-property";
  return "macro";
}

function findBestMatches(
  query: string,
  candidates: readonly string[],
  maxResults: number = 3,
  maxDistance: number = 3,
): SuggestionMatch[] {
  const matches: SuggestionMatch[] = [];
  const lowerQuery = query.toLowerCase();

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const distance = levenshteinDistance(lowerQuery, candidate.toLowerCase());
    if (distance <= maxDistance) {
      matches.push({
        name: candidate,
        distance,
        type: getTypeForCandidate(candidate),
      });
    }
  }

  matches.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.name.localeCompare(b.name);
  });

  return matches.slice(0, maxResults);
}

export function getSuggestion(
  prop: string,
  validProperties: string[] = [],
  type: "shorthand" | "css-property" | "all" = "all",
): SuggestionMatch | null {
  let candidates: readonly string[];

  if (type === "shorthand") {
    candidates = KNOWN_SHORTHANDS;
  } else if (type === "css-property") {
    candidates =
      validProperties.length > 0
        ? Array.from(new Set([...COMMON_CSS_PROPERTIES, ...validProperties]))
        : COMMON_CSS_PROPERTIES;
  } else {
    candidates =
      validProperties.length > 0
        ? Array.from(new Set([...ALL_CANDIDATES, ...validProperties]))
        : ALL_CANDIDATES;
  }

  const matches = findBestMatches(prop, candidates, 1, 3);
  return matches.length > 0 ? matches[0] : null;
}

export function getSuggestions(
  prop: string,
  validProperties: string[] = [],
  maxResults: number = 3,
): SuggestionMatch[] {
  const candidates =
    validProperties.length > 0
      ? Array.from(new Set([...ALL_CANDIDATES, ...validProperties]))
      : ALL_CANDIDATES;

  return findBestMatches(prop, candidates, maxResults, 4);
}

export function getPropertySuggestion(
  prop: string,
  context?: "spacing" | "color" | "typography" | "layout" | "animation",
): string | null {
  const contextProperties: Record<string, string[]> = {
    spacing: [
      "margin",
      "padding",
      "gap",
      "width",
      "height",
      "top",
      "right",
      "bottom",
      "left",
      "inset",
      "position",
      "translate",
      "scale",
      "rotate",
    ],
    color: [
      "color",
      "background-color",
      "border-color",
      "outline-color",
      "fill",
      "stroke",
      "box-shadow",
      "text-shadow",
    ],
    typography: [
      "font-family",
      "font-size",
      "font-weight",
      "line-height",
      "letter-spacing",
      "text-align",
      "text-decoration",
      "text-transform",
      "word-spacing",
    ],
    layout: [
      "display",
      "position",
      "flex",
      "grid",
      "justify-content",
      "align-items",
      "flex-direction",
      "flex-wrap",
      "order",
      "z-index",
      "overflow",
    ],
    animation: [
      "animation",
      "transition",
      "transform",
      "opacity",
      "filter",
      "backdrop-filter",
      "transform-origin",
      "transition-property",
      "transition-duration",
    ],
  };

  const candidates =
    context && contextProperties[context]
      ? contextProperties[context]
      : COMMON_CSS_PROPERTIES;

  const matches = findBestMatches(prop, candidates, 1, 2);
  return matches.length > 0 ? matches[0].name : null;
}

export function getShorthandSuggestion(
  shorthand: string,
): { suggestion: string; explanation: string } | null {
  const shorthandMap: Record<
    string,
    { property: string; description: string }
  > = {
    m: { property: "margin", description: "Sets margin on all sides" },
    mt: { property: "margin-top", description: "Sets top margin" },
    mr: { property: "margin-right", description: "Sets right margin" },
    mb: { property: "margin-bottom", description: "Sets bottom margin" },
    ml: { property: "margin-left", description: "Sets left margin" },
    p: { property: "padding", description: "Sets padding on all sides" },
    pt: { property: "padding-top", description: "Sets top padding" },
    pr: { property: "padding-right", description: "Sets right padding" },
    pb: { property: "padding-bottom", description: "Sets bottom padding" },
    pl: { property: "padding-left", description: "Sets left padding" },
    mx: {
      property: "margin-left/right",
      description: "Sets horizontal margins",
    },
    my: { property: "margin-top/bottom", description: "Sets vertical margins" },
    px: {
      property: "padding-left/right",
      description: "Sets horizontal padding",
    },
    py: {
      property: "padding-top/bottom",
      description: "Sets vertical padding",
    },
    d: { property: "display", description: "Sets display property" },
    pos: { property: "position", description: "Sets position property" },
    w: { property: "width", description: "Sets width" },
    h: { property: "height", description: "Sets height" },
    bg: { property: "background", description: "Sets background color/image" },
    c: { property: "color", description: "Sets text color" },
    fs: { property: "font-size", description: "Sets font size" },
    fw: { property: "font-weight", description: "Sets font weight" },
    flex: {
      property: "display: flex",
      description: "Creates a flex container",
    },
    grid: {
      property: "display: grid",
      description: "Creates a grid container",
    },
  };

  const match = shorthandMap[shorthand];
  if (match) {
    return {
      suggestion: match.property,
      explanation: match.description,
    };
  }

  const matches = findBestMatches(shorthand, Object.keys(shorthandMap), 1, 2);
  if (matches.length > 0) {
    const best = matches[0];
    const matchInfo = shorthandMap[best.name];
    if (matchInfo) {
      return {
        suggestion: `${best.name} → ${matchInfo.property}`,
        explanation: matchInfo.description,
      };
    }
  }

  return null;
}

export function getValueSuggestion(
  property: string,
  value: string,
): { suggested: string; confidence: number } | null {
  const corrections: Record<string, Record<string, string>> = {
    display: {
      flexbox: "flex",
      "inline-flexbox": "inline-flex",
      gridbox: "grid",
      "block-level": "block",
      "inline-level": "inline",
    },
    position: {
      static: "static",
      relative: "relative",
      absolute: "absolute",
      fixed: "fixed",
      sticky: "sticky",
    },
    "text-align": {
      center: "center",
      left: "left",
      right: "right",
      justify: "justify",
    },
  };

  const propertyCorrections = corrections[property];
  if (propertyCorrections) {
    const lowerValue = value.toLowerCase();
    for (const [wrong, correct] of Object.entries(propertyCorrections)) {
      if (lowerValue === wrong) {
        return { suggested: correct, confidence: 0.95 };
      }
      if (lowerValue.includes(wrong)) {
        return { suggested: correct, confidence: 0.7 };
      }
    }
  }

  return null;
}

export function getAutocompleteSuggestions(
  prefix: string = "",
  limit: number = 10,
): SuggestionMatch[] {
  if (!prefix) {
    return STATIC_AUTOCOMPLETE_ITEMS.slice(0, limit);
  }

  const lowerPrefix = prefix.toLowerCase();
  const matches = STATIC_AUTOCOMPLETE_ITEMS.filter((s) =>
    s.name.toLowerCase().startsWith(lowerPrefix),
  ).slice(0, limit);

  if (matches.length < limit) {
    const fuzzyMatches = findBestMatches(
      prefix,
      ALL_CANDIDATES,
      limit - matches.length,
    );
    for (let i = 0; i < fuzzyMatches.length; i++) {
      const match = fuzzyMatches[i];
      if (!matches.some((m) => m.name === match.name)) {
        matches.push(match);
      }
    }
  }

  return matches;
}

export function formatSuggestion(suggestion: SuggestionMatch): string {
  const typeColors: Record<string, string> = {
    shorthand: "🟢",
    "css-property": "🔵",
    macro: "🟣",
    animation: "🎬",
    breakpoint: "📱",
  };

  const icon = typeColors[suggestion.type] || "⚪";
  return `${icon} ${suggestion.name} (${suggestion.type}, distance: ${suggestion.distance})`;
}

export function getDetailedSuggestion(
  prop: string,
  validProperties: string[] = [],
): {
  suggestion: string | null;
  alternatives: SuggestionMatch[];
  type: string;
  confidence: number;
} | null {
  const match = getSuggestion(prop, validProperties);
  if (!match) return null;

  const confidence =
    1 - match.distance / Math.max(prop.length, match.name.length);

  return {
    suggestion: match.name,
    alternatives: getSuggestions(prop, validProperties, 3),
    type: match.type,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
}

export default {
  KNOWN_MACROS,
  getSuggestion,
  getSuggestions,
  getPropertySuggestion,
  getShorthandSuggestion,
  getValueSuggestion,
  getAutocompleteSuggestions,
  formatSuggestion,
  getDetailedSuggestion,
  KNOWN_SHORTHANDS,
  COMMON_CSS_PROPERTIES,
  ANIMATION_PRESETS,
  BREAKPOINTS,
};