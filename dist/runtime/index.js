// src/compiler/suggestions.ts
var KNOWN_SHORTHANDS = [
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
  "fluidText"
];
var COMMON_CSS_PROPERTIES = [
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
  "appearance"
];
var ANIMATION_PRESETS = [
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
  "textGlitch"
];
var BREAKPOINTS = [
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
  "coarse"
];
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        // deletion
        matrix[i][j - 1] + 1,
        // insertion
        matrix[i - 1][j - 1] + cost
        // substitution
      );
    }
  }
  return matrix[b.length][a.length];
}
function findBestMatches(query, candidates, maxResults = 3, maxDistance = 3) {
  const matches = [];
  for (const candidate of candidates) {
    const distance = levenshteinDistance(query.toLowerCase(), candidate.toLowerCase());
    if (distance <= maxDistance) {
      matches.push({
        name: candidate,
        distance,
        type: getTypeForCandidate(candidate)
      });
    }
  }
  matches.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.name.localeCompare(b.name);
  });
  return matches.slice(0, maxResults);
}
function getTypeForCandidate(candidate) {
  if (KNOWN_SHORTHANDS.includes(candidate)) return "shorthand";
  if (COMMON_CSS_PROPERTIES.includes(candidate)) return "css-property";
  if (ANIMATION_PRESETS.includes(candidate)) return "animation";
  if (BREAKPOINTS.includes(candidate)) return "breakpoint";
  return "macro";
}
function getSuggestion(prop, validProperties = [], type = "all") {
  let candidates = [];
  if (type === "shorthand") {
    candidates = KNOWN_SHORTHANDS;
  } else if (type === "css-property") {
    candidates = [...COMMON_CSS_PROPERTIES, ...validProperties];
  } else {
    candidates = [
      ...KNOWN_SHORTHANDS,
      ...COMMON_CSS_PROPERTIES,
      ...validProperties,
      ...ANIMATION_PRESETS,
      ...BREAKPOINTS
    ];
  }
  candidates = [...new Set(candidates)];
  const matches = findBestMatches(prop, candidates, 1, 3);
  if (matches.length > 0) {
    return matches[0];
  }
  return null;
}

// src/compiler/tokens.ts
var defaultTokens = {
  colors: {
    primary: "#667eea",
    secondary: "#764ba2",
    success: "#48bb78",
    danger: "#f56565",
    warning: "#ed8936",
    info: "#4299e1",
    light: "#f7fafc",
    dark: "#1a202c",
    white: "#ffffff",
    black: "#000000",
    gray: {
      50: "#f9fafb",
      100: "#f7fafc",
      200: "#edf2f7",
      300: "#e2e8f0",
      400: "#cbd5e0",
      500: "#a0aec0",
      600: "#718096",
      700: "#4a5568",
      800: "#2d3748",
      900: "#1a202c"
    },
    blue: {
      50: "#eff6ff",
      100: "#dbeafe",
      200: "#bfdbfe",
      300: "#93c5fd",
      400: "#60a5fa",
      500: "#3b82f6",
      600: "#2563eb",
      700: "#1d4ed8",
      800: "#1e40af",
      900: "#1e3a8a"
    },
    green: {
      50: "#f0fdf4",
      100: "#dcfce7",
      200: "#bbf7d0",
      300: "#86efac",
      400: "#4ade80",
      500: "#22c55e",
      600: "#16a34a",
      700: "#15803d",
      800: "#166534",
      900: "#14532d"
    },
    red: {
      50: "#fef2f2",
      100: "#fee2e2",
      200: "#fecaca",
      300: "#fca5a5",
      400: "#f87171",
      500: "#ef4444",
      600: "#dc2626",
      700: "#b91c1c",
      800: "#991b1b",
      900: "#7f1d1d"
    },
    yellow: {
      50: "#fefce8",
      100: "#fef9c3",
      200: "#fef08a",
      300: "#fde047",
      400: "#facc15",
      500: "#eab308",
      600: "#ca8a04",
      700: "#a16207",
      800: "#854d0e",
      900: "#713f12"
    }
  },
  spacing: {
    0: "0",
    0.5: "0.125rem",
    1: "0.25rem",
    1.5: "0.375rem",
    2: "0.5rem",
    2.5: "0.625rem",
    3: "0.75rem",
    3.5: "0.875rem",
    4: "1rem",
    5: "1.25rem",
    6: "1.5rem",
    7: "1.75rem",
    8: "2rem",
    9: "2.25rem",
    10: "2.5rem",
    11: "2.75rem",
    12: "3rem",
    14: "3.5rem",
    16: "4rem",
    20: "5rem",
    24: "6rem",
    28: "7rem",
    32: "8rem",
    36: "9rem",
    40: "10rem",
    44: "11rem",
    48: "12rem",
    52: "13rem",
    56: "14rem",
    60: "15rem",
    64: "16rem",
    72: "18rem",
    80: "20rem",
    96: "24rem",
    xs: "0.5rem",
    sm: "1rem",
    md: "1.5rem",
    lg: "2rem",
    xl: "3rem",
    "2xl": "4rem",
    "3xl": "6rem",
    "4xl": "8rem",
    "5xl": "10rem"
  },
  typography: {
    fontFamily: {
      sans: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      serif: 'Georgia, Cambria, "Times New Roman", Times, serif',
      mono: 'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      system: "system-ui, -apple-system, sans-serif"
    },
    fontSize: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      "2xl": "1.5rem",
      "3xl": "1.875rem",
      "4xl": "2.25rem",
      "5xl": "3rem",
      "6xl": "3.75rem",
      "7xl": "4.5rem",
      "8xl": "6rem",
      "9xl": "8rem"
    },
    fontWeight: {
      hairline: "100",
      thin: "200",
      light: "300",
      normal: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
      extrabold: "800",
      black: "900"
    },
    lineHeight: {
      none: "1",
      tight: "1.25",
      snug: "1.375",
      normal: "1.5",
      relaxed: "1.625",
      loose: "2",
      3: ".75rem",
      4: "1rem",
      5: "1.25rem",
      6: "1.5rem",
      7: "1.75rem",
      8: "2rem",
      9: "2.25rem",
      10: "2.5rem"
    },
    letterSpacing: {
      tighter: "-0.05em",
      tight: "-0.025em",
      normal: "0",
      wide: "0.025em",
      wider: "0.05em",
      widest: "0.1em"
    }
  },
  breakpoints: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1536px",
    "3xl": "1920px",
    mobile: "640px",
    tablet: "768px",
    desktop: "1024px",
    wide: "1280px"
  },
  zIndex: {
    0: "0",
    10: "10",
    20: "20",
    30: "30",
    40: "40",
    50: "50",
    auto: "auto",
    dropdown: "1000",
    sticky: "1020",
    fixed: "1030",
    modal: "1040",
    popover: "1050",
    tooltip: "1060",
    toast: "1070",
    overlay: "1080"
  },
  shadows: {
    xs: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
    base: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
    md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
    xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
    "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)",
    none: "none",
    "glow-sm": "0 0 10px rgba(102, 126, 234, 0.5)",
    "glow-md": "0 0 20px rgba(102, 126, 234, 0.5)",
    "glow-lg": "0 0 30px rgba(102, 126, 234, 0.5)"
  },
  borderRadius: {
    none: "0",
    sm: "0.125rem",
    base: "0.25rem",
    md: "0.375rem",
    lg: "0.5rem",
    xl: "0.75rem",
    "2xl": "1rem",
    "3xl": "1.5rem",
    "4xl": "2rem",
    full: "9999px"
  },
  // Additional animation presets
  animations: {
    fade: {
      "0%": { opacity: 0 },
      "100%": { opacity: 1 }
    },
    slideUp: {
      "0%": { transform: "translateY(20px)", opacity: 0 },
      "100%": { transform: "translateY(0)", opacity: 1 }
    },
    slideDown: {
      "0%": { transform: "translateY(-20px)", opacity: 0 },
      "100%": { transform: "translateY(0)", opacity: 1 }
    },
    slideLeft: {
      "0%": { transform: "translateX(20px)", opacity: 0 },
      "100%": { transform: "translateX(0)", opacity: 1 }
    },
    slideRight: {
      "0%": { transform: "translateX(-20px)", opacity: 0 },
      "100%": { transform: "translateX(0)", opacity: 1 }
    },
    scale: {
      "0%": { transform: "scale(0.95)", opacity: 0 },
      "100%": { transform: "scale(1)", opacity: 1 }
    },
    bounce: {
      "0%, 100%": { transform: "translateY(0)" },
      "50%": { transform: "translateY(-25%)" }
    },
    pulse: {
      "0%, 100%": { opacity: 1 },
      "50%": { opacity: 0.5 }
    },
    spin: {
      "0%": { transform: "rotate(0deg)" },
      "100%": { transform: "rotate(360deg)" }
    },
    shimmer: {
      "0%": { backgroundPosition: "-200% 0" },
      "100%": { backgroundPosition: "200% 0" }
    }
  }
};
var DesignTokens = class _DesignTokens {
  customTokens;
  customFlattened;
  defaultFlattened;
  tokenCache = /* @__PURE__ */ new Map();
  constructor(customTokens = {}) {
    this.customTokens = this.deepClone(customTokens);
    this.customFlattened = this.flattenTokens(this.customTokens);
    this.defaultFlattened = this.flattenTokens(defaultTokens);
    Object.freeze(this.customTokens);
    Object.freeze(this.customFlattened);
    Object.freeze(this.defaultFlattened);
  }
  // Deep clone objects
  deepClone(obj) {
    if (obj === null || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) return obj.map((item) => this.deepClone(item));
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }
    return cloned;
  }
  // Deep freeze to prevent accidental modifications
  deepFreeze(obj) {
    Object.keys(obj).forEach((key) => {
      const value = obj[key];
      if (typeof value === "object" && value !== null && !Object.isFrozen(value)) {
        this.deepFreeze(value);
      }
    });
    return Object.freeze(obj);
  }
  // Flatten nested tokens for easy access
  flattenTokens(obj, prefix = "") {
    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      const prefixed = prefix ? `${prefix}.${key}` : key;
      if (value && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result, this.flattenTokens(value, prefixed));
      } else {
        result[prefixed] = String(value);
      }
    }
    return result;
  }
  // Get token value by path (e.g., 'colors.primary')
  // Checks custom tokens first, then falls back to default tokens
  get(path, defaultValue = "") {
    if (this.tokenCache.has(path)) {
      return this.tokenCache.get(path);
    }
    let value;
    if (path in this.customFlattened) {
      value = this.customFlattened[path];
    }
    if (value === void 0 && path in this.defaultFlattened) {
      value = this.defaultFlattened[path];
    }
    if (value && value.startsWith("$")) {
      const refPath = value.substring(1);
      value = this.get(refPath, defaultValue);
    }
    const result = value !== void 0 ? value : defaultValue;
    this.tokenCache.set(path, result);
    return result;
  }
  // Get token with type safety
  getColor(path, defaultValue = "#000000") {
    return this.get(`colors.${path}`, defaultValue);
  }
  getSpacing(path, defaultValue = "0") {
    return this.get(`spacing.${path}`, defaultValue);
  }
  getFontSize(path, defaultValue = "1rem") {
    return this.get(`typography.fontSize.${path}`, defaultValue);
  }
  getFontWeight(path, defaultValue = "400") {
    return this.get(`typography.fontWeight.${path}`, defaultValue);
  }
  getLineHeight(path, defaultValue = "1.5") {
    return this.get(`typography.lineHeight.${path}`, defaultValue);
  }
  getBreakpoint(path, defaultValue = "768px") {
    return this.get(`breakpoints.${path}`, defaultValue);
  }
  getZIndex(path, defaultValue = "0") {
    return this.get(`zIndex.${path}`, defaultValue);
  }
  getShadow(path, defaultValue = "none") {
    return this.get(`shadows.${path}`, defaultValue);
  }
  getBorderRadius(path, defaultValue = "0") {
    return this.get(`borderRadius.${path}`, defaultValue);
  }
  // Get all custom tokens (as flattened object)
  getCustomTokens() {
    return { ...this.customFlattened };
  }
  // Get all default tokens (as flattened object)
  getDefaultTokens() {
    return { ...this.defaultFlattened };
  }
  // Check if a token exists (in either custom or default)
  has(path) {
    return path in this.customFlattened || path in this.defaultFlattened;
  }
  // Generate CSS variables from tokens (combines both custom and default)
  toCSSVariables(prefix = "chain") {
    let css = ":root {\n";
    const allTokens = { ...this.defaultFlattened, ...this.customFlattened };
    for (const [key, value] of Object.entries(allTokens)) {
      const varName = `--${prefix}-${key.replace(/\./g, "-")}`;
      css += `  ${varName}: ${value};
`;
    }
    css += "}\n";
    return css;
  }
  // Generate media queries from breakpoints
  toMediaQueries() {
    const queries = {};
    for (const [name, value] of Object.entries(this.customFlattened)) {
      if (name.startsWith("breakpoints.")) {
        const breakpointName = name.replace("breakpoints.", "");
        queries[breakpointName] = value;
      }
    }
    return queries;
  }
  // Create a theme variant (overrides on top of defaults + custom)
  createTheme(name, overrides) {
    const newCustomTokens = this.deepClone(this.customTokens);
    for (const [path, value] of Object.entries(overrides)) {
      const parts = path.split(".");
      let current = newCustomTokens;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
    }
    return new _DesignTokens(newCustomTokens);
  }
  // Merge with another token set
  merge(tokens2) {
    const merged = this.deepClone(this.customTokens);
    const deepMerge = (target, source) => {
      for (const key in source) {
        if (source.hasOwnProperty(key)) {
          if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key])) {
            if (!target[key]) target[key] = {};
            deepMerge(target[key], source[key]);
          } else {
            target[key] = source[key];
          }
        }
      }
    };
    deepMerge(merged, tokens2);
    return new _DesignTokens(merged);
  }
  // Clear cache
  clearCache() {
    this.tokenCache.clear();
  }
  // Get token path suggestions for autocomplete
  getSuggestions(partialPath) {
    const allTokens = { ...this.defaultFlattened, ...this.customFlattened };
    const suggestions = [];
    for (const key of Object.keys(allTokens)) {
      if (key.includes(partialPath)) {
        suggestions.push(key);
      }
    }
    return suggestions.sort();
  }
};
var tokens = new DesignTokens(defaultTokens);

// src/compiler/token-resolver.ts
var currentTokenContext = null;
function resolveToken(value, useTokens = true, tokenContext) {
  if (!useTokens || typeof value !== "string") return value;
  const functionMatch = value.match(/^(?:token|\$token)\s*\(\s*['"]([^'"]+)['"]\s*\)$/);
  if (functionMatch) {
    const tokenPath = functionMatch[1];
    const resolved = resolveTokenPath(tokenPath, tokenContext);
    return resolved !== void 0 ? resolved : value;
  }
  if (value.includes("$")) {
    return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match, path) => {
      const resolved = resolveTokenPath(path, tokenContext);
      if (resolved !== void 0 && resolved !== null) {
        return String(resolved);
      }
      if (true) {
        console.warn(`[ChainCSS] Token not found: ${path}`);
      }
      return match;
    });
  }
  return value;
}
function resolveTokenPath(path, tokenContext) {
  let resolved = null;
  if (tokenContext && typeof tokenContext.get === "function") {
    resolved = tokenContext.get(path);
  }
  if ((resolved === void 0 || resolved === null) && currentTokenContext) {
    resolved = currentTokenContext.get(path);
  }
  if (resolved === void 0 || resolved === null) {
    if (tokens && typeof tokens.get === "function") {
      resolved = tokens.get(path);
    }
  }
  return resolved;
}

// src/compiler/breakpoints.ts
var DEFAULT_BREAKPOINTS = {
  // Mobile-first breakpoints
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
  // Desktop-first breakpoints (alternative naming)
  mobile: "(max-width: 767px)",
  tablet: "(min-width: 768px) and (max-width: 1023px)",
  desktop: "(min-width: 1024px)",
  // Specific device breakpoints
  "mobile-sm": "(max-width: 375px)",
  "mobile-md": "(min-width: 376px) and (max-width: 768px)",
  "tablet-sm": "(min-width: 769px) and (max-width: 834px)",
  "tablet-lg": "(min-width: 835px) and (max-width: 1024px)",
  "desktop-sm": "(min-width: 1025px) and (max-width: 1280px)",
  "desktop-md": "(min-width: 1281px) and (max-width: 1440px)",
  "desktop-lg": "(min-width: 1441px)",
  // Orientation breakpoints
  portrait: "(orientation: portrait)",
  landscape: "(orientation: landscape)",
  // Feature breakpoints
  dark: "(prefers-color-scheme: dark)",
  light: "(prefers-color-scheme: light)",
  reducedMotion: "(prefers-reduced-motion: reduce)",
  highContrast: "(prefers-contrast: high)",
  // Print
  print: "print",
  // Hover capabilities
  hover: "(hover: hover)",
  "no-hover": "(hover: none)",
  // Pointer capabilities
  fine: "(pointer: fine)",
  coarse: "(pointer: coarse)"
};
var currentBreakpoints = { ...DEFAULT_BREAKPOINTS };

// src/compiler/animations.ts
var animationPresets = {
  // Fades
  fadeIn: {
    "0%": { opacity: 0 },
    "100%": { opacity: 1 }
  },
  fadeOut: {
    "0%": { opacity: 1 },
    "100%": { opacity: 0 }
  },
  fadeInUp: {
    "0%": { opacity: 0, transform: "translateY(20px)" },
    "100%": { opacity: 1, transform: "translateY(0)" }
  },
  fadeInDown: {
    "0%": { opacity: 0, transform: "translateY(-20px)" },
    "100%": { opacity: 1, transform: "translateY(0)" }
  },
  fadeInLeft: {
    "0%": { opacity: 0, transform: "translateX(-20px)" },
    "100%": { opacity: 1, transform: "translateX(0)" }
  },
  fadeInRight: {
    "0%": { opacity: 0, transform: "translateX(20px)" },
    "100%": { opacity: 1, transform: "translateX(0)" }
  },
  fadeOutUp: {
    "0%": { opacity: 1, transform: "translateY(0)" },
    "100%": { opacity: 0, transform: "translateY(-20px)" }
  },
  fadeOutDown: {
    "0%": { opacity: 1, transform: "translateY(0)" },
    "100%": { opacity: 0, transform: "translateY(20px)" }
  },
  // Slides
  slideInUp: {
    "0%": { transform: "translateY(100%)" },
    "100%": { transform: "translateY(0)" }
  },
  slideInDown: {
    "0%": { transform: "translateY(-100%)" },
    "100%": { transform: "translateY(0)" }
  },
  slideInLeft: {
    "0%": { transform: "translateX(-100%)" },
    "100%": { transform: "translateX(0)" }
  },
  slideInRight: {
    "0%": { transform: "translateX(100%)" },
    "100%": { transform: "translateX(0)" }
  },
  slideOutUp: {
    "0%": { transform: "translateY(0)" },
    "100%": { transform: "translateY(-100%)" }
  },
  slideOutDown: {
    "0%": { transform: "translateY(0)" },
    "100%": { transform: "translateY(100%)" }
  },
  // Zooms
  zoomIn: {
    "0%": { opacity: 0, transform: "scale(0.8)" },
    "100%": { opacity: 1, transform: "scale(1)" }
  },
  zoomOut: {
    "0%": { opacity: 1, transform: "scale(1)" },
    "100%": { opacity: 0, transform: "scale(0.8)" }
  },
  zoomInUp: {
    "0%": { opacity: 0, transform: "scale(0.8) translateY(20px)" },
    "100%": { opacity: 1, transform: "scale(1) translateY(0)" }
  },
  zoomInDown: {
    "0%": { opacity: 0, transform: "scale(0.8) translateY(-20px)" },
    "100%": { opacity: 1, transform: "scale(1) translateY(0)" }
  },
  // Bounces
  bounce: {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(-20px)" }
  },
  bounceIn: {
    "0%": { opacity: 0, transform: "scale(0.8)" },
    "50%": { transform: "scale(1.05)" },
    "100%": { opacity: 1, transform: "scale(1)" }
  },
  bounceOut: {
    "0%": { transform: "scale(1)" },
    "50%": { transform: "scale(0.95)" },
    "100%": { opacity: 0, transform: "scale(0.8)" }
  },
  // Pulses
  pulse: {
    "0%, 100%": { transform: "scale(1)" },
    "50%": { transform: "scale(1.05)" }
  },
  pulseGlow: {
    "0%, 100%": { opacity: 1, filter: "brightness(1)" },
    "50%": { opacity: 0.8, filter: "brightness(1.2)" }
  },
  // Shakes
  shake: {
    "0%, 100%": { transform: "translateX(0)" },
    "25%": { transform: "translateX(-5px)" },
    "75%": { transform: "translateX(5px)" }
  },
  shakeX: {
    "0%, 100%": { transform: "translateX(0)" },
    "25%, 75%": { transform: "translateX(-10px)" },
    "50%": { transform: "translateX(10px)" }
  },
  shakeY: {
    "0%, 100%": { transform: "translateY(0)" },
    "25%, 75%": { transform: "translateY(-10px)" },
    "50%": { transform: "translateY(10px)" }
  },
  // Rotations
  spin: {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(360deg)" }
  },
  spinReverse: {
    "0%": { transform: "rotate(0deg)" },
    "100%": { transform: "rotate(-360deg)" }
  },
  wiggle: {
    "0%, 100%": { transform: "rotate(-3deg)" },
    "50%": { transform: "rotate(3deg)" }
  },
  wobble: {
    "0%": { transform: "translateX(0%)" },
    "15%": { transform: "translateX(-25%) rotate(-5deg)" },
    "30%": { transform: "translateX(20%) rotate(3deg)" },
    "45%": { transform: "translateX(-15%) rotate(-3deg)" },
    "60%": { transform: "translateX(10%) rotate(2deg)" },
    "75%": { transform: "translateX(-5%) rotate(-1deg)" },
    "100%": { transform: "translateX(0%)" }
  },
  // Flips
  flip: {
    "0%": { transform: "perspective(400px) rotateY(0)" },
    "100%": { transform: "perspective(400px) rotateY(180deg)" }
  },
  flipX: {
    "0%": { transform: "perspective(400px) rotateX(0)" },
    "100%": { transform: "perspective(400px) rotateX(180deg)" }
  },
  // Special effects
  blink: {
    "0%, 100%": { opacity: 1 },
    "50%": { opacity: 0 }
  },
  typing: {
    "0%": { width: "0" },
    "100%": { width: "100%" }
  },
  cursor: {
    "0%, 100%": { borderColor: "transparent" },
    "50%": { borderColor: "currentColor" }
  },
  shimmer: {
    "0%": { backgroundPosition: "-200% 0" },
    "100%": { backgroundPosition: "200% 0" }
  },
  ripple: {
    "0%": { transform: "scale(0)", opacity: 0.5 },
    "100%": { transform: "scale(4)", opacity: 0 }
  },
  float: {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(-10px)" }
  },
  sink: {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(10px)" }
  },
  swing: {
    "0%, 100%": { transform: "rotate(0deg)" },
    "25%": { transform: "rotate(15deg)" },
    "75%": { transform: "rotate(-15deg)" }
  },
  flash: {
    "0%, 100%": { opacity: 1 },
    "25%, 75%": { opacity: 0.5 },
    "50%": { opacity: 0 }
  },
  // Text animations
  textReveal: {
    "0%": { clipPath: "inset(0 100% 0 0)" },
    "100%": { clipPath: "inset(0 0 0 0)" }
  },
  textGlitch: {
    "0%, 100%": { transform: "translate(0, 0)" },
    "20%": { transform: "translate(-2px, 1px)" },
    "40%": { transform: "translate(2px, -1px)" },
    "60%": { transform: "translate(-1px, 2px)" },
    "80%": { transform: "translate(1px, -2px)" }
  }
};
var DEFAULT_ANIMATION_CONFIG = {
  name: "",
  // Add this missing property
  duration: "0.3s",
  delay: "0s",
  timing: "ease",
  iteration: 1,
  direction: "normal",
  fillMode: "both",
  playState: "running"
};
function createAnimation(animationName, config = {}) {
  const {
    duration = DEFAULT_ANIMATION_CONFIG.duration,
    delay = DEFAULT_ANIMATION_CONFIG.delay,
    timing = DEFAULT_ANIMATION_CONFIG.timing,
    iteration = DEFAULT_ANIMATION_CONFIG.iteration,
    direction = DEFAULT_ANIMATION_CONFIG.direction,
    fillMode = DEFAULT_ANIMATION_CONFIG.fillMode,
    playState = DEFAULT_ANIMATION_CONFIG.playState
  } = config;
  const animationValue = `${animationName} ${duration} ${timing} ${delay} ${iteration} ${direction} ${playState}`;
  return {
    animation: animationValue.trim(),
    animationFillMode: fillMode,
    animationName,
    animationDuration: duration,
    animationDelay: delay,
    animationTimingFunction: timing,
    animationIterationCount: iteration,
    animationDirection: direction,
    animationPlayState: playState
  };
}

// src/compiler/helpers.ts
function normalizeValue(value) {
  if (value === null || value === void 0) return "0";
  if (typeof value === "number") return `${value}px`;
  return String(value);
}
function performCalculation(a, b, operation, options = {}) {
  const valA = normalizeValue(a);
  const valB = normalizeValue(b);
  let result;
  switch (operation) {
    case "add":
      result = `calc(${valA} + ${valB})`;
      break;
    case "subtract":
      result = `calc(${valA} - ${valB})`;
      break;
    case "multiply":
      result = `calc(${valA} * ${valB})`;
      break;
    case "divide":
      result = `calc(${valA} / ${valB})`;
      break;
    default:
      result = `calc(${valA} ${operation} ${valB})`;
  }
  if (options.simplify) {
    result = simplifyCalc(result);
  }
  return result;
}
function simplifyCalc(calcExpr) {
  if (calcExpr.startsWith("calc(") && calcExpr.endsWith(")")) {
    const inner = calcExpr.slice(5, -1);
    if (!inner.includes("+") && !inner.includes("-") && !inner.includes("*") && !inner.includes("/")) {
      return inner.trim();
    }
  }
  return calcExpr;
}
function createCalc(expr, options = {}) {
  let result = `calc(${expr})`;
  if (options.simplify) {
    result = simplifyCalc(result);
  }
  return result;
}
var helpers = {
  // Basic calc
  calc: (expr, options) => createCalc(expr, options),
  // Arithmetic operations
  add: (a, b, options) => performCalculation(a, b, "add", options),
  subtract: (a, b, options) => performCalculation(a, b, "subtract", options),
  sub: (a, b, options) => performCalculation(a, b, "subtract", options),
  multiply: (a, b, options) => performCalculation(a, b, "multiply", options),
  mul: (a, b, options) => performCalculation(a, b, "multiply", options),
  divide: (a, b, options) => performCalculation(a, b, "divide", options),
  div: (a, b, options) => performCalculation(a, b, "divide", options),
  // Complex operations
  sum: (...values) => {
    const expr = values.map((v) => normalizeValue(v)).join(" + ");
    return createCalc(expr);
  },
  difference: (a, ...rest) => {
    const expr = [a, ...rest].map((v) => normalizeValue(v)).join(" - ");
    return createCalc(expr);
  },
  product: (...values) => {
    const expr = values.map((v) => normalizeValue(v)).join(" * ");
    return createCalc(expr);
  },
  quotient: (a, ...rest) => {
    const expr = [a, ...rest].map((v) => normalizeValue(v)).join(" / ");
    return createCalc(expr);
  },
  // Unit helpers with conversion
  mpx: (value) => {
    if (typeof value === "number") return `${value}px`;
    if (/^\d+(?:\.\d+)?(?:px|rem|em|%|vw|vh)$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}px`;
    return value;
  },
  rem: (value, base = 16) => {
    if (typeof value === "number") return `${value}rem`;
    if (/^\d+(?:\.\d+)?rem$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?px$/.test(value)) {
      const px = parseFloat(value);
      return `${px / base}rem`;
    }
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}rem`;
    return value;
  },
  em: (value, context = 16) => {
    if (typeof value === "number") return `${value}em`;
    if (/^\d+(?:\.\d+)?em$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?px$/.test(value)) {
      const px = parseFloat(value);
      return `${px / context}em`;
    }
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}em`;
    return value;
  },
  percent: (value) => {
    if (typeof value === "number") return `${value}%`;
    if (/^\d+(?:\.\d+)?%$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}%`;
    return value;
  },
  vw: (value) => {
    if (typeof value === "number") return `${value}vw`;
    if (/^\d+(?:\.\d+)?vw$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}vw`;
    return value;
  },
  vh: (value) => {
    if (typeof value === "number") return `${value}vh`;
    if (/^\d+(?:\.\d+)?vh$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}vh`;
    return value;
  },
  vmin: (value) => {
    if (typeof value === "number") return `${value}vmin`;
    if (/^\d+(?:\.\d+)?vmin$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}vmin`;
    return value;
  },
  vmax: (value) => {
    if (typeof value === "number") return `${value}vmax`;
    if (/^\d+(?:\.\d+)?vmax$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}vmax`;
    return value;
  },
  ch: (value) => {
    if (typeof value === "number") return `${value}ch`;
    if (/^\d+(?:\.\d+)?ch$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}ch`;
    return value;
  },
  ex: (value) => {
    if (typeof value === "number") return `${value}ex`;
    if (/^\d+(?:\.\d+)?ex$/.test(value)) return value;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}ex`;
    return value;
  },
  // Convert between units
  convert: (value, fromUnit, toUnit, context = 16) => {
    let numericValue;
    if (typeof value === "number") {
      numericValue = value;
    } else {
      numericValue = parseFloat(value);
    }
    let inPx;
    switch (fromUnit) {
      case "px":
        inPx = numericValue;
        break;
      case "rem":
        inPx = numericValue * context;
        break;
      case "em":
        inPx = numericValue * context;
        break;
      case "%":
        inPx = numericValue / 100 * context;
        break;
      case "vw":
        inPx = numericValue / 100 * 1920;
        break;
      case "vh":
        inPx = numericValue / 100 * 1080;
        break;
      default:
        inPx = numericValue;
    }
    let result;
    switch (toUnit) {
      case "px":
        result = inPx;
        break;
      case "rem":
        result = inPx / context;
        break;
      case "em":
        result = inPx / context;
        break;
      case "%":
        result = inPx / context * 100;
        break;
      case "vw":
        result = inPx / 1920 * 100;
        break;
      case "vh":
        result = inPx / 1080 * 100;
        break;
      default:
        result = inPx;
    }
    if (Math.abs(result - Math.round(result)) < 0.01) {
      return `${Math.round(result)}${toUnit}`;
    }
    return `${result.toFixed(2)}${toUnit}`;
  },
  // Min/Max/Clamp with better formatting
  min: (...values) => {
    const formatted = values.map((v) => normalizeValue(v)).join(", ");
    return `min(${formatted})`;
  },
  max: (...values) => {
    const formatted = values.map((v) => normalizeValue(v)).join(", ");
    return `max(${formatted})`;
  },
  clamp: (min, preferred, max, options) => {
    const minVal = normalizeValue(min);
    const prefVal = normalizeValue(preferred);
    const maxVal = normalizeValue(max);
    let result = `clamp(${minVal}, ${prefVal}, ${maxVal})`;
    if (options?.simplify) {
      result = simplifyCalc(result);
    }
    return result;
  },
  // Rounding helpers
  round: (value, precision = 2) => {
    const num = typeof value === "number" ? value : parseFloat(value);
    return num.toFixed(precision);
  },
  ceil: (value) => {
    const num = typeof value === "number" ? value : parseFloat(value);
    return Math.ceil(num).toString();
  },
  floor: (value) => {
    const num = typeof value === "number" ? value : parseFloat(value);
    return Math.floor(num).toString();
  },
  // Color helpers (returns CSS color values)
  rgba: (r, g, b, a = 1) => {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  },
  hsla: (h2, s, l, a = 1) => {
    return `hsla(${h2}, ${s}%, ${l}%, ${a})`;
  },
  // String helpers
  url: (path) => {
    return `url(${path})`;
  },
  format: (strings, ...values) => {
    let result = "";
    for (let i = 0; i < strings.length; i++) {
      result += strings[i];
      if (i < values.length) {
        result += normalizeValue(values[i]);
      }
    }
    return result;
  },
  // Conditional helpers
  if: (condition, trueValue, falseValue) => {
    return condition ? trueValue : falseValue;
  },
  // String manipulation
  camelToKebab: (str) => {
    return str.replace(/([A-Z])/g, "-$1").toLowerCase();
  },
  kebabToCamel: (str) => {
    return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
  },
  toPx: (value) => {
    if (typeof value === "number") return `${value}px`;
    if (/^\d+(?:\.\d+)?$/.test(value)) return `${value}px`;
    return value;
  },
  toRem: (value, base = 16) => {
    if (typeof value === "number") return `${value / base}rem`;
    if (/^\d+(?:\.\d+)?px$/.test(value)) {
      const px = parseFloat(value);
      return `${px / base}rem`;
    }
    if (/^\d+(?:\.\d+)?$/.test(value)) {
      const numValue = typeof value === "string" ? parseFloat(value) : value;
      return `${numValue / base}rem`;
    }
    return value;
  }
};

// node_modules/chalk/source/vendor/ansi-styles/index.js
var ANSI_BACKGROUND_OFFSET = 10;
var wrapAnsi16 = (offset = 0) => (code) => `\x1B[${code + offset}m`;
var wrapAnsi256 = (offset = 0) => (code) => `\x1B[${38 + offset};5;${code}m`;
var wrapAnsi16m = (offset = 0) => (red, green, blue) => `\x1B[${38 + offset};2;${red};${green};${blue}m`;
var styles = {
  modifier: {
    reset: [0, 0],
    // 21 isn't widely supported and 22 does the same thing
    bold: [1, 22],
    dim: [2, 22],
    italic: [3, 23],
    underline: [4, 24],
    overline: [53, 55],
    inverse: [7, 27],
    hidden: [8, 28],
    strikethrough: [9, 29]
  },
  color: {
    black: [30, 39],
    red: [31, 39],
    green: [32, 39],
    yellow: [33, 39],
    blue: [34, 39],
    magenta: [35, 39],
    cyan: [36, 39],
    white: [37, 39],
    // Bright color
    blackBright: [90, 39],
    gray: [90, 39],
    // Alias of `blackBright`
    grey: [90, 39],
    // Alias of `blackBright`
    redBright: [91, 39],
    greenBright: [92, 39],
    yellowBright: [93, 39],
    blueBright: [94, 39],
    magentaBright: [95, 39],
    cyanBright: [96, 39],
    whiteBright: [97, 39]
  },
  bgColor: {
    bgBlack: [40, 49],
    bgRed: [41, 49],
    bgGreen: [42, 49],
    bgYellow: [43, 49],
    bgBlue: [44, 49],
    bgMagenta: [45, 49],
    bgCyan: [46, 49],
    bgWhite: [47, 49],
    // Bright color
    bgBlackBright: [100, 49],
    bgGray: [100, 49],
    // Alias of `bgBlackBright`
    bgGrey: [100, 49],
    // Alias of `bgBlackBright`
    bgRedBright: [101, 49],
    bgGreenBright: [102, 49],
    bgYellowBright: [103, 49],
    bgBlueBright: [104, 49],
    bgMagentaBright: [105, 49],
    bgCyanBright: [106, 49],
    bgWhiteBright: [107, 49]
  }
};
var modifierNames = Object.keys(styles.modifier);
var foregroundColorNames = Object.keys(styles.color);
var backgroundColorNames = Object.keys(styles.bgColor);
var colorNames = [...foregroundColorNames, ...backgroundColorNames];
function assembleStyles() {
  const codes = /* @__PURE__ */ new Map();
  for (const [groupName, group] of Object.entries(styles)) {
    for (const [styleName, style] of Object.entries(group)) {
      styles[styleName] = {
        open: `\x1B[${style[0]}m`,
        close: `\x1B[${style[1]}m`
      };
      group[styleName] = styles[styleName];
      codes.set(style[0], style[1]);
    }
    Object.defineProperty(styles, groupName, {
      value: group,
      enumerable: false
    });
  }
  Object.defineProperty(styles, "codes", {
    value: codes,
    enumerable: false
  });
  styles.color.close = "\x1B[39m";
  styles.bgColor.close = "\x1B[49m";
  styles.color.ansi = wrapAnsi16();
  styles.color.ansi256 = wrapAnsi256();
  styles.color.ansi16m = wrapAnsi16m();
  styles.bgColor.ansi = wrapAnsi16(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi256 = wrapAnsi256(ANSI_BACKGROUND_OFFSET);
  styles.bgColor.ansi16m = wrapAnsi16m(ANSI_BACKGROUND_OFFSET);
  Object.defineProperties(styles, {
    rgbToAnsi256: {
      value(red, green, blue) {
        if (red === green && green === blue) {
          if (red < 8) {
            return 16;
          }
          if (red > 248) {
            return 231;
          }
          return Math.round((red - 8) / 247 * 24) + 232;
        }
        return 16 + 36 * Math.round(red / 255 * 5) + 6 * Math.round(green / 255 * 5) + Math.round(blue / 255 * 5);
      },
      enumerable: false
    },
    hexToRgb: {
      value(hex) {
        const matches = /[a-f\d]{6}|[a-f\d]{3}/i.exec(hex.toString(16));
        if (!matches) {
          return [0, 0, 0];
        }
        let [colorString] = matches;
        if (colorString.length === 3) {
          colorString = [...colorString].map((character) => character + character).join("");
        }
        const integer = Number.parseInt(colorString, 16);
        return [
          /* eslint-disable no-bitwise */
          integer >> 16 & 255,
          integer >> 8 & 255,
          integer & 255
          /* eslint-enable no-bitwise */
        ];
      },
      enumerable: false
    },
    hexToAnsi256: {
      value: (hex) => styles.rgbToAnsi256(...styles.hexToRgb(hex)),
      enumerable: false
    },
    ansi256ToAnsi: {
      value(code) {
        if (code < 8) {
          return 30 + code;
        }
        if (code < 16) {
          return 90 + (code - 8);
        }
        let red;
        let green;
        let blue;
        if (code >= 232) {
          red = ((code - 232) * 10 + 8) / 255;
          green = red;
          blue = red;
        } else {
          code -= 16;
          const remainder = code % 36;
          red = Math.floor(code / 36) / 5;
          green = Math.floor(remainder / 6) / 5;
          blue = remainder % 6 / 5;
        }
        const value = Math.max(red, green, blue) * 2;
        if (value === 0) {
          return 30;
        }
        let result = 30 + (Math.round(blue) << 2 | Math.round(green) << 1 | Math.round(red));
        if (value === 2) {
          result += 60;
        }
        return result;
      },
      enumerable: false
    },
    rgbToAnsi: {
      value: (red, green, blue) => styles.ansi256ToAnsi(styles.rgbToAnsi256(red, green, blue)),
      enumerable: false
    },
    hexToAnsi: {
      value: (hex) => styles.ansi256ToAnsi(styles.hexToAnsi256(hex)),
      enumerable: false
    }
  });
  return styles;
}
var ansiStyles = assembleStyles();
var ansi_styles_default = ansiStyles;

// node_modules/chalk/source/vendor/supports-color/browser.js
var level = (() => {
  if (!("navigator" in globalThis)) {
    return 0;
  }
  if (globalThis.navigator.userAgentData) {
    const brand = navigator.userAgentData.brands.find(({ brand: brand2 }) => brand2 === "Chromium");
    if (brand && brand.version > 93) {
      return 3;
    }
  }
  if (/\b(Chrome|Chromium)\//.test(globalThis.navigator.userAgent)) {
    return 1;
  }
  return 0;
})();
var colorSupport = level !== 0 && {
  level,
  hasBasic: true,
  has256: level >= 2,
  has16m: level >= 3
};
var supportsColor = {
  stdout: colorSupport,
  stderr: colorSupport
};
var browser_default = supportsColor;

// node_modules/chalk/source/utilities.js
function stringReplaceAll(string, substring, replacer) {
  let index = string.indexOf(substring);
  if (index === -1) {
    return string;
  }
  const substringLength = substring.length;
  let endIndex = 0;
  let returnValue = "";
  do {
    returnValue += string.slice(endIndex, index) + substring + replacer;
    endIndex = index + substringLength;
    index = string.indexOf(substring, endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}
function stringEncaseCRLFWithFirstIndex(string, prefix, postfix, index) {
  let endIndex = 0;
  let returnValue = "";
  do {
    const gotCR = string[index - 1] === "\r";
    returnValue += string.slice(endIndex, gotCR ? index - 1 : index) + prefix + (gotCR ? "\r\n" : "\n") + postfix;
    endIndex = index + 1;
    index = string.indexOf("\n", endIndex);
  } while (index !== -1);
  returnValue += string.slice(endIndex);
  return returnValue;
}

// node_modules/chalk/source/index.js
var { stdout: stdoutColor, stderr: stderrColor } = browser_default;
var GENERATOR = /* @__PURE__ */ Symbol("GENERATOR");
var STYLER = /* @__PURE__ */ Symbol("STYLER");
var IS_EMPTY = /* @__PURE__ */ Symbol("IS_EMPTY");
var levelMapping = [
  "ansi",
  "ansi",
  "ansi256",
  "ansi16m"
];
var styles2 = /* @__PURE__ */ Object.create(null);
var applyOptions = (object, options = {}) => {
  if (options.level && !(Number.isInteger(options.level) && options.level >= 0 && options.level <= 3)) {
    throw new Error("The `level` option should be an integer from 0 to 3");
  }
  const colorLevel = stdoutColor ? stdoutColor.level : 0;
  object.level = options.level === void 0 ? colorLevel : options.level;
};
var chalkFactory = (options) => {
  const chalk2 = (...strings) => strings.join(" ");
  applyOptions(chalk2, options);
  Object.setPrototypeOf(chalk2, createChalk.prototype);
  return chalk2;
};
function createChalk(options) {
  return chalkFactory(options);
}
Object.setPrototypeOf(createChalk.prototype, Function.prototype);
for (const [styleName, style] of Object.entries(ansi_styles_default)) {
  styles2[styleName] = {
    get() {
      const builder = createBuilder(this, createStyler(style.open, style.close, this[STYLER]), this[IS_EMPTY]);
      Object.defineProperty(this, styleName, { value: builder });
      return builder;
    }
  };
}
styles2.visible = {
  get() {
    const builder = createBuilder(this, this[STYLER], true);
    Object.defineProperty(this, "visible", { value: builder });
    return builder;
  }
};
var getModelAnsi = (model, level2, type, ...arguments_) => {
  if (model === "rgb") {
    if (level2 === "ansi16m") {
      return ansi_styles_default[type].ansi16m(...arguments_);
    }
    if (level2 === "ansi256") {
      return ansi_styles_default[type].ansi256(ansi_styles_default.rgbToAnsi256(...arguments_));
    }
    return ansi_styles_default[type].ansi(ansi_styles_default.rgbToAnsi(...arguments_));
  }
  if (model === "hex") {
    return getModelAnsi("rgb", level2, type, ...ansi_styles_default.hexToRgb(...arguments_));
  }
  return ansi_styles_default[type][model](...arguments_);
};
var usedModels = ["rgb", "hex", "ansi256"];
for (const model of usedModels) {
  styles2[model] = {
    get() {
      const { level: level2 } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level2], "color", ...arguments_), ansi_styles_default.color.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
  const bgModel = "bg" + model[0].toUpperCase() + model.slice(1);
  styles2[bgModel] = {
    get() {
      const { level: level2 } = this;
      return function(...arguments_) {
        const styler = createStyler(getModelAnsi(model, levelMapping[level2], "bgColor", ...arguments_), ansi_styles_default.bgColor.close, this[STYLER]);
        return createBuilder(this, styler, this[IS_EMPTY]);
      };
    }
  };
}
var proto = Object.defineProperties(() => {
}, {
  ...styles2,
  level: {
    enumerable: true,
    get() {
      return this[GENERATOR].level;
    },
    set(level2) {
      this[GENERATOR].level = level2;
    }
  }
});
var createStyler = (open, close, parent) => {
  let openAll;
  let closeAll;
  if (parent === void 0) {
    openAll = open;
    closeAll = close;
  } else {
    openAll = parent.openAll + open;
    closeAll = close + parent.closeAll;
  }
  return {
    open,
    close,
    openAll,
    closeAll,
    parent
  };
};
var createBuilder = (self, _styler, _isEmpty) => {
  const builder = (...arguments_) => applyStyle(builder, arguments_.length === 1 ? "" + arguments_[0] : arguments_.join(" "));
  Object.setPrototypeOf(builder, proto);
  builder[GENERATOR] = self;
  builder[STYLER] = _styler;
  builder[IS_EMPTY] = _isEmpty;
  return builder;
};
var applyStyle = (self, string) => {
  if (self.level <= 0 || !string) {
    return self[IS_EMPTY] ? "" : string;
  }
  let styler = self[STYLER];
  if (styler === void 0) {
    return string;
  }
  const { openAll, closeAll } = styler;
  if (string.includes("\x1B")) {
    while (styler !== void 0) {
      string = stringReplaceAll(string, styler.close, styler.open);
      styler = styler.parent;
    }
  }
  const lfIndex = string.indexOf("\n");
  if (lfIndex !== -1) {
    string = stringEncaseCRLFWithFirstIndex(string, closeAll, openAll, lfIndex);
  }
  return openAll + string + closeAll;
};
Object.defineProperties(createChalk.prototype, styles2);
var chalk = createChalk();
var chalkStderr = createChalk({ level: stderrColor ? stderrColor.level : 0 });
var source_default = chalk;

// src/compiler/Chain.ts
var currentTokenContext2 = null;
var debugMode = false;
var PUBLIC_METHODS = /* @__PURE__ */ new Set([
  // Finalizers
  "$el",
  "end",
  // State & Nesting
  "hover",
  "use",
  "when",
  "nest",
  // Component
  "component",
  "componentName",
  "props",
  // Responsive & AT-Rules
  "responsive",
  "media",
  "supports",
  "containerQuery",
  "layer",
  "keyframes",
  "fontFace",
  // Animations
  "animation",
  "animate",
  "duration",
  "delay",
  "timing",
  "iteration",
  "infinite",
  // Math Helpers
  "calc",
  "add",
  "subtract",
  "sub",
  "multiply",
  "mul",
  "divide",
  "div",
  "mpx",
  "rem",
  "em",
  "percent",
  "vw",
  "vh",
  "min",
  "max",
  "clamp",
  // Meta
  "debug",
  "explain"
]);
var ChainClass = class {
  catcher = {};
  useTokens;
  hoverCatcher = null;
  valueCache = /* @__PURE__ */ new Map();
  MAX_CACHE_SIZE = 200;
  __proxy = null;
  constructor(useTokens = true) {
    this.useTokens = useTokens;
  }
  // ==========================================================================
  // Core Methods
  // ==========================================================================
  resolveValue(value) {
    const cacheKey = typeof value === "function" ? `fn_${value.toString().slice(0, 100)}` : JSON.stringify(value);
    if (this.valueCache.has(cacheKey)) {
      return this.valueCache.get(cacheKey);
    }
    let resolved = value;
    if (typeof value === "function") {
      resolved = value(helpers);
    }
    if (this.useTokens && typeof resolved === "string" && resolved.includes("$")) {
      const tokenResolved = resolveToken(resolved, this.useTokens, currentTokenContext2);
      resolved = tokenResolved !== void 0 && tokenResolved !== null ? tokenResolved : resolved;
    }
    if (this.valueCache.size >= this.MAX_CACHE_SIZE) {
      const firstKey = this.valueCache.keys().next().value;
      if (firstKey) this.valueCache.delete(firstKey);
    }
    this.valueCache.set(cacheKey, resolved);
    return resolved;
  }
  setTransform(type, value) {
    if (!this.catcher._transforms) this.catcher._transforms = {};
    this.catcher._transforms[type] = this.resolveValue(value);
    return this.__proxy || this;
  }
  setProperty(prop, value) {
    if (handleShorthand(prop, value, this.catcher, this.useTokens)) {
      return this.__proxy || this;
    }
    const mappedProp = shorthandMap[prop] || prop;
    let resolvedValue = this.resolveValue(value);
    if (debugMode) {
      const displayProp = prop === mappedProp ? prop : `${prop} (${mappedProp})`;
      console.log(
        source_default.blue(`[ChainCSS Debug]`),
        source_default.gray(displayProp),
        "->",
        source_default.green(resolvedValue)
      );
    }
    const unitlessProperties = /* @__PURE__ */ new Set([
      "zIndex",
      "opacity",
      "flex",
      "order",
      "flexGrow",
      "flexShrink",
      "flexBasis",
      "fontWeight",
      "lineHeight",
      "scale",
      "zoom",
      "animationIterationCount",
      "columnCount",
      "orphans",
      "widows",
      "tabSize"
    ]);
    if (typeof resolvedValue === "number" && !unitlessProperties.has(prop) && !unitlessProperties.has(mappedProp)) {
      resolvedValue = `${resolvedValue}px`;
    }
    if (this.hoverCatcher !== null) {
      this.hoverCatcher[mappedProp] = resolvedValue;
    } else {
      this.catcher[mappedProp] = resolvedValue;
    }
    return this.__proxy || this;
  }
  // ==========================================================================
  // Proxy handler - routes all property access
  // ==========================================================================
  get(prop) {
    if (typeof prop === "symbol") return void 0;
    if (prop === "mx") return (value) => this.macroHandler("mx", value);
    if (prop === "my") return (value) => this.macroHandler("my", value);
    if (prop === "px") return (value) => this.macroHandler("px", value);
    if (prop === "py") return (value) => this.macroHandler("py", value);
    if (prop === "size") return (value) => this.macroHandler("size", value);
    if (prop === "inset") return (value) => this.macroHandler("inset", value);
    if (prop === "insetX") return (value) => this.macroHandler("insetX", value);
    if (prop === "insetY") return (value) => this.macroHandler("insetY", value);
    if (prop === "borderX") return (value) => this.macroHandler("borderX", value);
    if (prop === "borderY") return (value) => this.macroHandler("borderY", value);
    if (prop === "flex") return (value) => this.macroHandler("flex", value);
    if (prop === "inlineFlex") return (value) => this.macroHandler("inlineFlex", value);
    if (prop === "grid") return (value) => this.macroHandler("grid", value);
    if (prop === "inlineGrid") return (value) => this.macroHandler("inlineGrid", value);
    if (prop === "cols") return (value) => this.macroHandler("cols", value);
    if (prop === "rows") return (value) => this.macroHandler("rows", value);
    if (prop === "center") return (type) => this.macroHandler("center", type);
    if (prop === "flexCenter") return (dir) => this.macroHandler("flexCenter", dir);
    if (prop === "gridCenter") return () => this.macroHandler("gridCenter");
    if (prop === "stack") return (config) => this.macroHandler("stack", config);
    if (prop === "gridTable") return (minWidth) => this.macroHandler("gridTable", minWidth);
    if (prop === "aspect") return (ratio) => this.macroHandler("aspect", ratio);
    if (prop === "hide") return () => this.macroHandler("hide");
    if (prop === "show") return () => this.macroHandler("show");
    if (prop === "unselectable") return () => this.macroHandler("unselectable");
    if (prop === "scrollable") return (axis) => this.macroHandler("scrollable", axis);
    if (prop === "safeArea") return (edge) => this.macroHandler("safeArea", edge);
    if (prop === "absolute") return (coords) => this.macroHandler("absolute", coords);
    if (prop === "fixed") return (coords) => this.macroHandler("fixed", coords);
    if (prop === "sticky") return (coords) => this.macroHandler("sticky", coords);
    if (prop === "relative") return (coords) => this.macroHandler("relative", coords);
    if (prop === "circle") return (size) => this.macroHandler("circle", size);
    if (prop === "square") return (size) => this.macroHandler("square", size);
    if (prop === "truncate") return () => this.macroHandler("truncate");
    if (prop === "fluidText") return (config) => this.macroHandler("fluidText", config);
    if (prop === "glass") return (blur) => this.macroHandler("glass", blur);
    if (prop === "glow") return (config) => this.macroHandler("glow", config);
    if (prop === "textGradient") return (colors) => this.macroHandler("textGradient", colors);
    if (prop === "meshGradient") return (colors) => this.macroHandler("meshGradient", colors);
    if (prop === "noise") return (opacity) => this.macroHandler("noise", opacity);
    if (prop === "skeleton") return (active) => this.macroHandler("skeleton", active);
    if (prop === "clickScale") return (amount) => this.macroHandler("clickScale", amount);
    if (prop === "onInteracting") return (callback) => this.macroHandler("onInteracting", callback);
    if (prop === "children") return (callback) => this.macroHandler("children", callback);
    if (prop === "dark") return (callback) => this.macroHandler("dark", callback);
    if (prop === "light") return (callback) => this.macroHandler("light", callback);
    if (prop === "pill") return () => this.macroHandler("pill");
    if (prop === "containerMacro") return (maxWidth) => this.macroHandler("containerMacro", maxWidth);
    if (prop === "fullScreen") return (zIndex) => this.macroHandler("fullScreen", zIndex);
    if (prop === "shimmer") return () => this.macroHandler("shimmer");
    if (prop === "bento") return (cols) => this.macroHandler("bento", cols);
    if (prop === "pressable") return () => this.macroHandler("pressable");
    if (prop === "focusRing") return (color) => this.macroHandler("focusRing", color);
    if (prop === "outlineDebug") return () => this.macroHandler("outlineDebug");
    if (prop === "parallax") return (scale) => this.macroHandler("parallax", scale);
    if (prop === "lineClamp") return (lines) => this.macroHandler("lineClamp", lines);
    if (prop === "frostedNav") return (blur) => this.macroHandler("frostedNav", blur);
    if (prop === "gap") return (value) => this.setProperty("gap", value);
    if (prop === "gapX") return (value) => this.setProperty("columnGap", value);
    if (prop === "gapY") return (value) => this.setProperty("rowGap", value);
    if (prop === "hover") return this.createHover.bind(this);
    if (prop === "end") return this.endHover.bind(this);
    if (prop === "use") return this.useMixin.bind(this);
    if (prop === "when") return this.whenCondition.bind(this);
    if (prop === "nest") return this.nestSelector.bind(this);
    if (prop === "component") return this.setComponent.bind(this);
    if (prop === "componentName") return this.setComponentName.bind(this);
    if (prop === "props") return this.setProps.bind(this);
    if (prop === "debug") return this.enableDebugMode.bind(this);
    if (prop === "explain") return this.explainShorthand.bind(this);
    if (prop === "$el") return this.finalize.bind(this);
    if (prop === "scale") return (value) => this.setTransform("scale", value);
    if (prop === "rotate") return (value) => this.setTransform("rotate", value);
    if (prop === "x") return (value) => this.setTransform("translateX", value);
    if (prop === "y") return (value) => this.setTransform("translateY", value);
    if (prop === "skew") return (value) => this.setTransform("skew", value);
    if (animationPresets[prop]) {
      return (config) => this.applyAnimation(prop, config);
    }
    if (prop === "animate") return this.createAnimation.bind(this);
    if (prop === "duration") return (v) => this.setProperty("animationDuration", v);
    if (prop === "delay") return (v) => this.setProperty("animationDelay", v);
    if (prop === "timing") return (v) => this.setProperty("animationTimingFunction", v);
    if (prop === "iteration") return (v) => this.setProperty("animationIterationCount", v);
    if (prop === "infinite") return () => this.setProperty("animationIterationCount", "infinite");
    if (prop === "calc") return helpers.calc;
    if (prop === "add") return helpers.add;
    if (prop === "subtract" || prop === "sub") return helpers.subtract;
    if (prop === "multiply" || prop === "mul") return helpers.multiply;
    if (prop === "divide" || prop === "div") return helpers.divide;
    if (prop === "mpx") return (v) => helpers.mpx(v);
    if (prop === "rem") return (v) => helpers.rem(v);
    if (prop === "em") return helpers.em;
    if (prop === "percent") return helpers.percent;
    if (prop === "vw") return helpers.vw;
    if (prop === "vh") return helpers.vh;
    if (prop === "min") return helpers.min;
    if (prop === "max") return helpers.max;
    if (prop === "clamp") return helpers.clamp;
    if (currentBreakpoints && currentBreakpoints[prop]) {
      return (callback) => this.applyResponsive(prop, callback);
    }
    if (prop === "media") return this.applyMedia.bind(this);
    if (prop === "keyframes") return this.defineKeyframes.bind(this);
    if (prop === "fontFace") return this.defineFontFace.bind(this);
    if (prop === "supports") return this.applySupports.bind(this);
    if (prop === "containerQuery") return this.applyContainerQuery.bind(this);
    if (prop === "layer") return this.applyLayer.bind(this);
    return (value) => this.setProperty(prop, value);
  }
  // ==========================================================================
  // Finalize
  // ==========================================================================
  finalize(...selectors) {
    const styles3 = structuredClone(this.catcher);
    delete styles3._componentName;
    delete styles3._generateComponent;
    delete styles3._framework;
    delete styles3._propsDefinition;
    if (this.catcher._transforms) {
      const t = this.catcher._transforms;
      const transformString = Object.entries(t).map(([k, v]) => {
        const needsUnit = k.includes("translate") || k === "x" || k === "y";
        const unit = needsUnit && typeof v === "number" ? "px" : "";
        return `${k}(${v}${unit})`;
      }).join(" ");
      styles3.transform = transformString;
      delete styles3._transforms;
    }
    if (this.catcher.nestedRules) {
      styles3.nestedRules = structuredClone(this.catcher.nestedRules);
    }
    for (const key of Object.keys(styles3)) {
      if (key.startsWith("&:")) {
        const pseudoSelector = key.substring(1);
        styles3[pseudoSelector] = styles3[key];
        delete styles3[key];
      }
    }
    this.clear();
    if (selectors.length === 0) return styles3;
    if (debugMode) {
      console.log("[ChainCSS Debug] Raw selectors:", selectors);
    }
    const cleanSelectors = selectors.map((selector) => {
      let clean = selector;
      if (clean.startsWith(".chain-")) {
        clean = clean.replace(/^\./, "").replace(/^chain-/, "");
      } else if (clean.startsWith("chain-")) {
        clean = clean.substring(6);
      }
      if (debugMode) {
        console.log(`[ChainCSS Debug] Cleaned: "${selector}" -> "${clean}"`);
      }
      return clean;
    });
    if (debugMode) {
      console.log("[ChainCSS Debug] Final selectors:", cleanSelectors);
    }
    return {
      selectors: cleanSelectors,
      ...styles3
    };
  }
  // ==========================================================================
  // Public Method Implementations (renamed to avoid collisions)
  // ==========================================================================
  macroHandler(macroName, value) {
    const macroFn = macros[macroName];
    if (macroFn) {
      macroFn(value, this.catcher, this.useTokens);
    } else {
      this.setProperty(macroName, value);
    }
    return this.__proxy || this;
  }
  createHover() {
    if (debugMode) {
      console.log(`  \u{1F5B1}\uFE0F Hover styles added`);
    }
    this.hoverCatcher = {};
    return this.__proxy || this;
  }
  endHover() {
    if (this.hoverCatcher !== null) {
      this.catcher.hover = { ...this.hoverCatcher };
      this.hoverCatcher = null;
    }
    return this.__proxy || this;
  }
  useMixin(mixin) {
    const { selectors, atRules, ...styles3 } = mixin;
    Object.assign(this.catcher, styles3);
    if (atRules) {
      this.catcher.atRules = [...this.catcher.atRules || [], ...atRules];
    }
    return this.__proxy || this;
  }
  whenCondition(condition, callback) {
    if (condition) {
      callback(this.__proxy || this);
    }
    return this.__proxy || this;
  }
  nestSelector(selector, callback) {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    if (!this.catcher.nestedRules) this.catcher.nestedRules = [];
    this.catcher.nestedRules.push({
      selector,
      styles: result
    });
    return this.__proxy || this;
  }
  setComponentName(name) {
    this.catcher._componentName = name;
    return this.__proxy || this;
  }
  setComponent(framework = "auto") {
    this.catcher._generateComponent = true;
    this.catcher._framework = framework;
    return this.__proxy || this;
  }
  setProps(propsDefinition) {
    if (propsDefinition) {
      this.catcher._propsDefinition = propsDefinition;
    }
    return this.__proxy || this;
  }
  enableDebugMode() {
    debugMode = true;
    return this.__proxy || this;
  }
  explainShorthand(shorthand) {
    const mapped = shorthandMap[shorthand];
    if (mapped) {
      console.log(`
\u{1F4D6} ChainCSS Explanation:`);
      console.log(`   .${shorthand}() \u2192 ${mapped}`);
      console.log(`   Example: .${shorthand}('value') sets CSS property '${mapped}'
`);
    } else {
      const suggestion = getSuggestion(shorthand);
      if (suggestion && typeof suggestion === "string") {
        console.log(`
\u26A0\uFE0F ChainCSS: '${shorthand}' is not a recognized shorthand.`);
        console.log(`   Did you mean .${suggestion}()?
`);
      } else {
        console.log(`
\u26A0\uFE0F ChainCSS: '${shorthand}' is not a recognized shorthand or CSS property.
`);
      }
    }
    return this.__proxy || this;
  }
  // ==========================================================================
  // Animation Methods
  // ==========================================================================
  applyAnimation(name, config) {
    if (!name) {
      console.warn("\u26A0\uFE0F ChainCSS: animation() requires a name parameter");
      return this.__proxy || this;
    }
    if (!this.catcher.atRules) this.catcher.atRules = [];
    const preset = animationPresets[name];
    if (!preset && !this.catcher.atRules.some((rule) => rule.type === "keyframes" && rule.name === name)) {
      console.warn(`\u26A0\uFE0F ChainCSS: Unknown animation preset '${name}'. Available: ${Object.keys(animationPresets).join(", ")}`);
      return this.__proxy || this;
    }
    const hasKeyframes = this.catcher.atRules.some(
      (rule) => rule.type === "keyframes" && rule.name === name
    );
    if (!hasKeyframes && preset) {
      this.catcher.atRules.push({
        type: "keyframes",
        name,
        steps: preset
      });
    }
    const animationStyles = createAnimation(name, config);
    Object.assign(this.catcher, animationStyles);
    return this.__proxy || this;
  }
  createAnimation(name, keyframes, config) {
    if (!name || !keyframes) {
      console.warn("\u26A0\uFE0F ChainCSS: animate() requires name and keyframes parameters");
      return this.__proxy || this;
    }
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: "keyframes",
      name,
      steps: keyframes
    });
    const animationStyles = createAnimation(name, config);
    Object.assign(this.catcher, animationStyles);
    return this.__proxy || this;
  }
  // ==========================================================================
  // Responsive & AT-Rules
  // ==========================================================================
  applyResponsive(breakpoint, callback) {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    const { selectors, ...pureStyles } = result || {};
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: "media",
      query: currentBreakpoints[breakpoint],
      styles: pureStyles
    });
    return this.__proxy || this;
  }
  applyMedia(query, callback) {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    const { selectors, ...pureStyles } = result || {};
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: "media",
      query,
      styles: pureStyles
    });
    return this.__proxy || this;
  }
  defineKeyframes(name, steps) {
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: "keyframes",
      name,
      steps
    });
    return this.__proxy || this;
  }
  defineFontFace(properties) {
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: "font-face",
      properties
    });
    return this.__proxy || this;
  }
  applySupports(condition, callback) {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: "supports",
      condition,
      styles: result
    });
    return this.__proxy || this;
  }
  applyContainerQuery(condition, callback) {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: "container",
      condition,
      styles: result
    });
    return this.__proxy || this;
  }
  applyLayer(name, callback) {
    const subChain = createChain(this.useTokens);
    callback(subChain);
    const result = subChain.$el();
    if (!this.catcher.atRules) this.catcher.atRules = [];
    this.catcher.atRules.push({
      type: "layer",
      name,
      styles: result
    });
    return this.__proxy || this;
  }
  // ==========================================================================
  // Cleanup
  // ==========================================================================
  clear() {
    this.catcher = {};
    this.hoverCatcher = null;
    this.valueCache.clear();
  }
};
function createChain(useTokens = true) {
  const chained = new ChainClass(useTokens);
  const proxy = new Proxy(chained, {
    get(target, prop) {
      if (typeof prop === "symbol") return void 0;
      if (PUBLIC_METHODS.has(prop) && prop in target) {
        const val = target[prop];
        return typeof val === "function" ? val.bind(target) : val;
      }
      return target.get(prop);
    }
  });
  chained.__proxy = proxy;
  return proxy;
}

// src/compiler/shorthands.ts
var shorthandMap = {
  "m": "margin",
  "mt": "marginTop",
  "mr": "marginRight",
  "mb": "marginBottom",
  "ml": "marginLeft",
  "p": "padding",
  "pt": "paddingTop",
  "pr": "paddingRight",
  "pb": "paddingBottom",
  "pl": "paddingLeft",
  "z": "zIndex",
  "op": "opacity",
  "ov": "overflow",
  "ovx": "overflowX",
  "ovy": "overflowY",
  "objFit": "objectFit",
  "objPos": "objectPosition",
  "d": "display",
  "pos": "position",
  "w": "width",
  "h": "height",
  "minW": "minWidth",
  "maxW": "maxWidth",
  "minH": "minHeight",
  "maxH": "maxHeight",
  "bg": "backgroundColor",
  "bgImg": "backgroundImage",
  "bgPos": "backgroundPosition",
  "bgSize": "backgroundSize",
  "c": "color",
  "flexDir": "flexDirection",
  "flexWrap": "flexWrap",
  "justify": "justifyContent",
  "items": "alignItems",
  "self": "alignSelf",
  "content": "alignContent",
  "gap": "gap",
  "gapX": "columnGap",
  "gapY": "rowGap",
  "grow": "flexGrow",
  "shrink": "flexShrink",
  "basis": "flexBasis",
  "order": "order",
  "gridCols": "gridTemplateColumns",
  "gridRows": "gridTemplateRows",
  "gridRow": "gridRow",
  "gridCol": "gridColumn",
  "rounded": "borderRadius",
  "br": "borderRadius",
  "radius": "borderRadius",
  "roundedTL": "borderTopLeftRadius",
  "roundedTR": "borderTopRightRadius",
  "roundedBR": "borderBottomRightRadius",
  "roundedBL": "borderBottomLeftRadius",
  "border": "border",
  "borderW": "borderWidth",
  "borderC": "borderColor",
  "borderS": "borderStyle",
  "borderT": "borderTop",
  "borderR": "borderRight",
  "borderB": "borderBottom",
  "borderL": "borderLeft",
  "fontF": "fontFamily",
  "text": "color",
  "align": "textAlign",
  "fs": "fontSize",
  "fw": "fontWeight",
  "lh": "lineHeight",
  "ls": "letterSpacing",
  "shadow": "boxShadow",
  "textShadow": "textShadow",
  "transform": "transform",
  "transformOrigin": "transformOrigin",
  "transition": "transition",
  "transitionAll": "transition",
  "cursor": "cursor",
  "pointer": "cursor",
  "resize": "resize",
  "filter": "filter",
  "backdropFilter": "backdropFilter"
};
var macros = {
  // --- Spacing & Sizing ---
  mx: (v, c) => {
    const value = typeof v === "number" ? `${v}px` : v;
    c.marginLeft = value;
    c.marginRight = value;
  },
  my: (v, c) => {
    const value = typeof v === "number" ? `${v}px` : v;
    c.marginTop = value;
    c.marginBottom = value;
  },
  px: (v, c) => {
    const value = typeof v === "number" ? `${v}px` : v;
    c.paddingLeft = value;
    c.paddingRight = value;
  },
  py: (v, c) => {
    const value = typeof v === "number" ? `${v}px` : v;
    c.paddingTop = value;
    c.paddingBottom = value;
  },
  size: (v, c) => {
    c.width = v;
    c.height = v;
  },
  inset: (v, c) => {
    if (typeof v === "object") {
      if (v.top !== void 0) c.top = v.top;
      if (v.right !== void 0) c.right = v.right;
      if (v.bottom !== void 0) c.bottom = v.bottom;
      if (v.left !== void 0) c.left = v.left;
    } else {
      c.top = v;
      c.right = v;
      c.bottom = v;
      c.left = v;
    }
  },
  insetX: (v, c) => {
    c.left = v;
    c.right = v;
  },
  insetY: (v, c) => {
    c.top = v;
    c.bottom = v;
  },
  // --- Borders ---
  borderX: (v, c) => {
    c.borderLeft = v;
    c.borderRight = v;
  },
  borderY: (v, c) => {
    c.borderTop = v;
    c.borderBottom = v;
  },
  // --- Layouts & Display ---
  flex: (v, c) => {
    c.display = "flex";
    if (v && v !== true && typeof v === "string") c.flex = v;
  },
  inlineFlex: (v, c) => {
    c.display = "inline-flex";
  },
  grid: (v, c) => {
    c.display = "grid";
    if (v && v !== true && typeof v === "string") c.grid = v;
  },
  inlineGrid: (v, c) => {
    c.display = "inline-grid";
  },
  cols: (v, c) => {
    c.gridTemplateColumns = typeof v === "number" ? `repeat(${v}, minmax(0, 1fr))` : v;
  },
  rows: (v, c) => {
    c.gridTemplateRows = typeof v === "number" ? `repeat(${v}, minmax(0, 1fr))` : v;
  },
  center: (v, c) => {
    c.display = v === "inline" ? "inline-flex" : "flex";
    c.alignItems = "center";
    c.justifyContent = "center";
  },
  flexCenter: (v, c) => {
    c.display = "flex";
    c.alignItems = "center";
    c.justifyContent = "center";
    if (v === "col" || v === "column") c.flexDirection = "column";
  },
  gridCenter: (v, c) => {
    c.display = "grid";
    c.placeItems = "center";
  },
  stack: (v, c) => {
    c.display = "flex";
    if (typeof v === "object") {
      c.flexDirection = v.dir === "row" ? "row" : "column";
      c.gap = v.spacing;
    } else if (v === "row") {
      c.flexDirection = "row";
      c.gap = "1rem";
    } else {
      c.flexDirection = "column";
      c.gap = typeof v === "number" ? `${v}px` : v || "1rem";
    }
  },
  gridTable: (v, c) => {
    const min = typeof v === "number" ? `${v}px` : v;
    c.display = "grid";
    c.gridTemplateColumns = `repeat(auto-fit, minmax(${min}, 1fr))`;
  },
  // --- Visibility & Behavior ---
  hide: (v, c) => {
    c.opacity = 0;
    c.visibility = "hidden";
    c.pointerEvents = "none";
  },
  show: (v, c) => {
    c.opacity = 1;
    c.visibility = "visible";
    c.pointerEvents = "auto";
  },
  unselectable: (v, c) => {
    c.userSelect = "none";
    c.WebkitUserSelect = "none";
    c.MozUserSelect = "none";
    c.msUserSelect = "none";
    c.cursor = "default";
  },
  scrollable: (v, c) => {
    if (v === "x") {
      c.overflowX = "auto";
      c.overflowY = "hidden";
    } else if (v === "y") {
      c.overflowX = "hidden";
      c.overflowY = "auto";
    } else if (v === "both") {
      c.overflow = "auto";
    } else {
      c.overflow = "auto";
    }
    c.WebkitOverflowScrolling = "touch";
  },
  // --- Positioning ---
  absolute: (v, c) => handlePosition("absolute", v, c),
  fixed: (v, c) => handlePosition("fixed", v, c),
  sticky: (v, c) => handlePosition("sticky", v, c),
  relative: (v, c) => handlePosition("relative", v, c),
  // --- Shapes & Content ---
  circle: (v, c) => {
    c.width = v;
    c.height = v;
    c.borderRadius = "50%";
    c.display = "flex";
    c.alignItems = "center";
    c.justifyContent = "center";
  },
  square: (v, c) => {
    c.width = v;
    c.height = v;
    c.display = "flex";
    c.alignItems = "center";
    c.justifyContent = "center";
  },
  truncate: (v, c) => {
    c.overflow = "hidden";
    c.textOverflow = "ellipsis";
    c.whiteSpace = "nowrap";
  },
  aspect: (v, c) => {
    const map = {
      square: "1 / 1",
      video: "16 / 9",
      golden: "1.618 / 1",
      portrait: "3 / 4",
      landscape: "4 / 3"
    };
    c.aspectRatio = map[v] || v;
  },
  // --- Aesthetic Effects ---
  glass: (v, c) => {
    const blur = typeof v === "number" ? `${v}px` : v || "10px";
    c.backdropFilter = `blur(${blur})`;
    c.WebkitBackdropFilter = `blur(${blur})`;
    c.backgroundColor = "rgba(255, 255, 255, 0.1)";
    c.border = "1px solid rgba(255, 255, 255, 0.2)";
  },
  glow: (v, c) => {
    let color;
    let size;
    if (typeof v === "string") {
      color = v;
      size = 20;
    } else {
      color = v.color || "rgba(255,255,255,0.5)";
      size = v.size || 20;
    }
    c.boxShadow = `0 0 ${size / 4}px ${color}, 0 0 ${size / 2}px ${color}, 0 0 ${size}px ${color}`;
  },
  textGradient: (v, c) => {
    let colors;
    let angle;
    if (Array.isArray(v)) {
      colors = v;
      angle = 90;
    } else {
      colors = v.colors;
      angle = v.angle || 90;
    }
    c.backgroundImage = `linear-gradient(${angle}deg, ${colors.join(", ")})`;
    c.WebkitBackgroundClip = "text";
    c.backgroundClip = "text";
    c.WebkitTextFillColor = "transparent";
    c.color = "transparent";
    c.display = "inline-block";
  },
  meshGradient: (v, c) => {
    const [c1, c2, c3, c4] = Array.isArray(v) ? v : [v[0], v[1], v[2], v[3]];
    c.backgroundColor = c1;
    c.backgroundImage = `radial-gradient(at 0% 0%, ${c2} 0px, transparent 50%), radial-gradient(at 100% 0%, ${c3} 0px, transparent 50%), radial-gradient(at 100% 100%, ${c4} 0px, transparent 50%)`;
  },
  noise: (v, c) => {
    const op = typeof v === "number" ? v : 0.05;
    c.backgroundImage = `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='${op}'/%3E%3C/svg%3E")`;
  },
  // --- Logic & Responsive ---
  skeleton: (v, c) => {
    let active;
    let baseColor;
    let highlightColor;
    if (typeof v === "boolean") {
      active = v;
      baseColor = "rgba(0,0,0,0.1)";
      highlightColor = "rgba(0,0,0,0.05)";
    } else {
      active = v.active;
      baseColor = v.color || "rgba(0,0,0,0.1)";
      highlightColor = v.highlight || "rgba(0,0,0,0.05)";
    }
    if (!active) return;
    c.backgroundColor = baseColor;
    c.backgroundImage = `linear-gradient(90deg, ${baseColor} 25%, ${highlightColor} 50%, ${baseColor} 75%)`;
    c.backgroundSize = "200% 100%";
    c.animation = "skeleton-loading 1.5s infinite linear";
    if (!c.atRules) c.atRules = [];
    c.atRules.push({
      type: "keyframes",
      name: "skeleton-loading",
      steps: {
        "0%": { backgroundPosition: "200% 0" },
        "100%": { backgroundPosition: "-200% 0" }
      }
    });
  },
  fluidText: (v, c) => {
    const min = typeof v.min === "number" ? `${v.min}px` : v.min;
    const max = typeof v.max === "number" ? `${v.max}px` : v.max;
    c.fontSize = `clamp(${min}, ${v.vw || "4vw"}, ${max})`;
  },
  safeArea: (v, c) => {
    const edges = Array.isArray(v) ? v : [v || "all"];
    const map = {
      top: "Top",
      bottom: "Bottom",
      left: "Left",
      right: "Right"
    };
    edges.forEach((e) => {
      if (e === "all") {
        Object.keys(map).forEach((k) => {
          c[`padding${map[k]}`] = `env(safe-area-inset-${k})`;
        });
      } else if (map[e]) {
        c[`padding${map[e]}`] = `env(safe-area-inset-${e})`;
      }
    });
  },
  // --- Nested Rules & Interactions ---
  clickScale: (v, c) => {
    const s = typeof v === "number" ? v : 0.95;
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({
      selector: "&:active",
      styles: {
        transform: `scale(${s})`,
        transition: "transform 0.1s cubic-bezier(0.4, 0, 0.2, 1)"
      }
    });
  },
  onInteracting: (v, c, useTokens) => {
    const res = getSubStyles(v, useTokens);
    if (!c.nestedRules) c.nestedRules = [];
    ["&:hover", "&:focus-visible", "&:active"].forEach(
      (s) => c.nestedRules.push({ selector: s, styles: res })
    );
  },
  children: (v, c, useTokens) => {
    const res = getSubStyles(v, useTokens);
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({ selector: "& > *", styles: res });
  },
  dark: (v, c, useTokens) => handleTheme(v, c, "dark", useTokens),
  light: (v, c, useTokens) => handleTheme(v, c, "light", useTokens),
  // --- Utility Macros ---
  pill: (v, c) => {
    c.borderRadius = "9999px";
    c.padding = "8px 20px";
    c.display = "inline-flex";
    c.alignItems = "center";
    c.whiteSpace = "nowrap";
  },
  containerMacro: (v, c) => {
    c.width = "100%";
    c.maxWidth = typeof v === "number" ? `${v}px` : v || "1200px";
    macros.mx("auto", c, false);
    macros.px("20px", c, false);
  },
  fullScreen: (v, c) => {
    c.position = "fixed";
    c.top = 0;
    c.right = 0;
    c.bottom = 0;
    c.left = 0;
    c.zIndex = typeof v === "number" ? v : 9999;
  },
  shimmer: (v, c) => {
    c.backgroundImage = "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)";
    c.backgroundSize = "200% 100%";
    c.animation = "shimmer 2s infinite linear";
    if (!c.atRules) c.atRules = [];
    c.atRules.push({
      type: "keyframes",
      name: "shimmer",
      steps: {
        "0%": { backgroundPosition: "-200% 0" },
        "100%": { backgroundPosition: "200% 0" }
      }
    });
  },
  bento: (v, c, useTokens) => {
    c.display = "grid";
    if (typeof v === "number") {
      c.gridTemplateColumns = `repeat(${v}, minmax(0, 1fr))`;
      c.gap = "16px";
    } else if (typeof v === "object") {
      c.gridTemplateColumns = `repeat(${v.cols || 4}, minmax(0, 1fr))`;
      c.gap = typeof v.gap === "number" ? `${v.gap}px` : v.gap || "16px";
    }
    if (!c.nestedRules) c.nestedRules = [];
    const childStyles = typeof v?.children === "function" ? getSubStyles(v.children, useTokens) : {
      borderRadius: "12px",
      padding: "20px",
      backgroundColor: "rgba(255,255,255,0.05)"
    };
    c.nestedRules.push({
      selector: "& > *",
      styles: childStyles
    });
  },
  pressable: (v, c, useTokens) => {
    c.cursor = "pointer";
    macros.unselectable(v, c, useTokens);
    macros.clickScale(v, c, useTokens);
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({
      selector: "&:hover",
      styles: { opacity: 0.8 }
    });
  },
  focusRing: (v, c, useTokens) => {
    const ringColor = typeof v === "string" ? v : "#3b82f6";
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({
      selector: "&:focus-visible",
      styles: {
        outline: `2px solid ${ringColor}`,
        outlineOffset: "2px"
      }
    });
  },
  outlineDebug: (v, c) => {
    c.border = "1px solid red";
    if (!c.nestedRules) c.nestedRules = [];
    c.nestedRules.push({
      selector: "& > *",
      styles: { outline: "1px solid rgba(0,255,0,0.5)" }
    });
  },
  parallax: (v, c) => {
    c.transformStyle = "preserve-3d";
    c.perspective = "1px";
    c.height = "100vh";
    c.overflowX = "hidden";
    c.overflowY = "auto";
    if (!c.nestedRules) c.nestedRules = [];
    const scale = typeof v === "number" ? v : 2;
    c.nestedRules.push({
      selector: "& > *",
      styles: { transform: `translateZ(-1px) scale(${scale})` }
    });
  },
  lineClamp: (v, c) => {
    const lines = typeof v === "number" ? v : 3;
    c.display = "-webkit-box";
    c.WebkitLineClamp = lines;
    c.WebkitBoxOrient = "vertical";
    c.overflow = "hidden";
  },
  frostedNav: (v, c, useTokens) => {
    macros.fixed({ top: 0, left: 0 }, c, useTokens);
    c.width = "100%";
    macros.glass(v || 15, c, useTokens);
    macros.safeArea("top", c, useTokens);
    c.zIndex = 1e3;
  }
};
function handlePosition(type, v, c) {
  c.position = type;
  if (v && typeof v === "object") {
    if (v.top !== void 0) c.top = v.top;
    if (v.right !== void 0) c.right = v.right;
    if (v.bottom !== void 0) c.bottom = v.bottom;
    if (v.left !== void 0) c.left = v.left;
  } else if (v !== void 0 && typeof v !== "boolean") {
    c.top = v;
    c.right = v;
    c.bottom = v;
    c.left = v;
  }
}
function getSubStyles(callback, useTokens) {
  const sub = createChain(useTokens);
  callback(sub);
  const result = sub.$el();
  const { selectors, atRules, nestedRules, ...pure } = result;
  return pure;
}
function handleTheme(cb, c, mode, useTokens) {
  if (!c.atRules) c.atRules = [];
  c.atRules.push({
    type: "media",
    query: `(prefers-color-scheme: ${mode})`,
    styles: getSubStyles(cb, useTokens)
  });
}
function handleShorthand(prop, value, catcher, useTokens = true) {
  if (macros[prop]) {
    macros[prop](value, catcher, useTokens);
    return true;
  }
  if (["scale", "rotate", "skew"].includes(prop)) {
    if (!catcher._transforms) catcher._transforms = {};
    catcher._transforms[prop] = value;
    return true;
  }
  if (prop === "x") {
    if (!catcher._transforms) catcher._transforms = {};
    catcher._transforms.translateX = value;
    return true;
  }
  if (prop === "y") {
    if (!catcher._transforms) catcher._transforms = {};
    catcher._transforms.translateY = value;
    return true;
  }
  return false;
}

// src/core/common-utils.ts
function kebabCase(str) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}
function resolveToken2(value, tokenStore = {}, debug = false) {
  if (typeof value !== "string" || !value.includes("$")) return value;
  return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match, pathStr) => {
    const parts = pathStr.split(".");
    let current = tokenStore;
    if (current && typeof current.get === "function") {
      const resolved = current.get(pathStr);
      if (resolved !== void 0 && resolved !== null) {
        if (debug) {
          console.log(`\u2728 Resolved ${match} to ${resolved}`);
        }
        return String(resolved);
      }
    }
    for (const part of parts) {
      if (current && current[part] !== void 0) {
        current = current[part];
      } else {
        if (debug) {
          console.warn(`\u26A0\uFE0F Token not found: ${match}`);
        }
        return match;
      }
    }
    if (typeof current === "string" || typeof current === "number") {
      if (debug) {
        console.log(`\u2728 Resolved ${match} to ${current}`);
      }
      return String(current);
    }
    return match;
  });
}
function processStyleObject(obj, tokenStore = {}, options = {}) {
  const { useTokens = true, debug = false } = options;
  let css = "";
  const expandedProps = {};
  if (debug) {
    console.log("[ChainCSS] Processing style object:", obj);
    if (tokenStore && typeof tokenStore === "object") {
      const tokenKeys = Object.keys(tokenStore);
      if (tokenKeys.length > 0) {
        console.log("[ChainCSS] Token store available:", tokenKeys);
      }
    }
  }
  for (let [key, value] of Object.entries(obj)) {
    if (key.startsWith("_")) continue;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      continue;
    }
    if (macros && macros[key]) {
      try {
        macros[key](value, expandedProps, useTokens);
      } catch (error) {
        console.warn(`[ChainCSS] Error applying macro "${key}":`, error);
      }
    } else {
      const realKey = shorthandMap[key] || key;
      expandedProps[realKey] = value;
    }
  }
  if (debug) {
    console.log("[ChainCSS] Expanded properties:", expandedProps);
  }
  const unitlessProps = [
    "opacity",
    "zIndex",
    "fontWeight",
    "flex",
    "flexGrow",
    "flexShrink",
    "order",
    "gridColumn",
    "gridRow",
    "animationIterationCount",
    "lineHeight"
  ];
  for (let [key, value] of Object.entries(expandedProps)) {
    if (debug) {
      console.log(`[ChainCSS] Processing property: ${key} = ${value}`);
    }
    let finalValue = value;
    if (useTokens && typeof value === "string") {
      finalValue = resolveToken2(value, tokenStore, debug);
    }
    const kebabKey = kebabCase(key);
    let unit = "";
    if (typeof value === "number" && !unitlessProps.includes(key)) {
      unit = "px";
    }
    css += `  ${kebabKey}: ${finalValue}${unit};
`;
  }
  return css;
}

// src/runtime/injector.ts
var TOKEN_V2_KEY = "__CHAINCSS_V2_TOKENS__";
var StyleInjector = class {
  styleElement = null;
  injectedHashes = /* @__PURE__ */ new Set();
  moduleMap = /* @__PURE__ */ new Map();
  debugMode = false;
  get tokenStore() {
    if (typeof window === "undefined") {
      return this._internalFallbackStore || {};
    }
    if (!window[TOKEN_V2_KEY]) {
      Object.defineProperty(window, TOKEN_V2_KEY, {
        value: {},
        writable: true,
        enumerable: false,
        configurable: true
      });
    }
    return window[TOKEN_V2_KEY];
  }
  constructor() {
    if (typeof document !== "undefined") {
      const existing = document.getElementById("chaincss-runtime-styles");
      if (existing) {
        this.styleElement = existing;
      } else {
        const style = document.createElement("style");
        style.id = "chaincss-runtime-styles";
        style.setAttribute("data-chaincss", "runtime");
        document.head.appendChild(style);
        this.styleElement = style;
      }
    }
  }
  /**
   * Enable debug logging
   */
  enableDebug(enable = true) {
    this.debugMode = enable;
  }
  /**
   * Set global tokens (e.g., brand colors, spacing scales)
   */
  setTokens(tokens2) {
    if (this.debugMode) {
      console.log("[ChainCSS] Tokens set:", Object.keys(tokens2));
    }
    Object.assign(this.tokenStore, tokens2);
  }
  /**
   * Get a token value by path
   */
  getToken(path) {
    const parts = path.split(".");
    let current = this.tokenStore;
    for (const part of parts) {
      if (current && current[part] !== void 0) {
        current = current[part];
      } else {
        return void 0;
      }
    }
    return current;
  }
  /**
   * Resolves $variables within a string using the tokenStore
   */
  resolveToken(value) {
    if (typeof value !== "string") return value;
    if (value.startsWith("$")) {
      const tokenValue = this.getToken(value.slice(1));
      return tokenValue !== void 0 ? tokenValue : value;
    }
    return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match, path) => {
      const tokenValue = this.getToken(path);
      return tokenValue !== void 0 ? String(tokenValue) : match;
    });
  }
  generateCSS(style, className) {
    let css = "";
    const selector = `.${className}`;
    const mainBody = processStyleObject(style, this.tokenStore, { useTokens: true, debug: false });
    if (mainBody && Object.keys(mainBody).length > 0) {
      let rules = "";
      for (const [prop, val] of Object.entries(mainBody)) {
        rules += `  ${prop}: ${val};
`;
      }
      css += `${selector} {
${rules}}
`;
    }
    if (style.hover) {
      const hoverBody = processStyleObject(style.hover, this.tokenStore, { useTokens: true, debug: false });
      if (hoverBody && Object.keys(hoverBody).length > 0) {
        let rules = "";
        for (const [prop, val] of Object.entries(hoverBody)) {
          rules += `  ${prop}: ${val};
`;
        }
        css += `${selector}:hover {
${rules}}
`;
      }
    }
    return css;
  }
  injectMultiple(styles3, moduleId) {
    const result = {};
    let newCSS = "";
    const moduleClasses = /* @__PURE__ */ new Set();
    for (const [name, style] of Object.entries(styles3)) {
      const className = name;
      result[name] = className;
      if (!this.injectedHashes.has(className)) {
        const generatedCSS = this.generateCSS(style, className);
        if (generatedCSS) {
          newCSS += generatedCSS;
          this.injectedHashes.add(className);
        }
      }
      moduleClasses.add(className);
    }
    if (moduleId && moduleClasses.size > 0) {
      this.moduleMap.set(moduleId, moduleClasses);
    }
    if (newCSS) {
      this.writeToDOM(newCSS);
      if (this.debugMode) {
        console.log(`[ChainCSS] Injected ${newCSS.length} bytes of CSS (${moduleId || "anonymous"})`);
      }
    }
    return result;
  }
  writeToDOM(css) {
    if (css && this.styleElement) {
      this.styleElement.textContent += css;
    }
  }
  removeModule(moduleId) {
    const classes = this.moduleMap.get(moduleId);
    if (!classes || !this.styleElement?.sheet) return;
    const sheet = this.styleElement.sheet;
    let removedCount = 0;
    for (let i = sheet.cssRules.length - 1; i >= 0; i--) {
      const rule = sheet.cssRules[i];
      if (rule.selectorText) {
        const match = rule.selectorText.match(/\.([a-zA-Z0-9_-]+)/);
        if (match && classes.has(match[1])) {
          sheet.deleteRule(i);
          this.injectedHashes.delete(match[1]);
          removedCount++;
        }
      }
    }
    this.moduleMap.delete(moduleId);
    if (this.debugMode) {
      console.log(`[ChainCSS] Removed ${removedCount} rules for module ${moduleId}`);
    }
  }
  removeAll() {
    if (this.styleElement) {
      this.styleElement.textContent = "";
      this.injectedHashes.clear();
      this.moduleMap.clear();
      if (this.debugMode) {
        console.log("[ChainCSS] All runtime styles removed");
      }
    }
  }
  getStyleElement() {
    return this.styleElement;
  }
  getStats() {
    return {
      injectedStyles: this.injectedHashes.size,
      modules: this.moduleMap.size
    };
  }
};
var styleInjector = new StyleInjector();
var setTokens = (t) => styleInjector.setTokens(t);
var compileRuntime = (s, moduleId) => styleInjector.injectMultiple(s, moduleId);
var removeRuntimeModule = (moduleId) => styleInjector.removeModule(moduleId);
function runRuntime(...styles3) {
  let css = "";
  for (const style of styles3) {
    if (style.selectors && style.selectors.length > 0) {
      const combinedSelector = style.selectors.join(", ");
      const mainBody = processStyleObject(style, styleInjector["tokenStore"], { useTokens: true, debug: false });
      if (mainBody && Object.keys(mainBody).length > 0) {
        let rules = "";
        for (const [prop, val] of Object.entries(mainBody)) {
          rules += `  ${prop}: ${val};
`;
        }
        css += `${combinedSelector} {
${rules}}
`;
      }
      if (style.hover) {
        const hoverBody = processStyleObject(style.hover, styleInjector["tokenStore"], { useTokens: true, debug: false });
        if (hoverBody && Object.keys(hoverBody).length > 0) {
          let rules = "";
          for (const [prop, val] of Object.entries(hoverBody)) {
            rules += `  ${prop}: ${val};
`;
          }
          css += `${combinedSelector}:hover {
${rules}}
`;
        }
      }
    }
  }
  styleInjector.writeToDOM(css);
  return css;
}

// src/runtime/Chain.ts
var debugMode2 = false;
var runtimeMacros = { ...macros };
var globalManifest = {};
var setManifest = (manifest) => {
  if (manifest.atomicMap) {
    globalManifest = manifest.atomicMap;
  } else if (manifest.atomicClasses) {
    globalManifest = manifest.atomicClasses;
  } else {
    globalManifest = manifest || {};
  }
  if (debugMode2) {
    console.log("[ChainCSS] Manifest loaded with", Object.keys(globalManifest).length, "entries");
  }
};
var RuntimeChain = class _RuntimeChain {
  constructor(useTokens = false) {
    this.useTokens = useTokens;
    const PUBLIC_METHODS2 = /* @__PURE__ */ new Set([
      "use",
      "hover",
      "$el",
      "$name",
      "end",
      "getCatcher"
    ]);
    this.proxy = new Proxy(this, {
      /**
       * 1. TRAPS FOR EXTERNAL TOOLS (React, DevTools, JSON.stringify)
       * This prevents the "cyclic object value" error.
       */
      get: (target, prop) => {
        if (prop === "toJSON") return () => target.catcher;
        if (prop === "constructor") return _RuntimeChain;
        if (prop === Symbol.toStringTag) return "RuntimeChain";
        if (prop === "_isChain") return true;
        if (typeof prop !== "string") return target[prop];
        if (prop in target && PUBLIC_METHODS2.has(prop)) {
          const val = target[prop];
          return typeof val === "function" ? val.bind(target) : val;
        }
        if (prop in target && typeof target[prop] === "function") {
          if (debugMode2) {
            console.warn(`[ChainCSS] '${prop}' is an internal method, not part of the public API`);
          }
          return void 0;
        }
        const realProp = shorthandMap[prop] || prop;
        if (runtimeMacros[prop]) {
          return (val) => {
            runtimeMacros[prop](val, target.catcher, target.useTokens);
            return target.proxy;
          };
        }
        return (val) => {
          let finalVal = val;
          let valueWithUnit = val;
          const unitless = ["opacity", "zIndex", "flex", "fontWeight", "flexGrow", "flexShrink", "flexBasis", "order", "lineHeight", "animationIterationCount", "orphans", "widows", "columnCount"];
          if (typeof finalVal === "number" && !unitless.includes(realProp)) {
            valueWithUnit = `${val}px`;
            finalVal = valueWithUnit;
          }
          const lookupKey = `${realProp}:${valueWithUnit}`;
          const staticClass = globalManifest[lookupKey];
          if (staticClass) {
            if (!target.catcher._classes.includes(staticClass)) {
              target.catcher._classes.push(staticClass);
              if (debugMode2) {
                console.log(`[ChainCSS] Using atomic class: ${staticClass} for ${lookupKey}`);
              }
            }
          } else {
            if (debugMode2) {
              console.log(`[ChainCSS] No atomic class for ${lookupKey}, will inject at runtime`);
            }
            target.catcher[realProp] = finalVal;
          }
          return target.proxy;
        };
      }
    });
  }
  useTokens;
  // catcher now tracks both raw styles and pre-baked class names
  catcher = { _classes: [] };
  componentName = "";
  proxy;
  use(plugin) {
    const { selectors, atRules, ...styles3 } = plugin;
    Object.entries(styles3).forEach(([key, val]) => {
      const realProp = shorthandMap[key] || key;
      this.catcher[realProp] = val;
    });
    return this.proxy;
  }
  hover() {
    const hoverCatcher = { _classes: [] };
    const hoverHandler = {
      get: (_, prop) => {
        if (prop === "end") {
          return () => {
            this.catcher.hover = { ...this.catcher.hover, ...hoverCatcher };
            return this.proxy;
          };
        }
        const realProp = shorthandMap[prop] || prop;
        return (val) => {
          const lookupKey = `hover:${realProp}:${val}`;
          const staticClass = globalManifest[lookupKey];
          if (staticClass) {
            if (!hoverCatcher._classes.includes(staticClass)) {
              hoverCatcher._classes.push(staticClass);
            }
          } else if (runtimeMacros[prop]) {
            runtimeMacros[prop](val, hoverCatcher, this.useTokens);
          } else {
            hoverCatcher[realProp] = val;
          }
          return hoverProxy;
        };
      }
    };
    const hoverProxy = new Proxy({}, hoverHandler);
    return hoverProxy;
  }
  /**
   * Set the component name for class generation
   */
  $name(name) {
    this.componentName = name;
    return this;
  }
  /**
   * Finalizes the chain. Returns the style object and resets the catcher.
   */
  $el(name) {
    const result = structuredClone(this.catcher);
    result._name = name || this.componentName || "element";
    delete result._componentName;
    delete result._generateComponent;
    delete result._framework;
    delete result._propsDefinition;
    this.catcher = { _classes: [] };
    this.componentName = "";
    return result;
  }
  end(name) {
    return this.$el(name);
  }
  /**
   * Get the current catcher (for debugging)
   */
  getCatcher() {
    return { ...this.catcher };
  }
};
var $ = () => new RuntimeChain(false).proxy;
var $t = () => new RuntimeChain(true).proxy;
var chain = (useTokens = false) => new RuntimeChain(useTokens).proxy;

// src/runtime/react.tsx
import React, { useMemo, useRef, useState, useEffect } from "react";
import { Fragment, jsx } from "react/jsx-runtime";
function hashStyleObject(obj) {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}
function useChainStyles(styles3, deps = [], options = {}) {
  const { namespace = "c", debug = false, ssr = false } = options;
  const instanceId = useRef(Math.random().toString(36).substring(2, 7));
  const moduleId = useRef(`chaincss-module-${instanceId.current}`);
  const [forceUpdate, setForceUpdate] = useState(0);
  useEffect(() => {
    return () => {
      if (!ssr && moduleId.current) {
        removeRuntimeModule(moduleId.current);
        if (debug) {
          console.log(`[ChainCSS] Cleaned up module: ${moduleId.current}`);
        }
      }
    };
  }, [ssr]);
  return useMemo(() => {
    const finalClassMap = {};
    const injectionBundle = {};
    for (const [key, styleDef] of Object.entries(styles3)) {
      let styleObject = {};
      if (styleDef && typeof styleDef.$el === "function") {
        styleObject = styleDef.$el();
        if (debug) {
          console.log(`[ChainCSS] Processing style: ${key}`, styleObject);
        }
      } else if (styleDef && typeof styleDef === "object") {
        styleObject = { ...styleDef };
      }
      const staticClasses = Array.isArray(styleObject._classes) ? styleObject._classes : [];
      const internalKeys = ["catcher", "proxy", "useTokens", "componentName", "_isChain", "_classes", "_name"];
      internalKeys.forEach((k) => delete styleObject[k]);
      const hash = hashStyleObject(styleObject);
      const dynamicClassName = `${namespace}-${key}-${hash}`;
      const hasStyles = Object.keys(styleObject).length > 0;
      if (!ssr && hasStyles) {
        injectionBundle[dynamicClassName] = styleObject;
      }
      const classParts = [...staticClasses];
      if (hasStyles) {
        classParts.push(dynamicClassName);
      }
      finalClassMap[key] = classParts.join(" ").trim();
    }
    if (!ssr && Object.keys(injectionBundle).length > 0) {
      compileRuntime(injectionBundle, moduleId.current);
      if (debug) {
        console.log(`[ChainCSS] Injected ${Object.keys(injectionBundle).length} styles for module ${moduleId.current}`);
      }
    }
    return finalClassMap;
  }, [forceUpdate, ...deps]);
}
function useDynamicChainStyles(styleFactory, deps = [], options) {
  const styles3 = useMemo(() => styleFactory(), deps);
  return useChainStyles(styles3, deps, options);
}
function useThemeChainStyles(styles3, theme, options) {
  const themedStyles = useMemo(() => {
    if (typeof styles3 === "function") return styles3(theme);
    return styles3;
  }, [styles3, theme]);
  return useChainStyles(themedStyles, [theme], options);
}
function ChainCSSGlobal({ styles: styles3, tokens: tokens2, children }) {
  if (tokens2) {
    setTokens(tokens2);
  }
  if (styles3) {
    useChainStyles(styles3, [], { watch: true });
  }
  return /* @__PURE__ */ jsx(Fragment, { children });
}
function cx(...classes) {
  const result = [];
  for (const cls of classes) {
    if (!cls) continue;
    if (typeof cls === "string") {
      result.push(cls);
    } else if (typeof cls === "object") {
      for (const [key, value] of Object.entries(cls)) {
        if (value) result.push(key);
      }
    }
  }
  return result.join(" ");
}
function withChainStyles(styles3, options) {
  return function WrappedComponent(props) {
    const styleProps = typeof styles3 === "function" ? styles3(props) : styles3;
    const classNames = useChainStyles(styleProps, [], options);
    const Component = props.component || props.wrappedComponent;
    return /* @__PURE__ */ jsx(Component, { ...props, chainStyles: classNames });
  };
}
function createStyledComponent(elementType, styles3, options) {
  const StyledComponent = (props) => {
    const { className: additionalClassName, ...rest } = props;
    const styleDef = typeof styles3 === "function" ? styles3() : styles3;
    const classNames = useChainStyles({ root: styleDef }, [], options);
    const combinedClassName = cx(classNames.root, additionalClassName);
    return React.createElement(elementType, {
      ...rest,
      className: combinedClassName
    });
  };
  const displayName = typeof elementType === "string" ? elementType : elementType.displayName || "Component";
  StyledComponent.displayName = `ChainCSS.${displayName}`;
  return StyledComponent;
}
function useComputedStyles(styles3, props, deps = [], options) {
  const computedStyles = useMemo(() => styles3(props), [props, ...deps]);
  return useChainStyles(computedStyles, deps, options);
}
var debugEnabled = false;
function enableChainCSSDebug() {
  debugEnabled = true;
  if (typeof window !== "undefined") {
    window.__CHAINCSS_DEBUG__ = true;
    console.log("\u{1F50D} ChainCSS Debug Mode Enabled");
  }
}
function disableChainCSSDebug() {
  debugEnabled = false;
  if (typeof window !== "undefined") {
    window.__CHAINCSS_DEBUG__ = false;
    console.log("\u{1F50D} ChainCSS Debug Mode Disabled");
  }
}
function isDebugEnabled() {
  return debugEnabled || typeof window !== "undefined" && window.__CHAINCSS_DEBUG__;
}

// src/runtime/vue.ts
import { ref, computed, watch, onUnmounted, inject, provide, h } from "vue";
var CHAIN_CSS_KEY = /* @__PURE__ */ Symbol("chaincss");
function useAtomicClasses(styles3, options = {}) {
  const { atomic = true, global = false, debug = false } = options;
  const id = `chain-${Math.random().toString(36).substring(2, 11)}`;
  const moduleId = `chaincss-vue-module-${id}`;
  const classMap = ref({});
  onUnmounted(() => {
    removeRuntimeModule(moduleId);
    if (debug) {
      console.log(`[ChainCSS Vue] Cleaned up module: ${moduleId}`);
    }
  });
  const compileStyles = () => {
    const resolvedStyles = typeof styles3 === "function" ? styles3() : styles3?.value || styles3;
    if (!resolvedStyles) return {};
    const compiledStyles = {};
    const classNames = {};
    for (const [key, styleDef] of Object.entries(resolvedStyles)) {
      const className = `${key}-${id}`;
      const styleObj = typeof styleDef === "function" ? styleDef() : styleDef;
      classNames[key] = className;
      compiledStyles[`${key}_${id}`] = {
        selectors: [`.${className}`],
        ...styleObj
      };
    }
    const result = compileRuntime(compiledStyles, moduleId);
    if (debug) {
      console.log(`[ChainCSS Vue] Compiled ${Object.keys(classNames).length} styles for module ${moduleId}`);
    }
    classMap.value = classNames;
    return result;
  };
  if (typeof styles3 === "object" && styles3 !== null && "value" in styles3) {
    watch(styles3, () => {
      compileStyles();
    }, { deep: true });
  }
  compileStyles();
  return {
    classes: computed(() => classMap.value),
    cx: (name) => classMap.value[name] || "",
    cn: (...names) => names.map((name) => classMap.value[name]).filter(Boolean).join(" "),
    inject: (newStyles) => {
      const injectedId = `chaincss-injected-${Date.now()}`;
      compileRuntime(newStyles, injectedId);
      if (debug) {
        console.log(`[ChainCSS Vue] Injected additional styles: ${injectedId}`);
      }
    }
  };
}
var ChainCSSGlobal2 = {
  name: "ChainCSSGlobal",
  props: {
    styles: {
      type: Object,
      required: false,
      default: () => ({})
    },
    tokens: {
      type: Object,
      required: false,
      default: () => ({})
    },
    debug: {
      type: Boolean,
      default: false
    }
  },
  setup(props) {
    if (props.tokens && Object.keys(props.tokens).length > 0) {
      styleInjector.setTokens(props.tokens);
    }
    if (props.styles && Object.keys(props.styles).length > 0) {
      useAtomicClasses(props.styles, { debug: props.debug });
    }
    return () => null;
  }
};
function createStyledComponent2(styles3, tag = "div", options = {}) {
  return {
    name: "ChainCSSStyledComponent",
    props: {
      className: { type: String, default: "" },
      as: { type: String, default: tag }
    },
    setup(props, { slots, attrs }) {
      const resolvedStyles = typeof styles3 === "function" ? styles3() : styles3;
      const { classes } = useAtomicClasses({ root: resolvedStyles }, options);
      const combinedClass = computed(() => {
        const rootClass = classes.value?.root || "";
        return [rootClass, props.className].filter(Boolean).join(" ");
      });
      return () => {
        return h(props.as || tag, {
          class: combinedClass.value,
          ...attrs
        }, slots.default?.());
      };
    }
  };
}
function createStyledComponents(components, options) {
  const result = {};
  for (const [name, config] of Object.entries(components)) {
    const { element = "div", styles: styles3 } = config;
    result[name] = createStyledComponent2(styles3, element, options);
  }
  return result;
}
function useComputedStyles2(styles3, props, options) {
  const computedStyles = computed(() => ({ root: styles3(props) }));
  const { classes } = useAtomicClasses(computedStyles, options);
  return {
    classes,
    rootClass: computed(() => classes.value?.root || "")
  };
}
function provideStyleContext(theme) {
  const themeRef = ref(theme);
  provide(CHAIN_CSS_KEY, themeRef);
  return themeRef;
}
function injectStyleContext() {
  return inject(CHAIN_CSS_KEY, ref({}));
}

// src/runtime/svelte.ts
function useAtomicClasses2() {
  return { subscribe: () => {
  }, get: () => ({}) };
}
function cx2(...args) {
  return args.filter(Boolean).join(" ");
}
function ChainCSSGlobal3() {
  return null;
}
function createStyledComponent3() {
  return () => null;
}
function createStyledComponents2() {
  return {};
}
function useComputedStyles3() {
  return { subscribe: () => {
  }, get: () => "" };
}
function provideStyleContext2() {
}
function injectStyleContext2() {
  return {};
}
function chainStyles() {
  return {};
}

// src/runtime/hmr.ts
function getHMREnvironment() {
  if (typeof window === "undefined") return "none";
  if (typeof import.meta !== "undefined" && import.meta.hot) {
    return "vite";
  }
  if (module.hot) {
    return "webpack";
  }
  return "none";
}
function setupHMR() {
  const env = getHMREnvironment();
  if (env === "vite") {
    setupViteHMR();
  } else if (env === "webpack") {
    setupWebpackHMR();
  }
}
function setupViteHMR() {
  if (typeof window === "undefined") return;
  const hot = import.meta.hot;
  if (!hot) return;
  hot.on("chaincss:update", (payload) => {
    console.log(`[ChainCSS HMR] \u{1F504} Updating styles for ${payload.file}`);
    if (payload.css) {
      const styleId = "chaincss-hmr-styles";
      let styleElement = document.getElementById(styleId);
      if (!styleElement) {
        styleElement = document.createElement("style");
        styleElement.id = styleId;
        styleElement.setAttribute("data-chaincss", "hmr");
        document.head.appendChild(styleElement);
      }
      styleElement.textContent = payload.css;
      console.log(`[ChainCSS HMR] \u2705 Injected ${payload.css.length} bytes of CSS`);
    }
    if (payload.map) {
      if (typeof window !== "undefined") {
        window.__CHAINCSS_MANIFEST__ = payload.map;
      }
      console.log(`[ChainCSS HMR] \u2705 Updated manifest with ${Object.keys(payload.map).length} entries`);
    }
    if (payload.styles) {
      const moduleId = `hmr-${payload.file}-${payload.timestamp || Date.now()}`;
      const result = compileRuntime(payload.styles, moduleId);
      console.log(`[ChainCSS HMR] \u2705 Recompiled ${Object.keys(result).length} styles`);
    }
  });
  hot.on("vite:beforeUpdate", () => {
    console.log("[ChainCSS HMR] \u{1F9F9} Clearing runtime styles before update");
    styleInjector.removeAll();
  });
  console.log("[ChainCSS HMR] \u2705 Vite HMR setup complete");
}
function setupWebpackHMR() {
  if (typeof window === "undefined") return;
  const hot = module.hot;
  if (!hot) return;
  hot.accept((err) => {
    if (err) {
      console.error("[ChainCSS HMR] \u274C Update failed:", err);
      return;
    }
    console.log("[ChainCSS HMR] \u{1F504} Webpack HMR update");
    styleInjector.removeAll();
  });
  hot.dispose(() => {
    console.log("[ChainCSS HMR] \u{1F9F9} Cleaning up styles");
    styleInjector.removeAll();
  });
  console.log("[ChainCSS HMR] \u2705 Webpack HMR setup complete");
}
function registerForHMR(moduleId, styles3, callback) {
  const env = getHMREnvironment();
  if (env === "vite") {
    registerViteHMR(moduleId, styles3, callback);
  } else if (env === "webpack") {
    registerWebpackHMR(moduleId, styles3, callback);
  }
}
function registerViteHMR(moduleId, styles3, callback) {
  const hot = import.meta.hot;
  if (!hot) return;
  hot.accept(() => {
    console.log(`[ChainCSS HMR] \u{1F504} Accepting update for ${moduleId}`);
    styleInjector.removeModule(moduleId);
    if (callback && styles3) {
      callback(styles3);
    }
  });
  hot.dispose(() => {
    console.log(`[ChainCSS HMR] \u{1F9F9} Disposing module: ${moduleId}`);
    styleInjector.removeModule(moduleId);
  });
}
function registerWebpackHMR(moduleId, styles3, callback) {
  const hot = module.hot;
  if (!hot) return;
  hot.accept(() => {
    console.log(`[ChainCSS HMR] \u{1F504} Webpack HMR accept for ${moduleId}`);
    if (callback && styles3) {
      callback(styles3);
    }
  });
  hot.dispose(() => {
    console.log(`[ChainCSS HMR] \u{1F9F9} Webpack HMR dispose for ${moduleId}`);
    styleInjector.removeModule(moduleId);
  });
}
if (typeof window !== "undefined") {
  setupHMR();
}

// src/runtime/utils.ts
function generateStyleId(prefix = "chain") {
  const random = Math.random().toString(36).substring(2, 10);
  const timestamp = Date.now().toString(36);
  return `${prefix}-${timestamp}-${random}`;
}
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
function kebabCase2(str) {
  return str.replace(/([A-Z])/g, "-$1").toLowerCase();
}
var isBrowser = typeof window !== "undefined" && typeof document !== "undefined";
var isDevelopment = true;
var isProduction = false;
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}
function memoize(fn) {
  const cache = /* @__PURE__ */ new Map();
  const memoized = ((...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }
    const result = fn(...args);
    cache.set(key, result);
    return result;
  });
  memoized.cache = cache;
  return memoized;
}
function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}
function devWarn(message, ...args) {
  if (isDevelopment) {
    console.warn(`[ChainCSS] ${message}`, ...args);
  }
}
function devLog(message, ...args) {
  if (isDevelopment) {
    console.log(`[ChainCSS] ${message}`, ...args);
  }
}
function logError(message, error) {
  console.error(`[ChainCSS] ${message}`, error || "");
}
function createDebugger(module2) {
  return {
    log: (...args) => devLog(`[${module2}]`, ...args),
    warn: (...args) => devWarn(`[${module2}]`, ...args),
    error: (...args) => logError(`[${module2}]`, ...args)
  };
}
export {
  $,
  $t,
  ChainCSSGlobal,
  ChainCSSGlobal3 as ChainCSSGlobalSvelte,
  ChainCSSGlobal2 as ChainCSSGlobalVue,
  chain,
  chainStyles,
  cn as cnUtils,
  compileRuntime as compile,
  createDebugger,
  createStyledComponent,
  createStyledComponent3 as createStyledSvelteComponent,
  createStyledComponents2 as createStyledSvelteComponents,
  createStyledComponent2 as createStyledVueComponent,
  createStyledComponents as createStyledVueComponents,
  cx,
  cx2 as cxSvelte,
  debounce,
  devLog,
  devWarn,
  disableChainCSSDebug,
  enableChainCSSDebug,
  generateStyleId,
  hashString,
  injectStyleContext,
  injectStyleContext2 as injectStyleContextSvelte,
  isBrowser,
  isDebugEnabled,
  isDevelopment,
  isProduction,
  kebabCase2 as kebabCase,
  logError,
  memoize,
  provideStyleContext,
  provideStyleContext2 as provideStyleContextSvelte,
  registerForHMR,
  runRuntime as run,
  setManifest,
  setupHMR,
  styleInjector,
  useAtomicClasses,
  useAtomicClasses2 as useAtomicClassesSvelte,
  useChainStyles,
  useComputedStyles,
  useComputedStyles3 as useComputedStylesSvelte,
  useComputedStyles2 as useComputedStylesVue,
  useDynamicChainStyles,
  useThemeChainStyles,
  withChainStyles
};
