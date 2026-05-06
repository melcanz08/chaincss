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
function isShorthand(prop) {
  return prop in shorthandMap || prop in macros;
}
function expandShorthand(prop) {
  return shorthandMap[prop] || null;
}
function getAvailableShorthands() {
  return [...Object.keys(shorthandMap), ...Object.keys(macros)];
}

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
function getSuggestions(prop, validProperties = [], maxResults = 3) {
  const candidates = [.../* @__PURE__ */ new Set([
    ...KNOWN_SHORTHANDS,
    ...COMMON_CSS_PROPERTIES,
    ...validProperties,
    ...ANIMATION_PRESETS,
    ...BREAKPOINTS
  ])];
  return findBestMatches(prop, candidates, maxResults, 4);
}
function getPropertySuggestion(prop, context) {
  const contextProperties = {
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
      "rotate"
    ],
    color: [
      "color",
      "background-color",
      "border-color",
      "outline-color",
      "fill",
      "stroke",
      "box-shadow",
      "text-shadow"
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
      "word-spacing"
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
      "overflow"
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
      "transition-duration"
    ]
  };
  const candidates = context && contextProperties[context] ? contextProperties[context] : COMMON_CSS_PROPERTIES;
  const matches = findBestMatches(prop, candidates, 1, 2);
  return matches.length > 0 ? matches[0].name : null;
}
function getShorthandSuggestion(shorthand) {
  const shorthandMap2 = {
    "m": { property: "margin", description: "Sets margin on all sides" },
    "mt": { property: "margin-top", description: "Sets top margin" },
    "mr": { property: "margin-right", description: "Sets right margin" },
    "mb": { property: "margin-bottom", description: "Sets bottom margin" },
    "ml": { property: "margin-left", description: "Sets left margin" },
    "p": { property: "padding", description: "Sets padding on all sides" },
    "pt": { property: "padding-top", description: "Sets top padding" },
    "pr": { property: "padding-right", description: "Sets right padding" },
    "pb": { property: "padding-bottom", description: "Sets bottom padding" },
    "pl": { property: "padding-left", description: "Sets left padding" },
    "mx": { property: "margin-left/right", description: "Sets horizontal margins" },
    "my": { property: "margin-top/bottom", description: "Sets vertical margins" },
    "px": { property: "padding-left/right", description: "Sets horizontal padding" },
    "py": { property: "padding-top/bottom", description: "Sets vertical padding" },
    "d": { property: "display", description: "Sets display property" },
    "pos": { property: "position", description: "Sets position property" },
    "w": { property: "width", description: "Sets width" },
    "h": { property: "height", description: "Sets height" },
    "bg": { property: "background", description: "Sets background color/image" },
    "c": { property: "color", description: "Sets text color" },
    "fs": { property: "font-size", description: "Sets font size" },
    "fw": { property: "font-weight", description: "Sets font weight" },
    "flex": { property: "display: flex", description: "Creates a flex container" },
    "grid": { property: "display: grid", description: "Creates a grid container" }
  };
  const match = shorthandMap2[shorthand];
  if (match) {
    return {
      suggestion: match.property,
      explanation: match.description
    };
  }
  const matches = findBestMatches(shorthand, Object.keys(shorthandMap2), 1, 2);
  if (matches.length > 0) {
    const best = matches[0];
    const matchInfo = shorthandMap2[best.name];
    if (matchInfo) {
      return {
        suggestion: `${best.name} \u2192 ${matchInfo.property}`,
        explanation: matchInfo.description
      };
    }
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
  get(path6, defaultValue = "") {
    if (this.tokenCache.has(path6)) {
      return this.tokenCache.get(path6);
    }
    let value;
    if (path6 in this.customFlattened) {
      value = this.customFlattened[path6];
    }
    if (value === void 0 && path6 in this.defaultFlattened) {
      value = this.defaultFlattened[path6];
    }
    if (value && value.startsWith("$")) {
      const refPath = value.substring(1);
      value = this.get(refPath, defaultValue);
    }
    const result = value !== void 0 ? value : defaultValue;
    this.tokenCache.set(path6, result);
    return result;
  }
  // Get token with type safety
  getColor(path6, defaultValue = "#000000") {
    return this.get(`colors.${path6}`, defaultValue);
  }
  getSpacing(path6, defaultValue = "0") {
    return this.get(`spacing.${path6}`, defaultValue);
  }
  getFontSize(path6, defaultValue = "1rem") {
    return this.get(`typography.fontSize.${path6}`, defaultValue);
  }
  getFontWeight(path6, defaultValue = "400") {
    return this.get(`typography.fontWeight.${path6}`, defaultValue);
  }
  getLineHeight(path6, defaultValue = "1.5") {
    return this.get(`typography.lineHeight.${path6}`, defaultValue);
  }
  getBreakpoint(path6, defaultValue = "768px") {
    return this.get(`breakpoints.${path6}`, defaultValue);
  }
  getZIndex(path6, defaultValue = "0") {
    return this.get(`zIndex.${path6}`, defaultValue);
  }
  getShadow(path6, defaultValue = "none") {
    return this.get(`shadows.${path6}`, defaultValue);
  }
  getBorderRadius(path6, defaultValue = "0") {
    return this.get(`borderRadius.${path6}`, defaultValue);
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
  has(path6) {
    return path6 in this.customFlattened || path6 in this.defaultFlattened;
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
    for (const [path6, value] of Object.entries(overrides)) {
      const parts = path6.split(".");
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
  merge(tokens3) {
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
    deepMerge(merged, tokens3);
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
function createTokens(customTokens) {
  return new DesignTokens(customTokens);
}

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
    return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match, path6) => {
      const resolved = resolveTokenPath(path6, tokenContext);
      if (resolved !== void 0 && resolved !== null) {
        return String(resolved);
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[ChainCSS] Token not found: ${path6}`);
      }
      return match;
    });
  }
  return value;
}
function resolveTokenPath(path6, tokenContext) {
  let resolved = null;
  if (tokenContext && typeof tokenContext.get === "function") {
    resolved = tokenContext.get(path6);
  }
  if ((resolved === void 0 || resolved === null) && currentTokenContext) {
    resolved = currentTokenContext.get(path6);
  }
  if (resolved === void 0 || resolved === null) {
    if (tokens && typeof tokens.get === "function") {
      resolved = tokens.get(path6);
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
function setBreakpoints(breakpoints) {
  currentBreakpoints = { ...DEFAULT_BREAKPOINTS, ...breakpoints };
}

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
function getAnimationPreset(name) {
  return animationPresets[name];
}
function hasAnimationPreset(name) {
  return name in animationPresets;
}
function getAnimationPresetNames() {
  return Object.keys(animationPresets);
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
  url: (path6) => {
    return `url(${path6})`;
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

// src/compiler/Chain.ts
import chalk from "chalk";
var currentTokenContext2 = null;
function setTokenContext(context) {
  currentTokenContext2 = context;
}
var debugMode = false;
function enableDebug(enable = true) {
  debugMode = enable;
  if (enable) {
    console.log("\u{1F50D} ChainCSS Debug Mode Enabled");
  }
}
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
        chalk.blue(`[ChainCSS Debug]`),
        chalk.gray(displayProp),
        "->",
        chalk.green(resolvedValue)
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
    const styles = structuredClone(this.catcher);
    delete styles._componentName;
    delete styles._generateComponent;
    delete styles._framework;
    delete styles._propsDefinition;
    if (this.catcher._transforms) {
      const t = this.catcher._transforms;
      const transformString = Object.entries(t).map(([k, v]) => {
        const needsUnit = k.includes("translate") || k === "x" || k === "y";
        const unit = needsUnit && typeof v === "number" ? "px" : "";
        return `${k}(${v}${unit})`;
      }).join(" ");
      styles.transform = transformString;
      delete styles._transforms;
    }
    if (this.catcher.nestedRules) {
      styles.nestedRules = structuredClone(this.catcher.nestedRules);
    }
    for (const key of Object.keys(styles)) {
      if (key.startsWith("&:")) {
        const pseudoSelector = key.substring(1);
        styles[pseudoSelector] = styles[key];
        delete styles[key];
      }
    }
    this.clear();
    if (selectors.length === 0) return styles;
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
      ...styles
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
    const { selectors, atRules, ...styles } = mixin;
    Object.assign(this.catcher, styles);
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
var chain = (useTokens = true) => createChain(useTokens);

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
    const { selectors, atRules, ...styles } = plugin;
    Object.entries(styles).forEach(([key, val]) => {
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
var $t = () => new RuntimeChain(true).proxy;

// src/core/auto-detector.ts
var AutoDetector = class _AutoDetector {
  static instance;
  dynamicPatterns = [
    /\$\{.*\}/,
    // Template literals: ${variable}
    /props\.[a-zA-Z]+/,
    // Props access: props.color
    /theme\.[a-zA-Z]+/,
    // Theme access: theme.primary
    /state\.[a-zA-Z]+/,
    // State access: state.isActive
    /this\.[a-zA-Z]+/,
    // This binding
    /useContext\(/,
    // React hook
    /useSelector\(/,
    // Redux selector
    /getState\(/
    // Store getter
  ];
  staticPatterns = [
    /^#[0-9a-f]{3,6}$/i,
    // Hex colors
    /^[a-z]+$/,
    // Simple words (red, blue, flex)
    /^\d+(?:\.\d+)?(?:px|rem|em|%)?$/
    // Numbers with optional units
  ];
  debug = false;
  static getInstance() {
    if (!_AutoDetector.instance) {
      _AutoDetector.instance = new _AutoDetector();
    }
    return _AutoDetector.instance;
  }
  enableDebug(enabled) {
    this.debug = enabled;
  }
  detectValueType(value, prop) {
    if (typeof value === "function") {
      if (this.debug) console.log(`[AutoDetector] Function detected for ${prop} -> runtime-only`);
      return "runtime-only";
    }
    if (value === void 0 || value === null) {
      return "static";
    }
    if (typeof value === "object" && value !== null) {
      if (this.debug) console.log(`[AutoDetector] Object detected for ${prop} -> dynamic`);
      return "dynamic";
    }
    if (typeof value === "string") {
      for (const pattern of this.staticPatterns) {
        if (pattern.test(value)) {
          if (this.debug) console.log(`[AutoDetector] Static pattern matched for ${prop}: ${value}`);
          return "static";
        }
      }
      for (const pattern of this.dynamicPatterns) {
        if (pattern.test(value)) {
          if (this.debug) console.log(`[AutoDetector] Dynamic pattern matched for ${prop}: ${value}`);
          return "dynamic";
        }
      }
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return "static";
    }
    return "static";
  }
  analyzeChain(calls) {
    const staticParts = [];
    const dynamicParts = [];
    const runtimeOnlyParts = [];
    for (const call of calls) {
      const type = this.detectValueType(call.value, call.prop);
      const part = {
        type,
        prop: call.prop,
        value: call.value,
        originalValue: call.value,
        index: call.index
      };
      switch (type) {
        case "static":
          staticParts.push(part);
          break;
        case "dynamic":
          dynamicParts.push(part);
          break;
        case "runtime-only":
          runtimeOnlyParts.push(part);
          break;
      }
    }
    const isHybrid = staticParts.length > 0 && (dynamicParts.length > 0 || runtimeOnlyParts.length > 0);
    let mode = "build";
    if (isHybrid) {
      mode = "hybrid";
    } else if (dynamicParts.length > 0 || runtimeOnlyParts.length > 0) {
      mode = "runtime";
    } else {
      mode = "build";
    }
    if (this.debug) {
      console.log("[AutoDetector] Analysis:", {
        static: staticParts.length,
        dynamic: dynamicParts.length,
        runtimeOnly: runtimeOnlyParts.length,
        mode,
        isHybrid
      });
    }
    return {
      staticParts,
      dynamicParts,
      runtimeOnlyParts,
      isHybrid,
      mode
    };
  }
  addDynamicPattern(pattern) {
    this.dynamicPatterns.push(pattern);
    if (this.debug) console.log(`[AutoDetector] Added dynamic pattern: ${pattern}`);
  }
  addStaticPattern(pattern) {
    this.staticPatterns.push(pattern);
    if (this.debug) console.log(`[AutoDetector] Added static pattern: ${pattern}`);
  }
  reset() {
    this.dynamicPatterns = [
      /\$\{.*\}/,
      /props\.[a-zA-Z]+/,
      /theme\.[a-zA-Z]+/,
      /state\.[a-zA-Z]+/,
      /this\.[a-zA-Z]+/,
      /useContext\(/,
      /useSelector\(/,
      /getState\(/
    ];
    this.staticPatterns = [
      /^#[0-9a-f]{3,6}$/i,
      /^[a-z]+$/,
      /^\d+(?:\.\d+)?(?:px|rem|em|%)?$/
    ];
  }
};
var autoDetector = AutoDetector.getInstance();

// src/core/smart-chain.ts
var SmartChainProxy = class {
  calls = [];
  callIndex = 0;
  useTokens;
  MAX_CALLS = 500;
  // Safety cap
  constructor(useTokens = true) {
    this.useTokens = useTokens;
  }
  recordCall(prop, ...args) {
    if (this.calls.length >= this.MAX_CALLS) {
      console.warn("\u26A0\uFE0F ChainCSS: Smart chain call limit reached. Consider using build chain for static styles.");
      return this;
    }
    this.calls.push({
      prop,
      value: args[0],
      args,
      index: this.callIndex++
    });
    return this;
  }
  processHybrid(analysis, selectors) {
    const buildInstance = chain(this.useTokens);
    const runtimeInstance = new RuntimeChain(this.useTokens).proxy;
    for (const part of analysis.staticParts) {
      const call = this.calls[part.index];
      if (call && buildInstance[call.prop]) {
        buildInstance[call.prop](...call.args);
      }
    }
    const allDynamic = [...analysis.dynamicParts, ...analysis.runtimeOnlyParts];
    for (const part of allDynamic) {
      const call = this.calls[part.index];
      if (call && runtimeInstance[call.prop]) {
        runtimeInstance[call.prop](...call.args);
      }
    }
    const buildResult = buildInstance.$el(...selectors);
    const runtimeResult = runtimeInstance.$el(...selectors);
    return {
      ...typeof buildResult === "object" ? buildResult : {},
      ...typeof runtimeResult === "object" ? runtimeResult : {},
      __buildClasses: buildResult,
      __runtimeClasses: runtimeResult,
      __isHybrid: true
    };
  }
  processPureBuild(selectors) {
    const buildInstance = chain(this.useTokens);
    for (const call of this.calls) {
      if (buildInstance[call.prop]) {
        buildInstance[call.prop](...call.args);
      }
    }
    return buildInstance.$el(...selectors);
  }
  processPureRuntime(selectors) {
    const runtimeInstance = new RuntimeChain(this.useTokens).proxy;
    for (const call of this.calls) {
      if (runtimeInstance[call.prop]) {
        runtimeInstance[call.prop](...call.args);
      }
    }
    return runtimeInstance.$el(...selectors);
  }
  $el(...selectors) {
    if (this.calls.length === 0) {
      return {};
    }
    const callsWithIndex = this.calls.map((call, idx) => ({
      prop: call.prop,
      value: call.value,
      index: idx
    }));
    const analysis = autoDetector.analyzeChain(callsWithIndex);
    if (this.calls[0]?.prop === "__isSmartChain") {
      return this.processPureRuntime(selectors);
    }
    let result;
    switch (analysis.mode) {
      case "hybrid":
        result = this.processHybrid(analysis, selectors);
        break;
      case "runtime":
        result = this.processPureRuntime(selectors);
        break;
      case "build":
      default:
        result = this.processPureBuild(selectors);
        break;
    }
    this.calls = [];
    this.callIndex = 0;
    return result;
  }
  getProxy() {
    const proxy = new Proxy(this, {
      get(target, prop) {
        if (prop === "__isSmartChain") return true;
        if (prop === "$el") return target.$el.bind(target);
        if (prop === "then") return void 0;
        return (...args) => {
          target.recordCall(prop, ...args);
          return proxy;
        };
      }
    });
    return proxy;
  }
};
function smartChain(useTokens = true) {
  const proxy = new SmartChainProxy(useTokens);
  return proxy.getProxy();
}
var buildChain = (useTokens) => chain(useTokens);
var runtimeChain = (useTokens) => new RuntimeChain(useTokens || true).proxy;

// src/runtime/auto-hooks.tsx
import React, { useEffect, useRef, useState } from "react";

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
  setTokens(tokens3) {
    if (this.debugMode) {
      console.log("[ChainCSS] Tokens set:", Object.keys(tokens3));
    }
    Object.assign(this.tokenStore, tokens3);
  }
  /**
   * Get a token value by path
   */
  getToken(path6) {
    const parts = path6.split(".");
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
    return value.replace(/\$([a-zA-Z0-9.-]+)/g, (match, path6) => {
      const tokenValue = this.getToken(path6);
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
  injectMultiple(styles, moduleId) {
    const result = {};
    let newCSS = "";
    const moduleClasses = /* @__PURE__ */ new Set();
    for (const [name, style] of Object.entries(styles)) {
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
function runRuntime(...styles) {
  let css = "";
  for (const style of styles) {
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

// src/runtime/auto-hooks.tsx
function useSmartStyles(styleBuilder, deps = [], options = {}) {
  const moduleId = useRef(options.moduleId || `smart-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
  const [classMap, setClassMap] = useState({});
  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    if (moduleId.current) {
      styleInjector.removeModule(moduleId.current);
    }
    const chainInstance = smartChain();
    const result = styleBuilder(chainInstance);
    if (result && result.__isHybrid) {
      const hybrid = result;
      if (hybrid.__runtimeClasses && typeof hybrid.__runtimeClasses === "object") {
        const dynamicMap = compileRuntime(hybrid.__runtimeClasses, moduleId.current);
        if (isMounted.current) {
          setClassMap({
            ...typeof hybrid.__buildClasses === "object" ? hybrid.__buildClasses : {},
            ...dynamicMap
          });
        }
        if (options.debug) {
          console.log("[ChainCSS Smart] Hybrid styles - Static:", hybrid.__buildClasses, "Dynamic:", dynamicMap);
        }
      } else if (isMounted.current) {
        setClassMap(typeof hybrid === "object" ? hybrid : {});
      }
    } else if (result && typeof result === "object" && Object.keys(result).length > 0) {
      const needsInjection = Object.values(result).some(
        (v) => typeof v === "object" && v !== null && !String(v).startsWith("c-")
      );
      if (needsInjection && !options.ssr) {
        const injected = compileRuntime(result, moduleId.current);
        if (isMounted.current) {
          setClassMap(injected);
        }
      } else if (isMounted.current) {
        setClassMap(result);
      }
    }
    return () => {
      isMounted.current = false;
      if (moduleId.current) {
        styleInjector.removeModule(moduleId.current);
      }
    };
  }, deps);
  return classMap;
}
function createSmartComponent(Component, baseStyles) {
  const SmartComponent = (props) => {
    const styles = useSmartStyles((chain3) => {
      let instance = chain3();
      if (baseStyles) {
        instance = baseStyles(instance);
      }
      if (props.className) {
        instance = instance.className(props.className);
      }
      return instance.$el();
    }, [props.className]);
    return React.createElement(Component, {
      ...props,
      className: styles.root || props.className
    });
  };
  SmartComponent.displayName = `SmartComponent(${Component.displayName || Component.name || "Component"})`;
  return SmartComponent;
}
function withSmartStyles(WrappedComponent, styles) {
  const WithSmartStylesComponent = (props) => {
    const classMap = useSmartStyles(styles, []);
    return React.createElement(WrappedComponent, { ...props, ...classMap });
  };
  WithSmartStylesComponent.displayName = `WithSmartStyles(${WrappedComponent.displayName || WrappedComponent.name || "Component"})`;
  return WithSmartStylesComponent;
}

// src/core/compiler.ts
import fs6 from "fs";
import path5 from "path";
import crypto4 from "crypto";
import chalk3 from "chalk";
import { fileURLToPath, pathToFileURL } from "url";

// src/core/constants.ts
var VERSION = "2.0.0";
var NEVER_ATOMIC_PROPERTIES = [
  "content",
  "animation",
  "animation-name",
  "animation-duration",
  "animation-timing-function",
  "animation-delay",
  "animation-iteration-count",
  "animation-direction",
  "animation-fill-mode",
  "animation-play-state",
  "transition",
  "transition-property",
  "transition-duration",
  "transition-timing-function",
  "transition-delay",
  "keyframes",
  "counter-increment",
  "counter-reset",
  "counter-set",
  "list-style",
  "list-style-type",
  "list-style-position",
  "list-style-image",
  // Critical properties that should never be atomic
  "will-change",
  "backface-visibility",
  "perspective",
  "transform-style",
  "mix-blend-mode",
  "isolation",
  "contain",
  "content-visibility",
  "clip-path",
  "mask",
  "filter",
  "backdrop-filter"
];
var ALWAYS_ATOMIC_PROPERTIES = [
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
  "background-color",
  "background",
  "border",
  "border-radius",
  "width",
  "height",
  "max-width",
  "max-height",
  "min-width",
  "min-height",
  "font-size",
  "font-weight",
  "text-align",
  "cursor",
  "opacity",
  "z-index",
  "overflow",
  "flex",
  "grid",
  "gap"
];
var DEFAULT_BROWSERS = [
  "> 0.5%",
  "last 2 versions",
  "not dead",
  "Firefox ESR",
  "not ie < 11"
];
var DEFAULT_CSS_FILENAME = "styles.css";
var DEFAULT_CLASS_MAP_FILENAME = "class-map.json";
var DEFAULT_TYPES_FILENAME = "classes.d.ts";
var DEFAULT_CACHE_PATH = "./.chaincss-cache";
var PERFORMANCE = {
  MAX_CONCURRENT_COMPILATIONS: 10,
  BATCH_SIZE: 20,
  CACHE_PRUNE_INTERVAL_MS: 36e5,
  // 1 hour
  CACHE_MAX_ENTRIES: 1e3,
  MAX_MEMORY_USAGE_MB: 512,
  GC_THRESHOLD_MB: 400,
  COMPILE_TIMEOUT: 3e4,
  FILE_WATCH_TIMEOUT: 5e3,
  DEBOUNCE_WRITE_MS: 100,
  THROTTLE_COMPILE_MS: 50
};
var MEMORY = {
  CACHE_PRUNE_SIZE: 100 * 1024 * 1024,
  // 100MB
  MAX_STRING_BUFFER: 10 * 1024 * 1024,
  // 10MB
  BATCH_SIZE: 100,
  CLEANUP_INTERVAL_MS: 3e5,
  // 5 minutes
  CACHE_CHECK_INTERVAL_MS: 6e4,
  // 1 minute
  MEMORY_CHECK_INTERVAL_MS: 3e4
  // 30 seconds
};
var DEFAULT_CONFIG = {
  inputs: ["src/**/*.chain.{js,ts}", "src/**/*.tsx"],
  tokens: {
    enabled: true,
    prefix: "chain"
  },
  atomic: {
    enabled: true,
    threshold: 2,
    naming: process.env.NODE_ENV === "production" ? "hash" : "readable",
    cache: true,
    cachePath: DEFAULT_CACHE_PATH,
    minify: true,
    mode: "hybrid",
    outputStrategy: "component-first",
    alwaysAtomic: ALWAYS_ATOMIC_PROPERTIES,
    neverAtomic: NEVER_ATOMIC_PROPERTIES,
    verbose: false
  },
  prefixer: {
    enabled: true,
    mode: "auto",
    browsers: DEFAULT_BROWSERS,
    sourceMap: true,
    sourceMapInline: false
  },
  output: {
    cssFile: DEFAULT_CSS_FILENAME,
    classMapFile: DEFAULT_CLASS_MAP_FILENAME,
    typesFile: DEFAULT_TYPES_FILENAME,
    minify: true,
    generateGlobalCSS: true
  },
  cachePath: DEFAULT_CACHE_PATH,
  cacheEnabled: true,
  persistentCachePath: "./.chaincss/persistent-cache",
  cacheMaxAgeDays: 30,
  cacheMaxSizeMB: 500,
  debug: false,
  sourceComments: true,
  timeline: false,
  framework: "auto",
  namespace: "chain",
  verbose: false
};

// src/core/utils.ts
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
function hashString(str, length = 6) {
  return crypto.createHash("sha1").update(str).digest("hex").slice(0, length);
}
function generateClassName(styleId, naming = "hash") {
  if (naming === "hash") {
    return `c_${hashString(styleId)}`;
  }
  const cleanId = styleId.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  return `chain-${cleanId}`;
}
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  ensureDir(dir);
  fs.writeFileSync(filePath, content, "utf8");
}
function getBaseName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}
function formatCSS(css, minify = false) {
  if (!css || css.trim().length === 0) return "";
  if (!minify) {
    let formatted = css.replace(/\s*{\s*/g, " {\n  ").replace(/;\s*/g, ";\n  ").replace(/\s*}\s*/g, "\n}\n").replace(/\n\s*\n/g, "\n");
    formatted = formatted.replace(/@media[^{]+\{/g, (match) => {
      return match.replace(/\{/, " {\n");
    });
    return formatted.trim();
  }
  return css.replace(/\/\*.*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*{\s*/g, "{").replace(/\s*}\s*/g, "}").replace(/\s*;\s*/g, ";").replace(/\s*:\s*/g, ":").replace(/;}/g, "}").trim();
}
var currentLogLevel = process.env.DEBUG ? "debug" : "info";

// src/compiler/btt.ts
import fs2 from "fs";
import https from "https";
import chalk2 from "chalk";

// src/compiler/commonProps.ts
var COMMON_CSS_PROPERTIES2 = [
  "align-content",
  "align-items",
  "align-self",
  "animation",
  "background",
  "background-clip",
  "background-color",
  "background-image",
  "background-position",
  "background-repeat",
  "background-size",
  "border",
  "border-bottom",
  "border-color",
  "border-left",
  "border-radius",
  "border-right",
  "border-style",
  "border-top",
  "border-width",
  "bottom",
  "box-shadow",
  "box-sizing",
  "color",
  "content",
  "cursor",
  "display",
  "flex",
  "flex-direction",
  "flex-grow",
  "flex-shrink",
  "flex-wrap",
  "float",
  "font",
  "font-family",
  "font-size",
  "font-weight",
  "gap",
  "grid",
  "grid-template-columns",
  "grid-template-rows",
  "height",
  "justify-content",
  "left",
  "letter-spacing",
  "line-height",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "opacity",
  "outline",
  "overflow",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "position",
  "right",
  "text-align",
  "text-decoration",
  "text-transform",
  "top",
  "transform",
  "transition",
  "transition-delay",
  "transition-duration",
  "transition-property",
  "transition-timing-function",
  "width",
  "z-index"
];

// src/compiler/btt.ts
var styleHistory = [];
var styleChanges = [];
var timelineEnabled = false;
var currentSnapshotId = 0;
function enableTimeline(enable = true) {
  timelineEnabled = enable;
  if (!enable) {
    styleHistory = [];
    styleChanges = [];
  }
}
function getStyleHistory() {
  return styleHistory;
}
function getStyleChanges() {
  return styleChanges;
}
function getStyleDiff(snapshotId1, snapshotId2) {
  const snapshot1 = styleHistory.find((s) => s.id === snapshotId1);
  const snapshot2 = styleHistory.find((s) => s.id === snapshotId2);
  if (!snapshot1 || !snapshot2) {
    return { error: "Snapshot not found" };
  }
  const diff = {
    added: {},
    removed: {},
    modified: {}
  };
  for (const [key, value] of Object.entries(snapshot2.styles)) {
    if (!(key in snapshot1.styles)) {
      diff.added[key] = value;
    } else if (JSON.stringify(snapshot1.styles[key]) !== JSON.stringify(value)) {
      diff.modified[key] = {
        old: snapshot1.styles[key],
        new: value
      };
    }
  }
  for (const [key, value] of Object.entries(snapshot1.styles)) {
    if (!(key in snapshot2.styles)) {
      diff.removed[key] = value;
    }
  }
  return diff;
}
function takeSnapshot(selector, styles, source) {
  if (!timelineEnabled) return "";
  const hash = JSON.stringify(styles);
  const existing = styleHistory.find((s) => s.selector === selector && s.hash === hash);
  if (existing) return existing.id;
  const id = `snapshot_${currentSnapshotId++}`;
  const snapshot = {
    id,
    timestamp: Date.now(),
    selector,
    styles: { ...styles },
    source,
    hash
  };
  styleHistory.push(snapshot);
  const previousSnapshot = styleHistory.slice(-2)[0];
  if (previousSnapshot && previousSnapshot.selector === selector) {
    for (const [key, value] of Object.entries(styles)) {
      const oldValue = previousSnapshot.styles[key];
      if (!(key in previousSnapshot.styles)) {
        styleChanges.push({
          id: `change_${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          selector,
          property: key,
          oldValue: void 0,
          newValue: value,
          type: "add"
        });
      } else if (JSON.stringify(oldValue) !== JSON.stringify(value)) {
        styleChanges.push({
          id: `change_${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          selector,
          property: key,
          oldValue,
          newValue: value,
          type: "modify"
        });
      }
    }
    for (const [key] of Object.entries(previousSnapshot.styles)) {
      if (!(key in styles)) {
        styleChanges.push({
          id: `change_${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          selector,
          property: key,
          oldValue: previousSnapshot.styles[key],
          newValue: void 0,
          type: "remove"
        });
      }
    }
  }
  return id;
}
function exportTimeline() {
  return JSON.stringify({
    history: styleHistory,
    changes: styleChanges,
    exportedAt: Date.now()
  }, null, 2);
}
function clearTimeline() {
  styleHistory = [];
  styleChanges = [];
  currentSnapshotId = 0;
}
var enableSourceComments = true;
function getSourceLocation() {
  if (!enableSourceComments) return null;
  const stack = new Error().stack;
  if (!stack) return null;
  const stackLines = stack.split("\n");
  for (let i = 0; i < stackLines.length; i++) {
    const line = stackLines[i];
    const match = line.match(/([^/]+\.chain\.js):(\d+):\d+/);
    if (match) {
      const fileName = match[1];
      const lineNumber = match[2];
      return `${fileName}:${lineNumber}`;
    }
  }
  return null;
}
function setSourceComments(enabled) {
  enableSourceComments = enabled;
}
function addSourceComment(css, sourceLocation) {
  if (!enableSourceComments || !sourceLocation) return css;
  return `/* Generated from: ${sourceLocation} */
${css}`;
}
var fetchWithHttps = (url) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      req.destroy();
      reject(new Error("Request timeout"));
    }, 3e3);
    const req = https.get(url, (response) => {
      clearTimeout(timeout);
      let data = "";
      response.on("data", (chunk) => data += chunk);
      response.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
    });
    req.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
};
var loadCSSProperties = async () => {
  if (chains.cachedValidProperties !== null && chains.cachedValidProperties.length > 0) {
    return chains.cachedValidProperties;
  }
  try {
    const url = "https://raw.githubusercontent.com/mdn/data/main/css/properties.json";
    let data;
    if (typeof fetch !== "undefined") {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3e3);
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      data = await response.json();
    } else {
      data = await fetchWithHttps(url);
    }
    const allProperties = Object.keys(data);
    const baseProperties = /* @__PURE__ */ new Set();
    allProperties.forEach((prop) => {
      const baseProp = prop.replace(/^-(webkit|moz|ms|o)-/, "");
      baseProperties.add(baseProp);
    });
    chains.cachedValidProperties = Array.from(baseProperties).sort();
    return chains.cachedValidProperties;
  } catch (error) {
    chains.cachedValidProperties = COMMON_CSS_PROPERTIES2;
    return chains.cachedValidProperties;
  }
};
var chains = {
  cssOutput: void 0,
  cachedValidProperties: [],
  classMap: {},
  atomicStats: null,
  async initializeProperties() {
    if (this.cachedValidProperties && this.cachedValidProperties.length > 0) {
      return;
    }
    const properties = await loadCSSProperties();
    this.cachedValidProperties = properties;
  },
  getCachedProperties() {
    return this.cachedValidProperties;
  }
};
var atomicOptimizer = null;
function setAtomicOptimizer(optimizer) {
  atomicOptimizer = optimizer;
}
function configureAtomic(opts) {
  if (atomicOptimizer) {
    Object.assign(atomicOptimizer.options, opts);
  }
}
var tokens2 = tokens;
function createTokens2(tokenValues) {
  const tokenObj = new DesignTokens(tokenValues);
  setTokenContext(tokenObj);
  return tokenObj;
}
function processAtRule(rule, parentSelectors = null) {
  let output = "";
  switch (rule.type) {
    case "media":
      output = `@media ${rule.query} {
`;
      if (rule.styles && typeof rule.styles === "object") {
        let ruleBody = "";
        for (const prop in rule.styles) {
          const kebabKey = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
          ruleBody += `    ${kebabKey}: ${rule.styles[prop]};
`;
        }
        if (ruleBody.trim()) {
          const selector = parentSelectors && parentSelectors.length > 0 ? parentSelectors.join(", ") : ".unknown-selector";
          const sourceLocation = getSourceLocation();
          if (enableSourceComments && sourceLocation) {
            output += `  /* Generated from: ${sourceLocation} */
`;
          }
          output += `  ${selector} {
${ruleBody}  }
`;
        }
      }
      output += "}\n";
      break;
    case "keyframes":
      output = `@keyframes ${rule.name} {
`;
      for (const step in rule.steps) {
        output += `  ${step} {
`;
        for (const prop in rule.steps[step]) {
          if (prop !== "selectors") {
            const kebabKey = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
            output += `    ${kebabKey}: ${rule.steps[step][prop]};
`;
          }
        }
        output += "  }\n";
      }
      output += "}\n";
      break;
    case "font-face":
      output = "@font-face {\n";
      for (const prop in rule.properties) {
        if (prop !== "selectors") {
          const kebabKey = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
          output += `  ${kebabKey}: ${rule.properties[prop]};
`;
        }
      }
      output += "}\n";
      break;
    default:
      output = "";
      break;
  }
  return output;
}
var run = (...args) => {
  if (args.length === 0) return "";
  const validStyles = args.filter((value) => value && typeof value === "object");
  if (validStyles.length === 0) return "";
  let cssOutput = "";
  const styleObjs = [];
  args.forEach((value) => {
    if (!value) return;
    styleObjs.push(value);
    if (value.type && !value.selectors) {
      cssOutput += processAtRule(value) + "\n";
      return;
    }
    if (value.selectors) {
      let mainRuleBody = "";
      let subRulesOutput = "";
      for (const key in value) {
        if (!value.hasOwnProperty(key)) continue;
        if ([
          "selectors",
          "atRules",
          "hover",
          "nestedRules",
          "use",
          "nest",
          "themes",
          "_componentName",
          "_generateComponent",
          "_framework",
          "_propsDefinition"
        ].includes(key)) continue;
        if (key === "atRules" && Array.isArray(value[key])) {
          value[key].forEach((rule) => {
            subRulesOutput += processAtRule(rule, value.selectors);
          });
          continue;
        }
        if (key === "nestedRules" && Array.isArray(value[key])) {
          value[key].forEach((rule) => {
            let nestedBody = "";
            for (const prop in rule.styles) {
              const kebabKey2 = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
              nestedBody += `    ${kebabKey2}: ${rule.styles[prop]};
`;
            }
            if (nestedBody) {
              subRulesOutput += `${value.selectors.join(", ")} ${rule.selector} {
${nestedBody}  }
`;
            }
          });
          continue;
        }
        if (key === "hover" && typeof value[key] === "object") {
          let hoverBody = "";
          for (const hoverKey in value[key]) {
            const kebabKey2 = hoverKey.replace(/([A-Z])/g, "-$1").toLowerCase();
            hoverBody += `  ${kebabKey2}: ${value[key][hoverKey]};
`;
          }
          if (hoverBody) {
            subRulesOutput += `${value.selectors.join(", ")}:hover {
${hoverBody}}
`;
          }
          continue;
        }
        const kebabKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        mainRuleBody += `  ${kebabKey}: ${value[key]};
`;
      }
      if (mainRuleBody.trim()) {
        cssOutput += `${value.selectors.join(", ")} {
${mainRuleBody}}
`;
      }
      cssOutput += subRulesOutput;
    }
  });
  cssOutput = cssOutput.replace(/\n{3,}/g, "\n\n").trim();
  if (atomicOptimizer && atomicOptimizer.options.enabled) {
    const result = atomicOptimizer.optimize(styleObjs);
    return result.css;
  }
  return cssOutput;
};
var compile = (obj) => {
  let cssString = "";
  const collected = [];
  const processedSelectors = /* @__PURE__ */ new Set();
  for (const key in obj) {
    if (!obj.hasOwnProperty(key)) continue;
    const element = obj[key];
    if (element && element.variants && typeof element.compileAll === "function") {
      const cleanKey = key.includes("_") ? key.split("_").pop() : key;
      const recipeOutput = element.compileAll(cleanKey);
      cssString += recipeOutput + "\n";
      continue;
    }
    if (!element || !element.selectors || !element.selectors[0]) continue;
    const selectorKey = element.selectors.join(",");
    if (processedSelectors.has(selectorKey)) continue;
    processedSelectors.add(selectorKey);
    collected.push(element);
    const sourceLocation = getSourceLocation();
    let elementCSS = "";
    let subRulesCSS = "";
    if (timelineEnabled) {
      const styles = {};
      for (const prop in element) {
        if (!["selectors", "atRules", "hover", "nestedRules", "use", "nest", "themes"].includes(prop)) {
          styles[prop] = element[prop];
        }
      }
      takeSnapshot(element.selectors[0], styles, sourceLocation || "unknown");
    }
    for (const prop in element) {
      if (prop.startsWith(".") || prop.startsWith("&")) continue;
      if (["selectors", "atRules", "hover", "use", "nest", "themes", "nestedRules", "_componentName", "_generateComponent", "_framework"].includes(prop)) continue;
      if (prop.startsWith("_") || !element.hasOwnProperty(prop)) continue;
      const value = element[prop];
      if (value === void 0 || value === null) continue;
      const kebabKey = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      elementCSS += `  ${kebabKey}: ${value};
`;
    }
    if (elementCSS.trim()) {
      let block = `${element.selectors.join(", ")} {
${elementCSS}}
`;
      cssString += addSourceComment(block, sourceLocation);
    }
    if (element.hover && typeof element.hover === "object") {
      let hoverBody = "";
      for (const hProp in element.hover) {
        const hKebab = hProp.replace(/([A-Z])/g, "-$1").toLowerCase();
        hoverBody += `  ${hKebab}: ${element.hover[hProp]};
`;
      }
      if (hoverBody) {
        let block = `${element.selectors.join(", ")}:hover {
${hoverBody}}
`;
        cssString += addSourceComment(block, sourceLocation);
      }
    }
    for (const prop in element) {
      if ((prop.startsWith(".") || prop.startsWith("&")) && typeof element[prop] === "object") {
        const subElement = element[prop];
        const parentSelector = element.selectors[0];
        const subSelector = prop.startsWith("&") ? prop.replace("&", parentSelector) : `${parentSelector} ${prop}`;
        cssString += compile({
          [subSelector]: {
            selectors: [subSelector],
            ...subElement
          }
        }) + "\n";
      }
    }
    if (element.atRules && Array.isArray(element.atRules)) {
      element.atRules.forEach((rule) => {
        subRulesCSS += processAtRule(rule, element.selectors);
      });
    }
    if (element.themes && Array.isArray(element.themes)) {
      element.themes.forEach((theme) => {
        if (theme.styles) {
          let themeCSS = "";
          for (const tProp in theme.styles) {
            if (tProp === "selectors") continue;
            const tKebab = tProp.replace(/([A-Z])/g, "-$1").toLowerCase();
            themeCSS += `  ${tKebab}: ${theme.styles[tProp]};
`;
          }
          if (themeCSS) {
            let block = `${theme.styles.selectors?.join(", ") || element.selectors.join(", ")} {
${themeCSS}}
`;
            subRulesCSS += addSourceComment(block, sourceLocation);
          }
        }
      });
    }
    cssString += subRulesCSS;
  }
  if (atomicOptimizer && atomicOptimizer.options.enabled) {
    const result = atomicOptimizer.optimize(collected);
    chains.cssOutput = result.css;
    return result.css;
  }
  chains.cssOutput = cssString.trim();
  return chains.cssOutput;
};
function recipe(options) {
  const {
    base,
    variants = {},
    defaultVariants = {},
    compoundVariants = []
  } = options;
  const baseStyle = typeof base === "function" ? base() : base;
  const variantStyles = {};
  for (const [variantName, variantMap] of Object.entries(variants)) {
    variantStyles[variantName] = {};
    for (const [variantKey, variantStyle] of Object.entries(variantMap)) {
      variantStyles[variantName][variantKey] = typeof variantStyle === "function" ? variantStyle() : variantStyle;
    }
  }
  const compoundStyles = compoundVariants.map((cv) => ({
    condition: cv.variants || cv,
    style: typeof cv.style === "function" ? cv.style() : cv.style
  }));
  function mergeStyles(...styles) {
    const merged = { selectors: [] };
    for (const style of styles) {
      if (!style) continue;
      for (const [key, value] of Object.entries(style)) {
        if (key === "selectors") {
          const newSelectors = Array.isArray(value) ? value : [value];
          merged.selectors = [.../* @__PURE__ */ new Set([...merged.selectors || [], ...newSelectors])];
        } else if (key === "hover" && typeof value === "object") {
          if (!merged.hover) merged.hover = {};
          Object.assign(merged.hover, value);
        } else if (key !== "selectors") {
          merged[key] = value;
        }
      }
    }
    return merged;
  }
  function pick(variantSelection = {}) {
    const selected = { ...defaultVariants, ...variantSelection };
    const stylesToMerge = [];
    if (baseStyle) stylesToMerge.push(baseStyle);
    for (const [variantName, variantValue] of Object.entries(selected)) {
      const variantStyle = variantStyles[variantName]?.[variantValue];
      if (variantStyle) stylesToMerge.push(variantStyle);
    }
    for (const cv of compoundStyles) {
      const matches = Object.entries(cv.condition).every(
        ([key, value]) => selected[key] === value
      );
      if (matches && cv.style) stylesToMerge.push(cv.style);
    }
    const merged = mergeStyles(...stylesToMerge);
    let styleBuilder = chain();
    for (const [prop, value] of Object.entries(merged)) {
      if (prop === "selectors" || prop === "hover") continue;
      if (styleBuilder[prop]) {
        styleBuilder = styleBuilder[prop](value);
      }
    }
    if (merged.hover) {
      styleBuilder = styleBuilder.hover();
      for (const [hoverProp, hoverValue] of Object.entries(merged.hover)) {
        if (styleBuilder[hoverProp]) {
          styleBuilder = styleBuilder[hoverProp](hoverValue);
        }
      }
      styleBuilder = styleBuilder.end();
    }
    const selectors = merged.selectors || [];
    return styleBuilder.$el(...selectors);
  }
  pick.variants = variants;
  pick.defaultVariants = defaultVariants;
  pick.base = baseStyle;
  pick.getAllVariants = () => {
    const result = [];
    const variantKeys = Object.keys(variants);
    function generate(current, index) {
      if (index === variantKeys.length) {
        result.push({ ...current });
        return;
      }
      const variantName = variantKeys[index];
      for (const variantValue of Object.keys(variants[variantName])) {
        current[variantName] = variantValue;
        generate(current, index + 1);
      }
    }
    generate({}, 0);
    return result;
  };
  pick.getVariantClassNames = () => {
    const allVariants = pick.getAllVariants();
    const classNames = {};
    for (const variant of allVariants) {
      const variantKey = Object.entries(variant).map(([k, v]) => `${k}-${v}`).join("_");
      const styleDef = pick(variant);
      if (styleDef.selectors && styleDef.selectors[0]) {
        classNames[variantKey] = styleDef.selectors[0].replace(/^\./, "");
      }
    }
    return classNames;
  };
  pick.compileAll = () => {
    const allVariants = pick.getAllVariants();
    const styles = [];
    if (baseStyle && baseStyle.selectors) {
      styles.push(baseStyle);
    }
    for (const variant of allVariants) {
      const styleDef = pick(variant);
      if (styleDef && styleDef.selectors) {
        styles.push(styleDef);
      }
    }
    for (const variantName of Object.keys(variants)) {
      for (const variantKey of Object.keys(variants[variantName])) {
        const variantStyle = variantStyles[variantName]?.[variantKey];
        if (variantStyle && variantStyle.selectors) {
          styles.push(variantStyle);
        }
      }
    }
    return run(...styles);
  };
  return pick;
}
function scanFileForStyles(filePath, optimizer, source = null) {
  const errors = [];
  let foundCount = 0;
  try {
    const content = source !== null ? source : fs2.readFileSync(filePath, "utf8");
    if (!content || content.trim().length === 0) {
      return { foundCount: 0, errors };
    }
    const styleRegex = /(?:chain|\$)\(((?:[^()]|\([^()]*\))*)\)/g;
    let match;
    while ((match = styleRegex.exec(content)) !== null) {
      try {
        const styleBody = match[1].trim();
        const cleanBody = styleBody.replace(/^['"`]|['"`]$/g, "");
        if (cleanBody) {
          if (optimizer && typeof optimizer.trackStyles === "function") {
            optimizer.trackStyles([{ selectors: { "&": cleanBody } }]);
          }
          foundCount++;
        }
      } catch (parseError) {
        errors.push(parseError);
        if (process.env.DEBUG) {
          console.error(`[Scanner] Parse error in ${filePath}:`, parseError);
        }
      }
    }
    if (foundCount > 0 && process.env.DEBUG) {
      console.log(chalk2.magenta(`[Scanner] Found ${foundCount} styles in ${filePath}`));
    }
  } catch (err) {
    errors.push(err);
    if (process.env.DEBUG) {
      console.error(`[Scanner] Error processing ${filePath}:`, err);
    }
  }
  return { foundCount, errors };
}
chains.initializeProperties().catch((err) => {
  if (process.env.DEBUG) {
    console.error("Failed to load CSS properties:", err.message);
  }
});

// src/compiler/atomic-optimizer.ts
import crypto2 from "crypto";
import path2 from "path";
import fs3 from "fs";
function kebab(s) {
  return s.replace(/([A-Z])/g, "-$1").toLowerCase();
}
var AtomicOptimizer = class {
  config;
  options;
  usageCount;
  atomicClasses;
  atomicMap = {};
  componentClassMap;
  stats;
  constructor(config) {
    this.config = config;
    const atomicOptions = config.atomic || {};
    this.options = {
      enabled: atomicOptions.enabled !== false,
      threshold: atomicOptions.threshold ?? 2,
      naming: atomicOptions.naming ?? (process.env.NODE_ENV === "production" ? "hash" : "readable"),
      cache: atomicOptions.cache !== false,
      cachePath: atomicOptions.cachePath || "./.chaincss-cache/atomic-cache.json",
      minify: config.output?.minify ?? true,
      mode: atomicOptions.mode || "hybrid",
      outputStrategy: atomicOptions.outputStrategy || "component-first",
      alwaysAtomic: atomicOptions.alwaysAtomic || [],
      neverAtomic: atomicOptions.neverAtomic || [
        "content",
        "animation",
        "transition",
        "keyframes",
        "animation-name",
        "animation-duration",
        "animation-timing-function",
        "transition-property",
        "transition-duration"
      ],
      frameworkOutput: { react: false, vue: false, vanilla: true },
      preserveSelectors: atomicOptions.preserveSelectors || false,
      verbose: config.verbose || false
    };
    this.usageCount = /* @__PURE__ */ new Map();
    this.atomicClasses = /* @__PURE__ */ new Map();
    this.componentClassMap = /* @__PURE__ */ new Map();
    this.stats = {
      totalStyles: 0,
      atomicStyles: 0,
      standardStyles: 0,
      uniqueProperties: 0,
      savings: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    if (this.options.cache) {
      this.loadCache();
    }
  }
  componentMap = /* @__PURE__ */ new Map();
  /**
   * Get usage count for a specific property-value pair
   */
  getUsageCount(prop, value, context = "") {
    const key = context ? `${context}|${prop}:${value}` : `${prop}:${value}`;
    return this.usageCount.get(key) || 0;
  }
  /**
   * Increment usage count for a specific property-value pair
   */
  incrementUsageCount(prop, value, context = "") {
    const key = context ? `${context}|${prop}:${value}` : `${prop}:${value}`;
    const current = this.usageCount.get(key) || 0;
    this.usageCount.set(key, current + 1);
    this.stats.totalStyles++;
  }
  /**
   * Get the usage count map for debugging
   */
  getUsageCountMap() {
    return new Map(this.usageCount);
  }
  // ============================================================================
  // Cache Management
  // ============================================================================
  loadCache() {
    try {
      const cacheDir = path2.dirname(this.options.cachePath);
      if (!fs3.existsSync(cacheDir)) {
        fs3.mkdirSync(cacheDir, { recursive: true });
      }
      if (!fs3.existsSync(this.options.cachePath)) return;
      const data = JSON.parse(fs3.readFileSync(this.options.cachePath, "utf8"));
      if (data.version !== "2.0.0") {
        if (this.options.verbose) {
          console.log("Cache version mismatch, rebuilding...");
        }
        return;
      }
      if (data.config?.threshold !== this.options.threshold) {
        if (this.options.verbose) {
          console.log("Threshold changed, rebuilding cache...");
        }
        return;
      }
      if (data.atomicClasses) {
        for (const [key, value] of data.atomicClasses) {
          this.atomicClasses.set(key, value);
          const atomic = value;
          this.atomicMap[`${atomic.prop}:${atomic.value}`] = atomic.className;
        }
      }
      if (data.componentClassMap) {
        for (const [key, value] of data.componentClassMap) {
          this.componentClassMap.set(key, value);
        }
      }
      if (data.stats) {
        this.stats = { ...this.stats, ...data.stats };
      }
      if (this.options.verbose) {
        console.log(`\u2705 Cache loaded: ${this.atomicClasses.size} atomic classes`);
      }
    } catch (err) {
      if (this.options.verbose) {
        console.log("Could not load cache:", err.message);
      }
    }
  }
  saveCache() {
    if (!this.options.cache) return;
    try {
      const cacheDir = path2.dirname(this.options.cachePath);
      if (!fs3.existsSync(cacheDir)) {
        fs3.mkdirSync(cacheDir, { recursive: true });
      }
      const cache = {
        version: "2.0.0",
        timestamp: Date.now(),
        atomicClasses: Array.from(this.atomicClasses.entries()),
        componentClassMap: Array.from(this.componentClassMap.entries()),
        stats: {
          totalStyles: this.stats.totalStyles,
          atomicStyles: this.stats.atomicStyles,
          standardStyles: this.stats.standardStyles,
          uniqueProperties: this.stats.uniqueProperties
        },
        config: {
          threshold: this.options.threshold,
          naming: this.options.naming,
          mode: this.options.mode,
          outputStrategy: this.options.outputStrategy
        }
      };
      fs3.writeFileSync(this.options.cachePath, JSON.stringify(cache, null, 2), "utf8");
      if (this.options.verbose) {
        console.log(`\u{1F4BE} Cache saved: ${this.atomicClasses.size} atomic classes`);
      }
    } catch (err) {
      if (this.options.verbose) {
        console.log("Could not save cache:", err.message);
      }
    }
  }
  // ============================================================================
  // Style Tracking
  // ============================================================================
  trackStyles(styles) {
    if (!Array.isArray(styles)) return;
    for (const styleDef of styles) {
      if (!styleDef || typeof styleDef !== "object") continue;
      for (const [prop, value] of Object.entries(styleDef)) {
        if (prop === "selectors" || prop === "path" || prop === "atRules" || prop === "nestedRules") continue;
        if (prop.startsWith("_")) continue;
        if (typeof value === "string" || typeof value === "number") {
          this.incrementUsageCount(prop, String(value));
        }
      }
      if (styleDef.hover && typeof styleDef.hover === "object") {
        for (const [hProp, hValue] of Object.entries(styleDef.hover)) {
          this.incrementUsageCount(hProp, String(hValue), "hover");
        }
      }
      if (styleDef.nestedRules && Array.isArray(styleDef.nestedRules)) {
        for (const nested of styleDef.nestedRules) {
          if (nested.styles) {
            this.trackStyles([nested.styles]);
          }
        }
      }
    }
  }
  // ============================================================================
  // String-Based Scanning
  // ============================================================================
  process(styleChain) {
    try {
      const styleObj = {};
      const methodRegex = /\.([a-zA-Z0-9]+)\s*\(\s*(['"]?)([^'")]+)\2\s*\)/g;
      let match;
      while ((match = methodRegex.exec(styleChain)) !== null) {
        const [, prop, , value] = match;
        if (prop && value) {
          styleObj[prop] = value;
        }
      }
      if (Object.keys(styleObj).length > 0) {
        this.trackStyles([styleObj]);
        for (const [prop, value] of Object.entries(styleObj)) {
          const className = this.getOrCreateAtomic(prop, value);
          this.atomicMap[`${prop}:${value}`] = className;
        }
      }
    } catch (e) {
      if (this.options.verbose) {
        console.log("Failed to process style chain:", e);
      }
    }
  }
  processStyleObject(style, context = "base") {
    if (!style) return;
    for (const [prop, value] of Object.entries(style)) {
      if (["selectors", "atRules", "nestedRules", "hover"].includes(prop)) continue;
      if (prop.startsWith("_")) continue;
      this.incrementUsage(prop, value, context);
    }
    if (style.hover) {
      for (const [hProp, hVal] of Object.entries(style.hover)) {
        this.incrementUsage(hProp, hVal, `${context}:hover`);
      }
    }
    if (style.nestedRules) {
      style.nestedRules.forEach(
        (nested) => this.processStyleObject(nested.styles, context)
      );
    }
    if (style.atRules) {
      style.atRules.forEach((rule) => {
        if (rule.styles) this.processStyleObject(rule.styles, rule.query || context);
      });
    }
  }
  // Fixed: Class name generation with proper prefixes
  generateClassName(prop, value, type) {
    const hash = crypto2.createHash("md5").update(`${prop}${value}`).digest("hex").slice(0, 6);
    const propKebab = kebab(prop);
    if (type === "atomic") {
      return `a-${propKebab}-${hash}`;
    }
    return `c-${propKebab}-${hash}`;
  }
  incrementUsage(prop, value, context = "base") {
    const key = `${context}|${prop}:${value}`;
    const count = (this.usageCount.get(key) || 0) + 1;
    this.usageCount.set(key, count);
    this.stats.totalStyles++;
    if (this.atomicClasses.has(key)) {
      const atomic = this.atomicClasses.get(key);
      atomic.usageCount = count;
    }
  }
  shouldBeAtomic(prop, value, context = "base") {
    if (this.options.mode === "standard") return false;
    if (this.options.mode === "atomic") return true;
    const kebabProp = kebab(prop);
    if (this.options.neverAtomic.includes(kebabProp)) return false;
    if (this.options.alwaysAtomic.includes(kebabProp)) return true;
    const key = `${context}|${prop}:${value}`;
    const usage = this.usageCount.get(key) || 0;
    return usage >= this.options.threshold;
  }
  getOrCreateAtomic(prop, value, context = "base") {
    const key = `${context}|${prop}:${value}`;
    if (this.atomicClasses.has(key)) {
      this.stats.cacheHits++;
      return this.atomicClasses.get(key).className;
    }
    this.stats.cacheMisses++;
    const className = this.generateClassName(prop, value, "atomic");
    const propKebab = kebab(prop);
    this.atomicClasses.set(key, {
      className,
      prop,
      value,
      rules: `${propKebab}: ${value};`,
      usageCount: this.usageCount.get(key) || 0,
      createdAt: Date.now(),
      hash: crypto2.createHash("md5").update(key).digest("hex").slice(0, 8)
    });
    this.stats.atomicStyles++;
    this.stats.uniqueProperties++;
    return className;
  }
  getKeyFromClassName(className) {
    for (const [key, atomic] of this.atomicClasses) {
      if (atomic.className === className) return key;
    }
    return null;
  }
  // ============================================================================
  // CSS Generation
  // ============================================================================
  generateAtomicCSS() {
    let css = "/* ChainCSS Atomic Bundle */\n";
    const sorted = Array.from(this.atomicClasses.values()).sort(
      (a, b) => a.className.localeCompare(b.className)
    );
    for (const data of sorted) {
      css += `.${data.className} { ${data.rules} }
`;
    }
    return css;
  }
  generateComponentCSS(style, selectors, context = "base") {
    const atomicClasses = [];
    let standardRules = "";
    const selectorStr = selectors.join(", ");
    for (const [prop, value] of Object.entries(style)) {
      if (["selectors", "atRules", "nestedRules", "hover"].includes(prop) || prop.startsWith("_")) continue;
      if (typeof value === "object") continue;
      if (this.shouldBeAtomic(prop, value, context)) {
        const atomicClass = this.getOrCreateAtomic(prop, value, context);
        atomicClasses.push(atomicClass);
      } else {
        standardRules += `  ${kebab(prop)}: ${value};
`;
      }
    }
    let css = standardRules ? `${selectorStr} {
${standardRules}}
` : "";
    if (style.nestedRules) {
      style.nestedRules.forEach((nested) => {
        const nestedSelector = nested.selector.replace("&", selectorStr);
        const nestedResult = this.generateComponentCSS(nested.styles, [nestedSelector], context);
        css += nestedResult.css;
        atomicClasses.push(...nestedResult.atomicClasses);
      });
    }
    if (style.atRules) {
      style.atRules.forEach((rule) => {
        if (rule.styles) {
          const ruleResult = this.generateComponentCSS(rule.styles, selectors, rule.query || context);
          css += `@${rule.type} ${rule.query} {
${ruleResult.css}}
`;
          atomicClasses.push(...ruleResult.atomicClasses);
        }
      });
    }
    return { css, atomicClasses };
  }
  /**
   * Generate a clean component name without any prefixes
   */
  getCleanComponentName(rawName, componentId) {
    let clean = rawName.replace(/^\./, "");
    clean = clean.replace(/^c-+/, "");
    clean = clean.replace(/[^a-zA-Z0-9_-]/g, "-");
    if (!clean || clean === "&") {
      clean = componentId.replace(/^c-+/, "");
    }
    const componentIdClean = componentId.replace(/^c-+/, "");
    if (clean === componentIdClean || clean === `c-${componentIdClean}`) {
      clean = componentIdClean;
    }
    return clean;
  }
  // Helper method to generate pseudo-class CSS
  generatePseudoCSS(pseudoClass, styles, selector) {
    let css = "";
    const pseudoSelector = `${selector}:${pseudoClass}`;
    let rules = "";
    for (const [prop, value] of Object.entries(styles)) {
      if (prop === "selectors" || prop.startsWith("_")) continue;
      const kebabProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      rules += `  ${kebabProp}: ${value};
`;
    }
    if (rules) {
      css = `${pseudoSelector} {
${rules}}
`;
    }
    return css;
  }
  // ============================================================================
  // ✅ MAIN OPTIMIZE METHOD - FULLY FIXED
  // ============================================================================
  optimize(styles) {
    const componentId = Object.keys(styles)[0];
    let styleDef = styles[componentId];
    let atomicClasses = [];
    if (!styleDef || typeof styleDef !== "object") {
      return {
        css: "",
        map: {},
        stats: this.getStats(),
        atomicCSS: "",
        componentCSS: "",
        componentMap: this.componentMap
      };
    }
    let rawName = Array.isArray(styleDef.selectors) ? styleDef.selectors[0] : styleDef.selectors;
    if (!rawName || rawName === "&") {
      rawName = componentId;
    }
    let cleanName = rawName.replace(/^\./, "").replace(/[^a-zA-Z0-9_-]/g, "-").toLowerCase();
    if (!cleanName || cleanName.length > 50) {
      cleanName = "component";
    }
    const componentHash = crypto2.createHash("md5").update(cleanName + componentId).digest("hex").slice(0, 6);
    const componentClassName = `c-${cleanName}-${componentHash}`;
    const selector = `.${componentClassName}`;
    if (this.options.verbose) {
      console.log(`[AtomicOptimizer] Optimizing component: ${componentId} -> ${componentClassName}`);
    }
    let classList = [componentClassName];
    let localRules = "";
    let pseudoRules = "";
    for (const [prop, value] of Object.entries(styleDef)) {
      if (prop === "selectors" || prop === "path" || prop.startsWith("_")) continue;
      if (typeof value === "object" && value !== null) {
        if (["hover", "focus", "active", "visited", "disabled", "checked"].includes(prop)) {
          pseudoRules += this.generatePseudoCSS(prop, value, selector);
        }
        continue;
      }
      if (value === null || value === void 0) continue;
      const kebabProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      const stringValue = String(value);
      if (this.shouldBeAtomic(prop, stringValue)) {
        const atomicClass = this.getOrCreateAtomic(prop, stringValue);
        classList.push(atomicClass);
        atomicClasses.push(atomicClass);
        this.atomicMap[`${prop}:${stringValue}`] = atomicClass;
        this.stats.atomicStyles++;
        if (this.options.verbose) {
          console.log(`  [Atomic] ${kebabProp}: ${stringValue} -> .${atomicClass}`);
        }
      } else {
        localRules += `  ${kebabProp}: ${stringValue};
`;
        this.stats.standardStyles++;
        if (this.options.verbose) {
          console.log(`  [Standard] ${kebabProp}: ${stringValue}`);
        }
      }
    }
    this.componentMap.set(componentId, {
      atomicClasses,
      hoverAtomicClasses: [],
      // Will be populated if hover styles exist
      selectors: [selector],
      componentClassName
    });
    this.componentClassMap.set(componentId, {
      atomicClasses,
      hoverAtomicClasses: [],
      selectors: [selector]
    });
    let componentCSS = "";
    if (localRules) {
      componentCSS = `${selector} {
${localRules}}
`;
    }
    if (pseudoRules) {
      componentCSS += pseudoRules;
    }
    const finalClassName = classList.join(" ");
    this.saveCache();
    return {
      css: componentCSS,
      map: {
        [componentId]: finalClassName
      },
      stats: this.getStats(),
      atomicCSS: this.generateAtomicCSS(),
      componentCSS,
      componentMap: this.componentMap
    };
  }
  // Helper to process pseudo-states
  processPseudoState(state, styles, selector) {
    let css = "";
    const pseudoSelector = `${selector}:${state}`;
    let rules = "";
    for (const [prop, value] of Object.entries(styles)) {
      if (prop === "selectors" || prop.startsWith("_")) continue;
      const kebabProp = kebab(prop);
      rules += `  ${kebabProp}: ${value};
`;
    }
    if (rules) {
      css = `${pseudoSelector} {
${rules}}
`;
    }
    return css;
  }
  reset() {
    this.usageCount.clear();
    this.atomicClasses.clear();
    this.componentClassMap.clear();
    this.componentMap.clear();
    this.atomicMap = {};
    this.stats = {
      totalStyles: 0,
      atomicStyles: 0,
      standardStyles: 0,
      uniqueProperties: 0,
      savings: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    if (this.options.verbose) {
      console.log("AtomicOptimizer reset");
    }
  }
  getStats() {
    const total = this.stats.totalStyles;
    const generatedRules = this.stats.uniqueProperties + this.stats.standardStyles;
    let savingsValue = 0;
    if (total > 0) {
      savingsValue = (total - generatedRules) / total * 100;
    }
    const totalCacheRequests = this.stats.cacheHits + this.stats.cacheMisses;
    const cacheHitRate = totalCacheRequests > 0 ? this.stats.cacheHits / totalCacheRequests : 0;
    return {
      totalStyles: total,
      atomicStyles: this.atomicClasses.size,
      standardStyles: this.stats.standardStyles,
      uniqueProperties: this.stats.uniqueProperties,
      savings: `${savingsValue.toFixed(1)}%`,
      cacheHitRate
    };
  }
  getAtomicClass(prop, value, context = "") {
    const key = context ? `${context}|${prop}:${value}` : `${prop}:${value}`;
    const atomic = this.atomicClasses.get(key);
    return atomic ? atomic.className : null;
  }
  getAllAtomicClasses() {
    return Array.from(this.atomicClasses.values());
  }
  clearCache() {
    this.atomicClasses.clear();
    this.componentClassMap.clear();
    this.usageCount.clear();
    this.atomicMap = {};
    if (this.options.cache && fs3.existsSync(this.options.cachePath)) {
      fs3.unlinkSync(this.options.cachePath);
      if (this.options.verbose) {
        console.log("Cache cleared");
      }
    }
  }
  getComponentMapEntry(name) {
    return this.componentClassMap.get(name);
  }
  getAtomicMap() {
    return this.atomicMap;
  }
};

// src/compiler/prefixer.ts
var postcss = null;
var autoprefixer = null;
var postcssLoaded = false;
var autoprefixerLoaded = false;
var loadingPromises = /* @__PURE__ */ new Map();
async function loadPostcss() {
  if (postcss) return postcss;
  if (loadingPromises.has("postcss")) return loadingPromises.get("postcss");
  const promise = (async () => {
    if (!postcssLoaded) {
      try {
        const module2 = await import("postcss");
        postcss = module2.default || module2;
      } catch (err) {
        if (process.env.DEBUG) {
          console.warn("postcss not installed, using lightweight prefixing");
        }
      }
      postcssLoaded = true;
    }
    return postcss;
  })();
  loadingPromises.set("postcss", promise);
  return promise;
}
async function loadAutoprefixer() {
  if (autoprefixer) return autoprefixer;
  if (loadingPromises.has("autoprefixer")) return loadingPromises.get("autoprefixer");
  const promise = (async () => {
    if (!autoprefixerLoaded) {
      try {
        const module2 = await import("autoprefixer");
        autoprefixer = module2.default || module2;
      } catch (err) {
        if (process.env.DEBUG) {
          console.warn("autoprefixer not installed");
        }
      }
      autoprefixerLoaded = true;
    }
    return autoprefixer;
  })();
  loadingPromises.set("autoprefixer", promise);
  return promise;
}
var LIGHTWEIGHT_PREFIX_MAP = {
  // Transform properties
  "transform": {
    "webkit": ["-webkit-transform"],
    "ms": ["-ms-transform"]
  },
  "transform-origin": {
    "webkit": ["-webkit-transform-origin"],
    "ms": ["-ms-transform-origin"]
  },
  "transform-style": {
    "webkit": ["-webkit-transform-style"]
  },
  "perspective": {
    "webkit": ["-webkit-perspective"]
  },
  "backface-visibility": {
    "webkit": ["-webkit-backface-visibility"]
  },
  // Transitions & Animations
  "transition": {
    "webkit": ["-webkit-transition"]
  },
  "transition-property": {
    "webkit": ["-webkit-transition-property"]
  },
  "transition-duration": {
    "webkit": ["-webkit-transition-duration"]
  },
  "transition-timing-function": {
    "webkit": ["-webkit-transition-timing-function"]
  },
  "animation": {
    "webkit": ["-webkit-animation"]
  },
  "animation-name": {
    "webkit": ["-webkit-animation-name"]
  },
  "animation-duration": {
    "webkit": ["-webkit-animation-duration"]
  },
  "animation-timing-function": {
    "webkit": ["-webkit-animation-timing-function"]
  },
  "animation-delay": {
    "webkit": ["-webkit-animation-delay"]
  },
  "animation-iteration-count": {
    "webkit": ["-webkit-animation-iteration-count"]
  },
  "animation-direction": {
    "webkit": ["-webkit-animation-direction"]
  },
  "animation-fill-mode": {
    "webkit": ["-webkit-animation-fill-mode"]
  },
  // Filters
  "filter": {
    "webkit": ["-webkit-filter"]
  },
  "backdrop-filter": {
    "webkit": ["-webkit-backdrop-filter"]
  },
  // Box properties
  "box-shadow": {
    "webkit": ["-webkit-box-shadow"]
  },
  "box-sizing": {
    "webkit": ["-webkit-box-sizing"],
    "moz": ["-moz-box-sizing"]
  },
  "border-radius": {
    "webkit": ["-webkit-border-radius"],
    "moz": ["-moz-border-radius"]
  },
  // User interface
  "user-select": {
    "webkit": ["-webkit-user-select"],
    "moz": ["-moz-user-select"],
    "ms": ["-ms-user-select"]
  },
  "appearance": {
    "webkit": ["-webkit-appearance"],
    "moz": ["-moz-appearance"]
  },
  // Text
  "text-fill-color": {
    "webkit": ["-webkit-text-fill-color"]
  },
  "text-stroke": {
    "webkit": ["-webkit-text-stroke"]
  },
  "text-stroke-color": {
    "webkit": ["-webkit-text-stroke-color"]
  },
  "text-stroke-width": {
    "webkit": ["-webkit-text-stroke-width"]
  },
  "background-clip": {
    "webkit": ["-webkit-background-clip"]
  },
  // Masks
  "mask-image": {
    "webkit": ["-webkit-mask-image"]
  },
  "mask-clip": {
    "webkit": ["-webkit-mask-clip"]
  },
  "mask-composite": {
    "webkit": ["-webkit-mask-composite"]
  },
  "mask-origin": {
    "webkit": ["-webkit-mask-origin"]
  },
  "mask-position": {
    "webkit": ["-webkit-mask-position"]
  },
  "mask-repeat": {
    "webkit": ["-webkit-mask-repeat"]
  },
  "mask-size": {
    "webkit": ["-webkit-mask-size"]
  }
};
var LIGHTWEIGHT_VALUE_PREFIXES = {
  "display": {
    "flex": ["-webkit-flex", "-ms-flexbox"],
    "inline-flex": ["-webkit-inline-flex", "-ms-inline-flexbox"],
    "grid": ["-ms-grid"],
    "inline-grid": ["-ms-inline-grid"]
  },
  "position": {
    "sticky": ["-webkit-sticky"]
  }
};
var ChainCSSPrefixer = class {
  config;
  hasBuiltInDeps;
  hasAutoprefixer;
  prefixerMode;
  caniuseData;
  commonProperties;
  specialValues;
  browserPrefixMap;
  targetBrowsers;
  warnings = [];
  constructor(config = {}) {
    this.config = {
      browsers: config.browsers || ["> 0.5%", "last 2 versions", "not dead"],
      enabled: config.enabled !== false,
      mode: config.mode || "auto",
      sourceMap: config.sourceMap !== false,
      sourceMapInline: config.sourceMapInline || false,
      remove: config.remove !== false,
      add: config.add !== false,
      verbose: config.verbose || false,
      flexbox: config.flexbox !== false,
      grid: config.grid || "autoplace"
    };
    this.hasBuiltInDeps = false;
    this.hasAutoprefixer = false;
    this.prefixerMode = config.mode || "auto";
    this.caniuseData = null;
    this.commonProperties = this.getCommonProperties();
    this.specialValues = {
      "display": ["flex", "inline-flex", "grid", "inline-grid"],
      "background-clip": ["text"],
      "position": ["sticky"]
    };
    this.browserPrefixMap = {
      "chrome": "webkit",
      "safari": "webkit",
      "firefox": "moz",
      "ie": "ms",
      "edge": "webkit",
      "ios_saf": "webkit",
      "and_chr": "webkit",
      "android": "webkit",
      "opera": "webkit",
      "op_mob": "webkit",
      "samsung": "webkit",
      "and_ff": "moz"
    };
    this.targetBrowsers = null;
  }
  async determineMode() {
    if (this.config.mode === "full") {
      const hasAutoprefixer = !!await loadAutoprefixer();
      if (!hasAutoprefixer && this.config.verbose) {
        console.warn("\u26A0\uFE0F Full mode requested but autoprefixer not installed. Falling back to lightweight mode.");
        console.warn("   To use full mode: npm install autoprefixer postcss caniuse-db browserslist\n");
      }
      return hasAutoprefixer ? "full" : "lightweight";
    }
    if (this.config.mode === "lightweight") {
      return "lightweight";
    }
    if (this.config.mode === "auto") {
      const hasAutoprefixer = !!await loadAutoprefixer();
      if (this.config.verbose) {
        console.log(`\u{1F527} Prefixer mode: ${hasAutoprefixer ? "full" : "lightweight"}`);
      }
      return hasAutoprefixer ? "full" : "lightweight";
    }
    return "lightweight";
  }
  async process(cssString, options = {}) {
    this.warnings = [];
    if (!this.config.enabled) {
      return { css: cssString, map: null, warnings: [] };
    }
    try {
      const mode = await this.determineMode();
      if (mode === "full") {
        return await this.processWithAutoprefixer(cssString, options);
      }
      return await this.processWithBuiltIn(cssString, options);
    } catch (err) {
      const errorMsg = err.message;
      this.warnings.push(`Prefixer error: ${errorMsg}`);
      if (this.config.verbose) {
        console.error("Prefixer error:", errorMsg);
      }
      return { css: cssString, map: null, warnings: this.warnings };
    }
  }
  async processWithAutoprefixer(cssString, options) {
    const autoprefixerModule = await loadAutoprefixer();
    const postcssModule = await loadPostcss();
    if (!autoprefixerModule || !postcssModule) {
      this.warnings.push("Autoprefixer or PostCSS not available, falling back to lightweight mode");
      return await this.processWithBuiltIn(cssString, options);
    }
    const from = options.from || "input.css";
    const to = options.to || "output.css";
    try {
      const result = await postcssModule([
        autoprefixerModule({
          overrideBrowserslist: this.config.browsers,
          remove: this.config.remove,
          add: this.config.add,
          flexbox: this.config.flexbox,
          grid: this.config.grid
        })
      ]).process(cssString, {
        from,
        to,
        map: this.config.sourceMap ? {
          inline: this.config.sourceMapInline,
          annotation: false,
          sourcesContent: true
        } : false
      });
      if (result.warnings && this.config.verbose) {
        result.warnings().forEach((warning) => {
          this.warnings.push(warning.toString());
        });
      }
      return {
        css: result.css,
        map: result.map ? result.map.toString() : null,
        warnings: this.warnings
      };
    } catch (err) {
      this.warnings.push(`Autoprefixer processing error: ${err.message}`);
      return { css: cssString, map: null, warnings: this.warnings };
    }
  }
  async processWithBuiltIn(cssString, options) {
    const prefixed = this.lightweightPrefix(cssString);
    return {
      css: prefixed,
      map: null,
      warnings: this.warnings
    };
  }
  lightweightPrefix(cssString) {
    let result = cssString;
    const declRegex = /([\w-]+)\s*:\s*([^;]+);/g;
    let match;
    while ((match = declRegex.exec(cssString)) !== null) {
      const [fullMatch, prop, value] = match;
      const trimmedProp = prop.trim();
      const trimmedValue = value.trim();
      const prefixes = LIGHTWEIGHT_PREFIX_MAP[trimmedProp];
      if (prefixes && this.config.add) {
        for (const [prefix, prefixedProps] of Object.entries(prefixes)) {
          for (const prefixedProp of prefixedProps) {
            const prefixedDecl = `${prefixedProp}: ${trimmedValue};`;
            result = result.replace(fullMatch, `${prefixedDecl}
${fullMatch}`);
          }
        }
      }
      const valuePrefixes = LIGHTWEIGHT_VALUE_PREFIXES[trimmedProp];
      if (valuePrefixes && valuePrefixes[trimmedValue] && this.config.add) {
        for (const prefixedValue of valuePrefixes[trimmedValue]) {
          const prefixedDecl = `${trimmedProp}: ${prefixedValue};`;
          result = result.replace(fullMatch, `${prefixedDecl}
${fullMatch}`);
        }
      }
    }
    const keyframesRegex = /@keyframes\s+(\w+)\s*\{([^}]+)\}/g;
    while ((match = keyframesRegex.exec(cssString)) !== null) {
      const [fullMatch, name, frames] = match;
      const webkitKeyframes = `@-webkit-keyframes ${name} {${frames}}`;
      result = result.replace(fullMatch, `${webkitKeyframes}
${fullMatch}`);
    }
    return result;
  }
  createBuiltInPlugin() {
    return (root) => {
      root.walkDecls((decl) => {
        this.processBuiltInDeclaration(decl);
      });
    };
  }
  processBuiltInDeclaration(decl) {
    const { prop, value } = decl;
    if (this.commonProperties.includes(prop) && this.config.add) {
      this.addPrefixesFromCaniuse(decl);
    }
    if (this.specialValues[prop]?.includes(value) && this.config.add) {
      this.addSpecialValuePrefixes(decl);
    }
    if (!this.config.remove) return;
    const unprefixedProp = prop.replace(/^-(webkit|moz|ms|o)-/, "");
    if (unprefixedProp !== prop && this.commonProperties.includes(unprefixedProp)) {
      const shouldKeep = this.shouldKeepPrefix(prop, unprefixedProp);
      if (!shouldKeep) {
        decl.remove();
      }
    }
  }
  shouldKeepPrefix(prop, unprefixed) {
    if (!this.targetBrowsers) return true;
    const prefix = prop.match(/^-(webkit|moz|ms|o)-/)?.[1];
    if (!prefix) return true;
    const modernBrowsers = ["chrome >= 80", "firefox >= 80", "safari >= 13", "edge >= 80"];
    const needsPrefix = this.targetBrowsers.some((browser) => {
      return modernBrowsers.includes(browser);
    });
    return !needsPrefix;
  }
  addPrefixesFromCaniuse(decl) {
    if (!this.caniuseData) return;
    const feature = this.findFeature(decl.prop);
    if (!feature) return;
    const prefixes = /* @__PURE__ */ new Set();
    this.targetBrowsers?.forEach((browser) => {
      const [id, versionStr] = browser.split(" ");
      const version = parseFloat(versionStr.split("-")[0]);
      const stats = feature.stats[id];
      if (stats) {
        const versions = Object.keys(stats).map((v) => parseFloat(v.split("-")[0])).filter((v) => !isNaN(v)).sort((a, b) => a - b);
        const closestVersion = versions.find((v) => v <= version) || versions[0];
        if (closestVersion) {
          const support = stats[closestVersion.toString()];
          if (support && support.includes("x")) {
            const prefix = this.browserPrefixMap[id.split("-")[0]];
            if (prefix) prefixes.add(prefix);
          }
        }
      }
    });
    prefixes.forEach((prefix) => {
      decl.cloneBefore({
        prop: `-${prefix}-${decl.prop}`,
        value: decl.value
      });
    });
  }
  addSpecialValuePrefixes(decl) {
    const { prop, value } = decl;
    if (prop === "display") {
      if (value === "flex" || value === "inline-flex") {
        decl.cloneBefore({ prop: "display", value: `-webkit-${value}` });
        decl.cloneBefore({
          prop: "display",
          value: value === "flex" ? "-ms-flexbox" : "-ms-inline-flexbox"
        });
      }
      if (value === "grid" || value === "inline-grid") {
        decl.cloneBefore({
          prop: "display",
          value: value === "grid" ? "-ms-grid" : "-ms-inline-grid"
        });
      }
    }
    if (prop === "background-clip" && value === "text") {
      decl.cloneBefore({ prop: "-webkit-background-clip", value: "text" });
    }
    if (prop === "position" && value === "sticky") {
      decl.cloneBefore({ prop: "position", value: "-webkit-sticky" });
    }
  }
  findFeature(property) {
    if (!this.caniuseData) return null;
    const featureMap = {
      "transform": "transforms2d",
      "transform-origin": "transforms2d",
      "transform-style": "transforms3d",
      "perspective": "transforms3d",
      "backface-visibility": "transforms3d",
      "transition": "css-transitions",
      "animation": "css-animation",
      "backdrop-filter": "backdrop-filter",
      "filter": "css-filters",
      "user-select": "user-select-none",
      "appearance": "css-appearance",
      "mask-image": "css-masks",
      "box-shadow": "css-boxshadow",
      "border-radius": "border-radius",
      "text-fill-color": "text-stroke",
      "text-stroke": "text-stroke",
      "background-clip": "background-img-opts",
      "flex": "flexbox",
      "flex-grow": "flexbox",
      "flex-shrink": "flexbox",
      "flex-basis": "flexbox",
      "justify-content": "flexbox",
      "align-items": "flexbox",
      "grid": "css-grid",
      "grid-template": "css-grid",
      "grid-column": "css-grid",
      "grid-row": "css-grid"
    };
    const featureId = featureMap[property];
    return featureId ? this.caniuseData[featureId] : null;
  }
  getCommonProperties() {
    return [
      "transform",
      "transform-origin",
      "transform-style",
      "transition",
      "transition-property",
      "transition-duration",
      "transition-timing-function",
      "animation",
      "animation-name",
      "animation-duration",
      "animation-timing-function",
      "animation-delay",
      "animation-iteration-count",
      "animation-direction",
      "animation-fill-mode",
      "animation-play-state",
      "backdrop-filter",
      "filter",
      "user-select",
      "appearance",
      "text-fill-color",
      "text-stroke",
      "text-stroke-color",
      "text-stroke-width",
      "background-clip",
      "mask-image",
      "mask-clip",
      "mask-composite",
      "mask-origin",
      "mask-position",
      "mask-repeat",
      "mask-size",
      "box-shadow",
      "border-radius",
      "box-sizing",
      "display",
      "flex",
      "flex-grow",
      "flex-shrink",
      "flex-basis",
      "justify-content",
      "align-items",
      "align-self",
      "align-content",
      "grid",
      "grid-template",
      "grid-column",
      "grid-row",
      "gap",
      "column-gap",
      "row-gap"
    ];
  }
  // Utility method to check if a browser needs a specific prefix
  needsPrefix(property, browser, version) {
    const feature = this.findFeature(property);
    if (!feature) return false;
    const stats = feature.stats[browser];
    if (!stats) return false;
    const support = stats[version.toString()];
    return support ? support.includes("x") : false;
  }
  // Get all available prefixes for a property
  getAvailablePrefixes(property) {
    const prefixes = LIGHTWEIGHT_PREFIX_MAP[property];
    if (!prefixes) return [];
    return Object.keys(prefixes);
  }
  // Reset the prefixer state
  reset() {
    this.warnings = [];
    this.targetBrowsers = null;
    this.hasAutoprefixer = false;
    this.hasBuiltInDeps = false;
  }
};

// src/compiler/cache-manager.ts
import fs4 from "fs";
import path3 from "path";
var CacheManager = class {
  cachePath;
  cacheDir;
  cache;
  dirty = false;
  saveTimer = null;
  stats = {
    hits: 0,
    misses: 0,
    writes: 0,
    reads: 0
  };
  options;
  constructor(cachePath = "./.chaincss-cache", options = {}) {
    this.options = {
      maxAge: options.maxAge || 7 * 24 * 60 * 60 * 1e3,
      // 7 days default
      maxSize: options.maxSize || 100 * 1024 * 1024,
      // 100MB default
      compress: options.compress || false,
      autoSave: options.autoSave !== false,
      saveInterval: options.saveInterval || 5e3
      // 5 seconds
    };
    this.cachePath = path3.resolve(process.cwd(), cachePath);
    this.cacheDir = path3.dirname(this.cachePath);
    this.cache = {};
    this.load();
    if (this.options.autoSave) {
      this.startAutoSave();
    }
  }
  startAutoSave() {
    if (this.saveTimer) clearInterval(this.saveTimer);
    this.saveTimer = setInterval(() => {
      if (this.dirty) {
        this.save();
      }
    }, this.options.saveInterval);
    if (this.saveTimer.unref) {
      this.saveTimer.unref();
    }
  }
  stopAutoSave() {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }
  load() {
    try {
      if (fs4.existsSync(this.cachePath)) {
        let data = fs4.readFileSync(this.cachePath, "utf8");
        if (this.options.compress && this.isCompressed(data)) {
          data = this.decompress(data);
        }
        this.cache = JSON.parse(data);
        if (this.isExpired()) {
          console.log("Cache expired, clearing...");
          this.clear();
          this.cache = this.getDefaultCache();
        }
        this.checkAndPrune();
      } else {
        if (!fs4.existsSync(this.cacheDir)) {
          fs4.mkdirSync(this.cacheDir, { recursive: true });
        }
        this.cache = this.getDefaultCache();
      }
    } catch (error) {
      console.warn("Could not load cache, starting fresh:", error.message);
      this.cache = this.getDefaultCache();
    }
  }
  getDefaultCache() {
    return {
      version: "2.0.0",
      created: (/* @__PURE__ */ new Date()).toISOString(),
      updated: (/* @__PURE__ */ new Date()).toISOString(),
      atomic: {},
      usage: {},
      componentMap: {},
      stats: {
        totalStyles: 0,
        atomicStyles: 0,
        cacheHits: 0,
        cacheMisses: 0
      }
    };
  }
  isExpired() {
    const created = this.cache.created ? new Date(this.cache.created).getTime() : 0;
    const now = Date.now();
    return now - created > this.options.maxAge;
  }
  checkAndPrune() {
    try {
      const stats = fs4.statSync(this.cachePath);
      if (stats.size > this.options.maxSize) {
        console.log(`Cache size (${stats.size} bytes) exceeds limit (${this.options.maxSize} bytes), pruning...`);
        this.prune();
      }
    } catch (error) {
    }
  }
  isCompressed(data) {
    return data.startsWith("COMPRESSED:");
  }
  compress(data) {
    const compressed = Buffer.from(data).toString("base64");
    return `COMPRESSED:${compressed}`;
  }
  decompress(data) {
    if (data.startsWith("COMPRESSED:")) {
      const compressed = data.substring(11);
      return Buffer.from(compressed, "base64").toString();
    }
    return data;
  }
  get(key) {
    this.stats.reads++;
    if (this.cache[key] !== void 0) {
      if (this.cache[key].expires && this.cache[key].expires < Date.now()) {
        delete this.cache[key];
        this.stats.misses++;
        this.dirty = true;
        return void 0;
      }
      this.stats.hits++;
      if (this.cache.stats) {
        this.cache.stats.cacheHits++;
      }
      return this.cache[key];
    }
    this.stats.misses++;
    if (this.cache.stats) {
      this.cache.stats.cacheMisses++;
    }
    return void 0;
  }
  set(key, value, ttl) {
    const entry = {
      ...value,
      cachedAt: Date.now(),
      expires: ttl ? Date.now() + ttl : void 0
    };
    this.cache[key] = entry;
    this.dirty = true;
    this.stats.writes++;
    if (this.cache.stats && key !== "stats") {
      if (key === "atomic") {
        this.cache.stats.atomicStyles = Object.keys(value).length;
      }
    }
  }
  has(key) {
    const value = this.get(key);
    return value !== void 0;
  }
  delete(key) {
    if (this.cache[key] !== void 0) {
      delete this.cache[key];
      this.dirty = true;
      return true;
    }
    return false;
  }
  clear() {
    this.cache = this.getDefaultCache();
    this.dirty = true;
    this.stats = { hits: 0, misses: 0, writes: 0, reads: 0 };
    if (fs4.existsSync(this.cachePath)) {
      try {
        fs4.unlinkSync(this.cachePath);
      } catch (error) {
        console.warn("Could not delete cache file:", error.message);
      }
    }
    console.log("Cache cleared");
  }
  prune() {
    const now = Date.now();
    let prunedCount = 0;
    for (const [key, value] of Object.entries(this.cache)) {
      if (["version", "created", "updated", "stats"].includes(key)) continue;
      if (value.expires && value.expires < now) {
        delete this.cache[key];
        prunedCount++;
      }
    }
    this.cache.updated = (/* @__PURE__ */ new Date()).toISOString();
    this.dirty = true;
    if (prunedCount > 0 && this.options.autoSave) {
      console.log(`Pruned ${prunedCount} expired cache entries`);
    }
  }
  save() {
    if (!this.dirty) return;
    try {
      this.cache.updated = (/* @__PURE__ */ new Date()).toISOString();
      if (this.cache.stats) {
        this.cache.stats = { ...this.cache.stats, ...this.stats };
      }
      let data = JSON.stringify(this.cache, null, 2);
      if (this.options.compress && data.length > 1024) {
        data = this.compress(data);
      }
      if (!fs4.existsSync(this.cacheDir)) {
        fs4.mkdirSync(this.cacheDir, { recursive: true });
      }
      const tempPath = `${this.cachePath}.tmp`;
      fs4.writeFileSync(tempPath, data, "utf8");
      fs4.renameSync(tempPath, this.cachePath);
      this.dirty = false;
    } catch (error) {
      console.warn("Could not save cache:", error.message);
    }
  }
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? this.stats.hits / total * 100 : 0;
    let size = 0;
    try {
      if (fs4.existsSync(this.cachePath)) {
        const stats = fs4.statSync(this.cachePath);
        size = stats.size;
      }
    } catch (error) {
    }
    const entryCount = Object.keys(this.cache).filter(
      (k) => !["version", "created", "updated", "stats"].includes(k)
    ).length;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      reads: this.stats.reads,
      writes: this.stats.writes,
      hitRate,
      size,
      entryCount
    };
  }
  getCacheSize() {
    try {
      if (fs4.existsSync(this.cachePath)) {
        const stats = fs4.statSync(this.cachePath);
        return stats.size;
      }
    } catch (error) {
    }
    return 0;
  }
  getCacheAge() {
    try {
      if (fs4.existsSync(this.cachePath)) {
        const stats = fs4.statSync(this.cachePath);
        return Date.now() - stats.mtimeMs;
      }
    } catch (error) {
    }
    return 0;
  }
  getKeys() {
    return Object.keys(this.cache).filter(
      (k) => !["version", "created", "updated", "stats"].includes(k)
    );
  }
  getSize() {
    return this.getCacheSize();
  }
  isDirty() {
    return this.dirty;
  }
  async flush() {
    if (this.dirty) {
      this.save();
    }
  }
  destroy() {
    this.stopAutoSave();
    this.clear();
  }
  // Get cache entry with metadata
  getEntry(key) {
    const entry = this.cache[key];
    if (entry && (!entry.expires || entry.expires > Date.now())) {
      return {
        value: entry.value !== void 0 ? entry.value : entry,
        cachedAt: entry.cachedAt,
        expires: entry.expires
      };
    }
    return void 0;
  }
  // Set cache entry with custom TTL in seconds
  setWithTTL(key, value, ttlSeconds) {
    this.set(key, value, ttlSeconds * 1e3);
  }
  // Bulk set multiple entries
  setBulk(entries) {
    for (const [key, value] of Object.entries(entries)) {
      this.set(key, value);
    }
  }
  // Bulk get multiple entries
  getBulk(keys) {
    const result = {};
    for (const key of keys) {
      const value = this.get(key);
      if (value !== void 0) {
        result[key] = value;
      }
    }
    return result;
  }
  // Get or compute cache value
  async getOrCompute(key, compute, ttl) {
    const cached = this.get(key);
    if (cached !== void 0) {
      return cached;
    }
    const computed2 = await compute();
    this.set(key, computed2, ttl);
    return computed2;
  }
};

// src/compiler/content-addressable-cache.ts
import crypto3 from "crypto";
import fs5 from "fs";
import path4 from "path";
var PersistentCache = class {
  cacheDir;
  options;
  memoryCache = /* @__PURE__ */ new Map();
  metadataPath;
  metadata;
  constructor(options = {}) {
    this.options = {
      cacheDir: options.cacheDir || "./.chaincss/persistent-cache",
      maxAgeDays: options.maxAgeDays || 30,
      maxSizeMB: options.maxSizeMB || 500,
      enabled: options.enabled !== false,
      verbose: options.verbose || false
    };
    this.cacheDir = path4.resolve(process.cwd(), this.options.cacheDir);
    this.metadataPath = path4.join(this.cacheDir, "metadata.json");
    this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
    if (this.options.enabled) {
      this.ensureDir();
      this.loadMetadata();
    }
  }
  hash(content) {
    return crypto3.createHash("sha256").update(content).digest("hex");
  }
  hashFile(filePath) {
    if (!fs5.existsSync(filePath)) return null;
    const content = fs5.readFileSync(filePath, "utf8");
    return this.hash(content);
  }
  // ============================================================================
  // Async Methods (Original)
  // ============================================================================
  async getByContent(source) {
    if (!this.options.enabled) return null;
    const hash = this.hash(source);
    return this.getByHash(hash);
  }
  async getByFile(filePath) {
    if (!this.options.enabled) return null;
    if (!fs5.existsSync(filePath)) return null;
    const source = fs5.readFileSync(filePath, "utf8");
    return this.getByContent(source);
  }
  async getByHash(hash) {
    if (!this.options.enabled) return null;
    if (this.memoryCache.has(hash)) {
      const entry = this.memoryCache.get(hash);
      if (!this.isExpired(entry)) {
        if (this.options.verbose) {
          console.log(`[persistent-cache] Memory HIT for hash ${hash.slice(0, 8)}`);
        }
        return entry.result;
      } else {
        this.memoryCache.delete(hash);
      }
    }
    const cachePath = path4.join(this.cacheDir, `${hash}.json`);
    if (fs5.existsSync(cachePath)) {
      try {
        const entry = JSON.parse(fs5.readFileSync(cachePath, "utf8"));
        if (!this.isExpired(entry)) {
          this.memoryCache.set(hash, entry);
          if (this.options.verbose) {
            console.log(`[persistent-cache] Disk HIT for hash ${hash.slice(0, 8)}`);
          }
          return entry.result;
        } else {
          fs5.unlinkSync(cachePath);
          if (this.options.verbose) {
            console.log(`[persistent-cache] Expired entry removed: ${hash.slice(0, 8)}`);
          }
        }
      } catch (err) {
      }
    }
    return null;
  }
  async setByContent(source, result, dependencies = []) {
    if (!this.options.enabled) return "";
    const hash = this.hash(source);
    return this.setByHash(hash, result, dependencies);
  }
  async setByFile(filePath, result, dependencies = []) {
    if (!this.options.enabled) return "";
    if (!fs5.existsSync(filePath)) return "";
    const source = fs5.readFileSync(filePath, "utf8");
    return this.setByContent(source, result, dependencies);
  }
  async setByHash(hash, result, dependencies = []) {
    if (!this.options.enabled) return hash;
    const depHashes = {};
    for (const dep of dependencies) {
      const depHash = this.hashFile(dep);
      if (depHash) {
        depHashes[dep] = depHash;
      }
    }
    const entry = {
      hash,
      result,
      dependencies: depHashes,
      timestamp: Date.now(),
      version: "2.0.0",
      compilerVersion: "2.0.7"
    };
    this.memoryCache.set(hash, entry);
    const cachePath = path4.join(this.cacheDir, `${hash}.json`);
    fs5.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
    await this.updateMetadata(hash, entry);
    await this.enforceSizeLimit();
    if (this.options.verbose) {
      console.log(`[persistent-cache] Stored hash ${hash.slice(0, 8)} (${dependencies.length} deps)`);
    }
    return hash;
  }
  // ============================================================================
  // SYNC Methods (Added for compiler.ts compatibility)
  // ============================================================================
  getByHashSync(hash) {
    if (!this.options.enabled) return null;
    if (this.memoryCache.has(hash)) {
      const entry = this.memoryCache.get(hash);
      if (!this.isExpired(entry)) {
        return entry.result;
      } else {
        this.memoryCache.delete(hash);
      }
    }
    const cachePath = path4.join(this.cacheDir, `${hash}.json`);
    if (fs5.existsSync(cachePath)) {
      try {
        const entry = JSON.parse(fs5.readFileSync(cachePath, "utf8"));
        if (!this.isExpired(entry)) {
          this.memoryCache.set(hash, entry);
          return entry.result;
        } else {
          fs5.unlinkSync(cachePath);
        }
      } catch (err) {
      }
    }
    return null;
  }
  setByHashSync(hash, result, source, dependencies = []) {
    if (!this.options.enabled) return;
    const depHashes = {};
    for (const dep of dependencies) {
      if (typeof dep === "string" && fs5.existsSync(dep)) {
        const depSource = fs5.readFileSync(dep, "utf8");
        depHashes[dep] = this.hash(depSource);
      }
    }
    const entry = {
      hash,
      result,
      dependencies: depHashes,
      timestamp: Date.now(),
      version: "2.0.0",
      compilerVersion: "2.0.7"
    };
    this.memoryCache.set(hash, entry);
    const cachePath = path4.join(this.cacheDir, `${hash}.json`);
    fs5.writeFileSync(cachePath, JSON.stringify(entry, null, 2));
    this.updateMetadataSync(hash, entry);
    this.enforceSizeLimitSync();
    if (this.options.verbose) {
      console.log(`[persistent-cache] Stored hash ${hash.slice(0, 8)} (${dependencies.length} deps)`);
    }
  }
  invalidateByHash(hash) {
    this.memoryCache.delete(hash);
    const cachePath = path4.join(this.cacheDir, `${hash}.json`);
    if (fs5.existsSync(cachePath)) {
      fs5.unlinkSync(cachePath);
    }
    delete this.metadata.entries[hash];
    fs5.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  // ============================================================================
  // Public Management Methods
  // ============================================================================
  async clear() {
    const files = fs5.readdirSync(this.cacheDir);
    for (const file of files) {
      if (file.endsWith(".json")) {
        fs5.unlinkSync(path4.join(this.cacheDir, file));
      }
    }
    this.memoryCache.clear();
    this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
    fs5.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
    if (this.options.verbose) {
      console.log("[persistent-cache] Cache cleared");
    }
  }
  async getStats() {
    const entries = Object.values(this.metadata.entries);
    if (entries.length === 0) {
      return {
        entryCount: 0,
        totalSizeMB: 0,
        totalSizeBytes: 0,
        oldestEntry: 0,
        newestEntry: 0,
        hitRate: 0
      };
    }
    const timestamps = entries.map((e) => e.timestamp);
    return {
      entryCount: entries.length,
      totalSizeMB: this.metadata.totalSize / 1024 / 1024,
      totalSizeBytes: this.metadata.totalSize,
      oldestEntry: Math.min(...timestamps),
      newestEntry: Math.max(...timestamps),
      hitRate: this.memoryCache.size / entries.length
    };
  }
  async prune() {
    await this.enforceSizeLimit();
    if (this.options.verbose) {
      console.log("[persistent-cache] Prune completed");
    }
  }
  // ============================================================================
  // Private Methods
  // ============================================================================
  isExpired(entry) {
    const age = Date.now() - entry.timestamp;
    const maxAge = this.options.maxAgeDays * 24 * 60 * 60 * 1e3;
    return age > maxAge;
  }
  loadMetadata() {
    if (fs5.existsSync(this.metadataPath)) {
      try {
        const data = JSON.parse(fs5.readFileSync(this.metadataPath, "utf8"));
        this.metadata = data;
      } catch (err) {
        this.metadata = { entries: {}, totalSize: 0, lastCleanup: 0 };
      }
    }
  }
  async updateMetadata(hash, entry) {
    const cachePath = path4.join(this.cacheDir, `${hash}.json`);
    const stats = fs5.statSync(cachePath);
    this.metadata.entries[hash] = {
      hash,
      size: stats.size,
      timestamp: entry.timestamp
    };
    this.metadata.totalSize += stats.size;
    this.metadata.lastCleanup = Date.now();
    fs5.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  updateMetadataSync(hash, entry) {
    const cachePath = path4.join(this.cacheDir, `${hash}.json`);
    const stats = fs5.statSync(cachePath);
    this.metadata.entries[hash] = {
      hash,
      size: stats.size,
      timestamp: entry.timestamp
    };
    this.metadata.totalSize += stats.size;
    this.metadata.lastCleanup = Date.now();
    fs5.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  async enforceSizeLimit() {
    const limitBytes = this.options.maxSizeMB * 1024 * 1024;
    if (this.metadata.totalSize <= limitBytes) {
      return;
    }
    if (this.options.verbose) {
      console.log(`[persistent-cache] Cache size (${(this.metadata.totalSize / 1024 / 1024).toFixed(2)}MB) exceeds limit (${this.options.maxSizeMB}MB). Cleaning...`);
    }
    const entries = Object.values(this.metadata.entries).sort((a, b) => a.timestamp - b.timestamp);
    let freedSpace = 0;
    for (const entry of entries) {
      if (this.metadata.totalSize - freedSpace <= limitBytes) break;
      const cachePath = path4.join(this.cacheDir, `${entry.hash}.json`);
      if (fs5.existsSync(cachePath)) {
        freedSpace += entry.size;
        fs5.unlinkSync(cachePath);
        delete this.metadata.entries[entry.hash];
        this.memoryCache.delete(entry.hash);
      }
    }
    this.metadata.totalSize -= freedSpace;
    fs5.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
    if (this.options.verbose) {
      console.log(`[persistent-cache] Cleaned ${(freedSpace / 1024 / 1024).toFixed(2)}MB`);
    }
  }
  enforceSizeLimitSync() {
    const limitBytes = this.options.maxSizeMB * 1024 * 1024;
    if (this.metadata.totalSize <= limitBytes) {
      return;
    }
    const entries = Object.values(this.metadata.entries).sort((a, b) => a.timestamp - b.timestamp);
    let freedSpace = 0;
    for (const entry of entries) {
      if (this.metadata.totalSize - freedSpace <= limitBytes) break;
      const cachePath = path4.join(this.cacheDir, `${entry.hash}.json`);
      if (fs5.existsSync(cachePath)) {
        freedSpace += entry.size;
        fs5.unlinkSync(cachePath);
        delete this.metadata.entries[entry.hash];
        this.memoryCache.delete(entry.hash);
      }
    }
    this.metadata.totalSize -= freedSpace;
    fs5.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
  }
  ensureDir() {
    if (!fs5.existsSync(this.cacheDir)) {
      fs5.mkdirSync(this.cacheDir, { recursive: true });
    }
  }
  /**
   * List all cache entries
   */
  async listEntries() {
    const entries = [];
    for (const [hash, metadata] of Object.entries(this.metadata.entries)) {
      const entry = this.memoryCache.get(hash) || await this.getByHash(hash);
      entries.push({
        key: hash,
        size: metadata.size,
        timestamp: metadata.timestamp,
        createdAt: metadata.timestamp,
        lastAccessed: entry?.timestamp
      });
    }
    return entries.sort((a, b) => b.timestamp - a.timestamp);
  }
  /**
   * Get a cache entry by key
   */
  async get(key) {
    return this.getByHash(key);
  }
  /**
   * Delete a cache entry by key
   */
  async delete(key) {
    try {
      this.invalidateByHash(key);
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Validate a cache entry
   */
  async validate(key) {
    const entry = await this.getByHash(key);
    if (!entry) return false;
    return !this.isExpired(entry);
  }
};

// src/core/compiler.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path5.dirname(__filename);
var ChainCSSCompiler = class {
  config;
  prefixer = null;
  atomicOptimizer = null;
  sharedStyles = /* @__PURE__ */ new Map();
  styleCache = /* @__PURE__ */ new Map();
  classMap = /* @__PURE__ */ new Map();
  runtimeCache;
  persistentCache;
  MAX_STYLE_CACHE_SIZE = PERFORMANCE.CACHE_MAX_ENTRIES || 500;
  importedModules = /* @__PURE__ */ new Map();
  dependencyGraph = /* @__PURE__ */ new Map();
  generatedCSS = "";
  accumulatedCSS = "";
  compileInProgress = false;
  compileQueue = [];
  // LRU tracking for O(1) eviction
  lruList = [];
  constructor(config) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      atomic: {
        ...DEFAULT_CONFIG.atomic,
        ...config.atomic,
        neverAtomic: [...NEVER_ATOMIC_PROPERTIES, ...config.atomic?.neverAtomic || []],
        alwaysAtomic: [...ALWAYS_ATOMIC_PROPERTIES, ...config.atomic?.alwaysAtomic || []]
      }
    };
    this.setupCompilerGlobals();
    this.runtimeCache = new CacheManager(this.config.cachePath || "./.chaincss-cache");
    this.persistentCache = new PersistentCache({
      cacheDir: this.config.persistentCachePath || "./.chaincss/persistent-cache",
      maxAgeDays: this.config.cacheMaxAgeDays || 30,
      maxSizeMB: this.config.cacheMaxSizeMB || 500,
      enabled: this.config.cacheEnabled !== false,
      verbose: this.config.verbose
    });
    this.atomicOptimizer = new AtomicOptimizer(this.config);
    this.initOptimizer();
    this.initPrefixer();
  }
  hasStyles() {
    const combined = this.getCombinedCSS();
    return !!(combined && combined.trim().length > 0);
  }
  async processStyleObject(styleObj, componentName) {
    if (!this.atomicOptimizer) return;
    const finalStyle = {};
    for (let [key, value] of Object.entries(styleObj)) {
      if (key === "hover" && typeof value === "object") {
        const expandedHover = {};
        for (const [hk, hv] of Object.entries(value)) {
          const realKey2 = shorthandMap[hk] || hk;
          expandedHover[realKey2] = hv;
        }
        finalStyle.hover = expandedHover;
        continue;
      }
      if (key === "atRules") {
        finalStyle.atRules = value;
        continue;
      }
      if (key.startsWith(".") || key.startsWith("&")) {
        finalStyle[key] = value;
        continue;
      }
      const realKey = shorthandMap[key] || key;
      finalStyle[realKey] = value;
    }
    const result = this.atomicOptimizer.optimize({
      [componentName]: {
        selectors: [componentName],
        ...finalStyle
      }
    });
    if (result.css && result.css.trim()) {
      this.accumulatedCSS += result.css + "\n";
    }
    const cacheKey = crypto4.createHash("sha256").update(`${componentName}-${JSON.stringify(styleObj)}`).digest("hex").slice(0, 16);
    this.addToCache(cacheKey, {
      result: {
        css: result.css || "",
        classMap: result.map || {},
        atomicClasses: [],
        stats: this.getStats()
      },
      accessCount: 1,
      lastAccessed: Date.now(),
      hash: cacheKey
    });
  }
  addToCache(key, entry) {
    if (this.styleCache.has(key)) {
      this.styleCache.set(key, entry);
      this.lruList = this.lruList.filter((k) => k !== key);
      this.lruList.push(key);
      return;
    }
    while (this.styleCache.size >= this.MAX_STYLE_CACHE_SIZE && this.lruList.length > 0) {
      const oldest = this.lruList.shift();
      if (oldest) {
        this.styleCache.delete(oldest);
        if (this.config.verbose) {
          console.log(chalk3.gray(`  \u{1F9F9} Cache evicted: ${oldest.slice(0, 8)}...`));
        }
      }
    }
    this.styleCache.set(key, entry);
    this.lruList.push(key);
  }
  /**
   * Scans a raw source string (from Vite) for useChainStyles patterns 
   * and registers them with the optimizer.
   * Uses brace-counting parser instead of fragile regex.
   */
  async compileSource(source, id) {
    if (!this.atomicOptimizer || id.includes("\0")) return;
    try {
      let processedCount = 0;
      let searchFrom = 0;
      while (true) {
        const startIdx = source.indexOf("useChainStyles({", searchFrom);
        if (startIdx === -1) break;
        const braceStart = source.indexOf("{", startIdx);
        if (braceStart === -1) break;
        let braceCount = 0;
        let endIdx = -1;
        for (let i = braceStart; i < source.length; i++) {
          if (source[i] === "{") braceCount++;
          if (source[i] === "}") braceCount--;
          if (braceCount === 0) {
            endIdx = i;
            break;
          }
        }
        if (endIdx === -1) break;
        const stylesBlock = source.substring(braceStart + 1, endIdx);
        try {
          const componentRegex = /(\w+):\s*\{/g;
          let componentMatch;
          while ((componentMatch = componentRegex.exec(stylesBlock)) !== null) {
            const componentKey = componentMatch[1];
            const componentStart = componentMatch.index + componentMatch[0].length;
            let compBraceCount = 0;
            let compEndIdx = -1;
            for (let i = componentStart - 1; i < stylesBlock.length; i++) {
              if (stylesBlock[i] === "{") compBraceCount++;
              if (stylesBlock[i] === "}") compBraceCount--;
              if (compBraceCount === 0) {
                compEndIdx = i;
                break;
              }
            }
            if (compEndIdx === -1) continue;
            const componentStyles = stylesBlock.substring(componentStart, compEndIdx);
            const rawObj = this.safeParseStyleObject(`{${componentStyles}}`);
            if (Object.keys(rawObj).length === 0) continue;
            const expandedObj = {};
            for (const [k, v] of Object.entries(rawObj)) {
              const realKey = shorthandMap[k] || k;
              expandedObj[realKey] = v;
            }
            await this.processStyleObject(expandedObj, componentKey);
            processedCount++;
          }
        } catch (parseError) {
          if (this.config.verbose) {
            console.warn(chalk3.yellow(`  \u26A0\uFE0F  Failed to parse styles in ${id}: ${parseError}`));
          }
        }
        searchFrom = endIdx + 1;
      }
      if (this.config.verbose && processedCount > 0) {
        console.log(chalk3.gray(`  \u{1F4DD} Processed ${processedCount} styles from ${id}`));
      }
    } catch (error) {
      console.error(chalk3.red(`  \u274C Error compiling source ${id}: ${error}`));
    }
  }
  /**
   * Safely parse a style object string without using eval.
   * Supports JSON-like syntax and token references.
   */
  safeParseStyleObject(input) {
    try {
      let cleaned = input.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
      const tokenPlaceholders = [];
      cleaned = cleaned.replace(/\$([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)/g, (match) => {
        tokenPlaceholders.push(match);
        return `"__TOKEN_${tokenPlaceholders.length - 1}__"`;
      });
      if (cleaned.trim().startsWith("{")) {
        try {
          const result = JSON.parse(cleaned);
          return this.restoreTokens(result, tokenPlaceholders);
        } catch {
          return this.parseObjectLiteral(cleaned, tokenPlaceholders);
        }
      }
    } catch (err) {
      if (this.config.verbose) {
        console.warn(chalk3.yellow(`  \u26A0\uFE0F  Failed to parse style body: ${input.substring(0, 100)}...`));
      }
    }
    return {};
  }
  /**
   * Parse a limited subset of JavaScript object literal syntax.
   * Handles: strings, numbers, booleans, null, nested objects, arrays.
   * Does NOT execute code.
   */
  parseObjectLiteral(str, tokenPlaceholders) {
    try {
      let normalized = str.replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"').replace(/(\{|\,)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g, '$1"$2":').replace(/,\s*([}\]])/g, "$1");
      const result = JSON.parse(normalized);
      return this.restoreTokens(result, tokenPlaceholders);
    } catch {
      return {};
    }
  }
  restoreTokens(obj, tokens3) {
    if (typeof obj === "string") {
      const match = obj.match(/^__TOKEN_(\d+)__$/);
      if (match) {
        const idx = parseInt(match[1]);
        return tokens3[idx] || obj;
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.restoreTokens(item, tokens3));
    }
    if (obj && typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.restoreTokens(value, tokens3);
      }
      return result;
    }
    return obj;
  }
  /**
   * @deprecated Use safeParseStyleObject instead.
   * Kept for backward compatibility during migration.
   */
  looseParse(styleBody) {
    return this.safeParseStyleObject(styleBody);
  }
  setupCompilerGlobals() {
    setSourceComments(this.config.sourceComments !== false);
    if (this.config.breakpoints) {
      setBreakpoints(this.config.breakpoints);
    }
  }
  // ============================================================================
  // Caching & Imports
  // ============================================================================
  hashStyleDef(styleDef) {
    const { _componentName, _generateComponent, _framework, _propsDefinition, ...relevant } = styleDef;
    return crypto4.createHash("sha256").update(JSON.stringify(relevant)).digest("hex").slice(0, 16);
  }
  async importModule(filePath) {
    const absolutePath = path5.resolve(filePath);
    if (!fs6.existsSync(absolutePath)) {
      throw new Error(`File not found: ${absolutePath}`);
    }
    const fileUrl = pathToFileURL(absolutePath).href;
    try {
      if (filePath.endsWith(".tsx") || filePath.endsWith(".jsx")) {
        throw new Error(`Component file ${path5.basename(filePath)} will be processed by scanner`);
      }
      const moduleId = `${fileUrl}?t=${Date.now()}`;
      const imported = await import(
        /* @vite-ignore */
        moduleId
      );
      return imported.default && typeof imported.default === "object" ? { ...imported.default, ...imported } : imported;
    } catch (error) {
      error.message = `Failed to import ${path5.basename(filePath)}: ${error.message}`;
      throw error;
    }
  }
  // ============================================================================
  // Compilation Methods
  // ============================================================================
  compileStyle(styleId, styleDef) {
    const hash = this.hashStyleDef(styleDef);
    const cacheKey = `${styleId}:${hash}`;
    if (this.styleCache.has(cacheKey)) {
      const cached = this.styleCache.get(cacheKey);
      cached.lastAccessed = Date.now();
      cached.accessCount++;
      this.lruList = this.lruList.filter((k) => k !== cacheKey);
      this.lruList.push(cacheKey);
      return cached.result;
    }
    let finalCSS = compile({ [styleId]: styleDef });
    let finalClassName = generateClassName(styleId, this.config.atomic.naming);
    let atomicClassNames = [];
    let atomicClasses = [];
    if (this.atomicOptimizer && this.config.atomic.enabled) {
      const optimized = this.atomicOptimizer.optimize({ [styleId]: styleDef });
      const componentMapping = this.atomicOptimizer.getComponentMapEntry(styleId);
      atomicClassNames = componentMapping?.atomicClasses || [];
      atomicClasses = atomicClassNames.map((className) => {
        const atomicEntry = this.atomicOptimizer?.getAtomicEntry?.(className);
        if (atomicEntry) {
          return atomicEntry;
        }
        return {
          className,
          prop: "",
          value: "",
          usageCount: 0,
          rules: ""
        };
      }).filter(Boolean);
      if (optimized.map && optimized.map[styleId]) {
        finalClassName = [optimized.map[styleId], ...atomicClassNames].join(" ");
      }
      if (optimized.css && optimized.css.trim()) {
        finalCSS = optimized.css;
      }
    }
    const result = {
      css: formatCSS(finalCSS, this.config.output.minify),
      classMap: { [styleId]: finalClassName },
      atomicClasses,
      stats: this.getStats()
    };
    this.addToCache(cacheKey, {
      result,
      accessCount: 1,
      lastAccessed: Date.now(),
      hash
    });
    return result;
  }
  compileRecipe(recipeId, recipeValue) {
    try {
      const getAllVariants = recipeValue.getAllVariants;
      if (typeof getAllVariants === "function") {
        const variants = getAllVariants();
        let css = "";
        const classMap = {};
        let allAtomicClassObjects = [];
        for (const variant of variants) {
          const variantKey = Object.entries(variant).map(([k, v]) => `${k}-${v}`).join("_");
          const styleDef = recipeValue(variant);
          if (styleDef && styleDef.selectors) {
            const result = this.compileStyle(`${recipeId}_${variantKey}`, styleDef);
            css += result.css;
            Object.assign(classMap, result.classMap);
            if (result.atomicClasses && result.atomicClasses.length > 0) {
              allAtomicClassObjects.push(...result.atomicClasses);
            }
          }
        }
        const seen = /* @__PURE__ */ new Set();
        allAtomicClassObjects = allAtomicClassObjects.filter((ac) => {
          if (seen.has(ac.className)) return false;
          seen.add(ac.className);
          return true;
        });
        return {
          css: formatCSS(css, this.config.output.minify),
          classMap,
          atomicClasses: allAtomicClassObjects,
          stats: this.getStats()
        };
      }
    } catch (error) {
      console.error(`Failed to compile recipe ${recipeId}:`, error);
    }
    return {
      css: "",
      classMap: {},
      atomicClasses: [],
      stats: this.getStats()
    };
  }
  async compile(inputFile, outputDir) {
    const results = await this.compileFile(inputFile);
    const baseName = getBaseName(inputFile);
    this.generateCSSFile(results, path5.join(outputDir, `${baseName}.css`));
    return { results };
  }
  async compileFile(filePath) {
    const moduleExports = await this.importModule(filePath);
    const results = {};
    for (const [name, value] of Object.entries(moduleExports)) {
      if (typeof value === "function" && value.variants) {
        results[name] = this.compileRecipe(name, value);
      } else if (value && typeof value === "object" && value.selectors) {
        results[name] = this.compileStyle(name, value);
      }
    }
    return results;
  }
  async compileComponents(components) {
    if (this.compileInProgress) {
      return new Promise((resolve, reject) => {
        this.compileQueue.push({ resolve, reject });
      });
    }
    this.compileInProgress = true;
    try {
      if (this.atomicOptimizer) this.atomicOptimizer.reset();
      this.accumulatedCSS = "";
      if (!this.config.silent) {
        console.log(chalk3.blue("\n\u{1F50D} Phase 1: Scanning & Usage Analysis..."));
      }
      const BATCH_SIZE = PERFORMANCE.BATCH_SIZE || 10;
      const errors = [];
      for (let i = 0; i < components.length; i += BATCH_SIZE) {
        const batch = components.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (file) => {
          if (typeof file !== "string" || file.includes("\0") || file.startsWith("virtual:")) {
            return null;
          }
          if (!fs6.existsSync(file)) return null;
          try {
            if (file.endsWith(".tsx") || file.endsWith(".jsx")) {
              const result = scanFileForStyles(file, this.atomicOptimizer);
              if (result.errors.length > 0) {
                errors.push(...result.errors);
              }
            } else if (file.endsWith(".chain.js") || file.endsWith(".chain.ts")) {
              const exports = await this.importModule(file);
              const styles = exports.default || exports;
              const styleArray = Object.values(styles).filter((s) => s && typeof s === "object");
              this.atomicOptimizer?.trackStyles(styleArray);
            }
          } catch (err) {
            if (this.config.verbose) {
              console.warn(chalk3.yellow(`  \u26A0\uFE0F  Scanning fallback for ${path5.basename(file)}`));
            }
            const result = scanFileForStyles(file, this.atomicOptimizer);
            if (result.errors.length > 0) {
              errors.push(...result.errors);
            }
          }
          return null;
        });
        await Promise.allSettled(batchPromises);
        if (this.config.verbose && i % (BATCH_SIZE * 5) === 0) {
          console.log(chalk3.gray(`  \u{1F4CA} Processed ${Math.min(i + BATCH_SIZE, components.length)}/${components.length} files`));
        }
      }
      if (errors.length > 0 && this.config.verbose) {
        console.warn(chalk3.yellow(`  \u26A0\uFE0F  ${errors.length} scanning errors occurred`));
      }
      if (!this.config.silent) {
        console.log(chalk3.blue("\n\u{1F3D7}\uFE0F  Phase 2: Generating Component Styles..."));
      }
      const publicDir = path5.resolve(process.cwd(), "public");
      const manifestDir = path5.resolve(process.cwd(), ".chaincss", "manifest");
      if (!fs6.existsSync(publicDir)) fs6.mkdirSync(publicDir, { recursive: true });
      if (!fs6.existsSync(manifestDir)) fs6.mkdirSync(manifestDir, { recursive: true });
      let processedComponents = 0;
      const generatedClassFiles = [];
      let totalAtomicRules = 0;
      for (const file of components) {
        if (!file.endsWith(".chain.js") && !file.endsWith(".chain.ts")) continue;
        const baseName = path5.basename(file).replace(/\.chain\.(js|ts)$/, "");
        const sourceDir = path5.dirname(file);
        let hasContent = false;
        let jsBuffer = `/** 
 * ChainCSS Generated Class Map 
 * Source: ${path5.relative(process.cwd(), file)}
 * Generated: ${(/* @__PURE__ */ new Date()).toISOString()}
 * DO NOT EDIT MANUALLY
 */

`;
        let cssBuffer = "";
        try {
          const rawExports = await this.importModule(file);
          const styles = rawExports.default || rawExports;
          for (const [name, style] of Object.entries(styles)) {
            if (style && typeof style === "object" && style.selectors) {
              const result = this.compileStyle(name, style);
              if (this.config.verbose) {
                const className2 = Object.values(result.classMap)[0];
                console.log(chalk3.gray(`   \u{1F4DD} ${name} \u2192 ${className2 || "(empty)"}`));
              }
              const className = Object.values(result.classMap)[0];
              if (className) {
                jsBuffer += `export const ${name} = '${className}';
`;
                cssBuffer += result.css + "\n";
                hasContent = true;
                totalAtomicRules += result.atomicClasses?.length || 0;
              }
            }
          }
          if (hasContent) {
            const targetDir = path5.join(sourceDir, "style");
            if (!fs6.existsSync(targetDir)) {
              fs6.mkdirSync(targetDir, { recursive: true });
            }
            const classFilePath = path5.join(targetDir, `${baseName}.class.js`);
            fs6.writeFileSync(classFilePath, jsBuffer);
            generatedClassFiles.push(classFilePath);
            if (cssBuffer.trim()) {
              const cssFilePath = path5.join(targetDir, `${baseName}.css`);
              fs6.writeFileSync(cssFilePath, formatCSS(cssBuffer, false));
            }
            processedComponents++;
            if (this.config.verbose) {
              console.log(chalk3.green(`   \u2728 ${baseName} \u2192 ${path5.relative(process.cwd(), classFilePath)}`));
            }
          }
        } catch (error) {
          console.error(chalk3.red(`   \u274C Failed to process ${baseName}: ${error.message}`));
        }
      }
      if (!this.config.silent) {
        console.log(chalk3.blue("\n\u{1F30D} Phase 3: Finalizing Global Assets..."));
      }
      const finalAtomicCSS = this.atomicOptimizer ? this.atomicOptimizer.generateAtomicCSS() : "";
      const globalCssPath = path5.join(publicDir, "global.css");
      fs6.writeFileSync(globalCssPath, formatCSS(finalAtomicCSS, this.config.output.minify));
      if (this.config.verbose) {
        console.log(chalk3.blue(`   \u{1F4E6} Global CSS \u2192 ${path5.relative(process.cwd(), globalCssPath)} (${finalAtomicCSS.length} bytes)`));
      }
      const manifestData = {
        version: VERSION,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        atomicMap: this.atomicOptimizer?.atomicMap || {},
        stats: this.getStats(),
        classFiles: generatedClassFiles.map((f) => path5.relative(process.cwd(), f))
      };
      const manifestPath = path5.join(manifestDir, "manifest.json");
      fs6.writeFileSync(manifestPath, JSON.stringify(manifestData, null, 2));
      if (this.config.verbose) {
        console.log(chalk3.blue(`   \u{1F4E6} Manifest \u2192 ${path5.relative(process.cwd(), manifestPath)}`));
      }
      if (!this.config.silent) {
        console.log(chalk3.green(`
\u2705 Build Complete!`));
        console.log(chalk3.gray(`   \u{1F4C1} Components processed: ${processedComponents}`));
        console.log(chalk3.gray(`   \u{1F4C1} Class files generated: ${generatedClassFiles.length}`));
        console.log(chalk3.gray(`   \u{1F4C1} Global CSS: ${path5.relative(process.cwd(), globalCssPath)}`));
        console.log(chalk3.gray(`   \u{1F4C1} Manifest: ${path5.relative(process.cwd(), manifestPath)}`));
        if (this.atomicOptimizer) {
          const atomicCount = Object.keys(this.atomicOptimizer.atomicMap).length;
          const stats = this.atomicOptimizer.getStats();
          console.log(chalk3.cyan(`
\u{1F4CA} Optimization Stats:`));
          console.log(chalk3.gray(`   Atomic Rules: ${atomicCount}`));
          console.log(chalk3.gray(`   Total Styles: ${stats.totalStyles}`));
          console.log(chalk3.gray(`   Unique Properties: ${stats.uniqueProperties}`));
          if (stats.savings) {
            console.log(chalk3.green(`   CSS Savings: ${stats.savings}`));
          }
        }
      }
    } finally {
      this.compileInProgress = false;
      this.drainCompileQueue();
    }
  }
  /**
   * Drains the compile queue safely, handling items added during draining.
   */
  drainCompileQueue() {
    while (this.compileQueue.length > 0) {
      const queue = [...this.compileQueue];
      this.compileQueue = [];
      for (const item of queue) {
        item.resolve();
      }
    }
  }
  // ============================================================================
  // Utilities & Plugin Helpers
  // ============================================================================
  getCombinedCSS() {
    return this.accumulatedCSS;
  }
  clearCSS() {
    this.accumulatedCSS = "";
    this.styleCache.clear();
    this.lruList = [];
    if (this.atomicOptimizer) {
      this.atomicOptimizer.reset();
    }
    if (this.config.verbose) {
      console.log("[Compiler] CSS cache cleared");
    }
  }
  getStats() {
    const stats = this.atomicOptimizer?.getStats();
    return {
      totalStyles: stats?.totalStyles || 0,
      atomicStyles: stats?.atomicStyles || 0,
      uniqueProperties: stats?.uniqueProperties || 0,
      savings: stats?.savings || "0%"
    };
  }
  generateCSSFile(results, outputPath) {
    let css = "";
    for (const r of Object.values(results)) css += r.css;
    writeFile(outputPath, css);
  }
  getAtomicMap() {
    return this.atomicOptimizer?.classMap || {};
  }
  initOptimizer() {
    if (this.config.atomic.enabled) {
      if (!this.atomicOptimizer) {
        this.atomicOptimizer = new AtomicOptimizer(this.config.atomic);
        setAtomicOptimizer(this.atomicOptimizer);
      }
    }
  }
  initPrefixer() {
    if (this.config.prefixer.enabled) this.prefixer = new ChainCSSPrefixer(this.config.prefixer);
  }
};
async function compileChainCSS(inputFile, outputDir, config) {
  const compiler = new ChainCSSCompiler(config || {});
  return await compiler.compile(inputFile, outputDir);
}

// src/compiler/theme-contract.ts
var Theme = class {
  tokens;
  constructor(tokens3) {
    this.tokens = tokens3;
  }
  get(path6) {
    const parts = path6.split(".");
    let current = this.tokens;
    for (const part of parts) {
      if (current === void 0 || current === null) return void 0;
      current = current[part];
    }
    return typeof current === "string" ? current : void 0;
  }
  set(path6, value) {
    const parts = path6.split(".");
    let current = this.tokens;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
  }
  toObject() {
    return this.tokens;
  }
  toCSSVariables(prefix = "theme") {
    let css = "";
    const flatten = (obj, path6 = "") => {
      for (const [key, value] of Object.entries(obj)) {
        const newPath = path6 ? `${path6}-${key}` : key;
        if (typeof value === "object" && value !== null) {
          flatten(value, newPath);
        } else {
          css += `  --${prefix}-${newPath}: ${value};
`;
        }
      }
    };
    flatten(this.tokens);
    return `:root {
${css}}
`;
  }
};
function createThemeContract(contractShape) {
  const contract = contractShape;
  const contractProxy = Object.assign({}, contract, {
    __isContract: true,
    __validate: (theme) => validateTheme(contract, theme)
  });
  return contractProxy;
}
function validateTheme(contract, theme = {}, path6 = "") {
  const errors = [];
  function validate(contractPart, themePart, currentPath) {
    if (typeof contractPart === "object" && contractPart !== null) {
      const requiredKeys = Object.keys(contractPart);
      const themeKeys = Object.keys(themePart || {});
      requiredKeys.forEach((key) => {
        const newPath = currentPath ? `${currentPath}.${key}` : key;
        if (!themePart || !(key in themePart)) {
          errors.push(`  \u2717 Missing required token: "${newPath}"`);
        } else {
          validate(
            contractPart[key],
            themePart[key],
            newPath
          );
        }
      });
      themeKeys.forEach((key) => {
        if (!(key in contractPart)) {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          console.warn(`\u26A0\uFE0F Extra token not in contract: "${newPath}"`);
        }
      });
    } else {
      if (themePart !== void 0 && typeof themePart !== "string") {
        errors.push(`  \u2717 Token "${currentPath}" must be a string, got ${typeof themePart}`);
      }
    }
  }
  validate(contract, theme, path6);
  if (errors.length > 0) {
    throw new Error(`Theme Contract Validation Failed:
${errors.join("\n")}`);
  }
  return true;
}
function createTheme(contract, themeValues) {
  if (typeof contract.__validate === "function") {
    contract.__validate(themeValues);
  } else {
    validateTheme(contract, themeValues);
  }
  const tokens3 = {};
  function buildTokens(contractPart, themePart, target, _path = "") {
    Object.keys(contractPart).forEach((key) => {
      if (typeof contractPart[key] === "object" && contractPart[key] !== null) {
        target[key] = {};
        buildTokens(
          contractPart[key],
          themePart?.[key] || {},
          target[key],
          _path
        );
      } else {
        target[key] = themePart?.[key];
      }
    });
  }
  buildTokens(contract, themeValues, tokens3);
  return new Theme(tokens3);
}

// src/runtime/react.tsx
import React2, { useMemo, useRef as useRef2, useState as useState2, useEffect as useEffect2 } from "react";
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
function useChainStyles(styles, deps = [], options = {}) {
  const { namespace = "c", debug = false, ssr = false } = options;
  const instanceId = useRef2(Math.random().toString(36).substring(2, 7));
  const moduleId = useRef2(`chaincss-module-${instanceId.current}`);
  const [forceUpdate, setForceUpdate] = useState2(0);
  useEffect2(() => {
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
    for (const [key, styleDef] of Object.entries(styles)) {
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
  const styles = useMemo(() => styleFactory(), deps);
  return useChainStyles(styles, deps, options);
}
function useThemeChainStyles(styles, theme, options) {
  const themedStyles = useMemo(() => {
    if (typeof styles === "function") return styles(theme);
    return styles;
  }, [styles, theme]);
  return useChainStyles(themedStyles, [theme], options);
}
function ChainCSSGlobal({ styles, tokens: tokens3, children }) {
  if (tokens3) {
    setTokens(tokens3);
  }
  if (styles) {
    useChainStyles(styles, [], { watch: true });
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
function withChainStyles(styles, options) {
  return function WrappedComponent(props) {
    const styleProps = typeof styles === "function" ? styles(props) : styles;
    const classNames = useChainStyles(styleProps, [], options);
    const Component = props.component || props.wrappedComponent;
    return /* @__PURE__ */ jsx(Component, { ...props, chainStyles: classNames });
  };
}
function createStyledComponent(elementType, styles, options) {
  const StyledComponent = (props) => {
    const { className: additionalClassName, ...rest } = props;
    const styleDef = typeof styles === "function" ? styles() : styles;
    const classNames = useChainStyles({ root: styleDef }, [], options);
    const combinedClassName = cx(classNames.root, additionalClassName);
    return React2.createElement(elementType, {
      ...rest,
      className: combinedClassName
    });
  };
  const displayName = typeof elementType === "string" ? elementType : elementType.displayName || "Component";
  StyledComponent.displayName = `ChainCSS.${displayName}`;
  return StyledComponent;
}
function useComputedStyles(styles, props, deps = [], options) {
  const computedStyles = useMemo(() => styles(props), [props, ...deps]);
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
function useAtomicClasses(styles, options = {}) {
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
    const resolvedStyles = typeof styles === "function" ? styles() : styles?.value || styles;
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
  if (typeof styles === "object" && styles !== null && "value" in styles) {
    watch(styles, () => {
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
function createStyledComponent2(styles, tag = "div", options = {}) {
  return {
    name: "ChainCSSStyledComponent",
    props: {
      className: { type: String, default: "" },
      as: { type: String, default: tag }
    },
    setup(props, { slots, attrs }) {
      const resolvedStyles = typeof styles === "function" ? styles() : styles;
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
    const { element = "div", styles } = config;
    result[name] = createStyledComponent2(styles, element, options);
  }
  return result;
}
function useComputedStyles2(styles, props, options) {
  const computedStyles = computed(() => ({ root: styles(props) }));
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
function registerForHMR(moduleId, styles, callback) {
  const env = getHMREnvironment();
  if (env === "vite") {
    registerViteHMR(moduleId, styles, callback);
  } else if (env === "webpack") {
    registerWebpackHMR(moduleId, styles, callback);
  }
}
function registerViteHMR(moduleId, styles, callback) {
  const hot = import.meta.hot;
  if (!hot) return;
  hot.accept(() => {
    console.log(`[ChainCSS HMR] \u{1F504} Accepting update for ${moduleId}`);
    styleInjector.removeModule(moduleId);
    if (callback && styles) {
      callback(styles);
    }
  });
  hot.dispose(() => {
    console.log(`[ChainCSS HMR] \u{1F9F9} Disposing module: ${moduleId}`);
    styleInjector.removeModule(moduleId);
  });
}
function registerWebpackHMR(moduleId, styles, callback) {
  const hot = module.hot;
  if (!hot) return;
  hot.accept(() => {
    console.log(`[ChainCSS HMR] \u{1F504} Webpack HMR accept for ${moduleId}`);
    if (callback && styles) {
      callback(styles);
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
function hashString2(str) {
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
var isDevelopment = process.env.NODE_ENV === "development";
var isProduction = process.env.NODE_ENV === "production";
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

// src/index.ts
var VERSION2 = "3.0.0";
var index_default = chain;
if (typeof process !== "undefined" && process.env?.NODE_ENV !== "test") {
  chains.initializeProperties().catch((err) => {
    if (process.env?.DEBUG) {
      console.warn("[ChainCSS] Failed to load CSS properties:", err.message);
    }
  });
}
export {
  chain as $,
  $t,
  AtomicOptimizer,
  AutoDetector,
  CacheManager,
  ChainCSSCompiler,
  ChainCSSGlobal,
  ChainCSSGlobal3 as ChainCSSGlobalSvelte,
  ChainCSSGlobal2 as ChainCSSGlobalVue,
  ChainCSSPrefixer,
  DesignTokens,
  PersistentCache,
  Theme,
  VERSION2 as VERSION,
  animationPresets,
  autoDetector,
  buildChain,
  chain,
  chainStyles,
  smartChain as chainV3,
  clearTimeline,
  cn as cnUtils,
  compileRuntime as compile,
  compileChainCSS,
  configureAtomic,
  createAnimation,
  createDebugger,
  createTokens as createDesignTokens,
  createSmartComponent,
  createStyledComponent,
  createStyledComponent3 as createStyledSvelteComponent,
  createStyledComponents2 as createStyledSvelteComponents,
  createStyledComponent2 as createStyledVueComponent,
  createStyledComponents as createStyledVueComponents,
  createTheme,
  createThemeContract,
  createTokens2 as createTokens,
  cx,
  cx2 as cxSvelte,
  debounce,
  index_default as default,
  devLog,
  devWarn,
  disableChainCSSDebug,
  enableChainCSSDebug,
  enableDebug,
  enableTimeline,
  expandShorthand,
  exportTimeline,
  generateStyleId,
  getAnimationPreset,
  getAnimationPresetNames,
  getAvailableShorthands,
  getPropertySuggestion,
  getShorthandSuggestion,
  getStyleChanges,
  getStyleDiff,
  getStyleHistory,
  getSuggestion,
  getSuggestions,
  handleShorthand,
  hasAnimationPreset,
  hashString2 as hashString,
  helpers,
  injectStyleContext,
  injectStyleContext2 as injectStyleContextSvelte,
  isBrowser,
  isDebugEnabled,
  isDevelopment,
  isProduction,
  isShorthand,
  kebabCase2 as kebabCase,
  logError,
  macros,
  memoize,
  provideStyleContext,
  provideStyleContext2 as provideStyleContextSvelte,
  recipe,
  registerForHMR,
  runRuntime as run,
  runtimeChain,
  setBreakpoints,
  setManifest,
  setupHMR,
  shorthandMap,
  smartChain,
  styleInjector,
  tokens2 as tokens,
  useAtomicClasses,
  useAtomicClasses2 as useAtomicClassesSvelte,
  useChainStyles,
  useComputedStyles,
  useComputedStyles3 as useComputedStylesSvelte,
  useComputedStyles2 as useComputedStylesVue,
  useDynamicChainStyles,
  useSmartStyles,
  useThemeChainStyles,
  validateTheme,
  withChainStyles,
  withSmartStyles
};
