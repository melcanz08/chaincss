// src/core/compiler.ts
import fs6 from "fs";
import path5 from "path";
import crypto4 from "crypto";
import chalk2 from "chalk";
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

// src/core/utils.ts
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
import chalk from "chalk";

// src/compiler/commonProps.ts
var COMMON_CSS_PROPERTIES = [
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
    chains.cachedValidProperties = COMMON_CSS_PROPERTIES;
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
      console.log(chalk.magenta(`[Scanner] Found ${foundCount} styles in ${filePath}`));
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
        const module = await import("postcss");
        postcss = module.default || module;
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
        const module = await import("autoprefixer");
        autoprefixer = module.default || module;
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
    const computed = await compute();
    this.set(key, computed, ttl);
    return computed;
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
          console.log(chalk2.gray(`  \u{1F9F9} Cache evicted: ${oldest.slice(0, 8)}...`));
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
            console.warn(chalk2.yellow(`  \u26A0\uFE0F  Failed to parse styles in ${id}: ${parseError}`));
          }
        }
        searchFrom = endIdx + 1;
      }
      if (this.config.verbose && processedCount > 0) {
        console.log(chalk2.gray(`  \u{1F4DD} Processed ${processedCount} styles from ${id}`));
      }
    } catch (error) {
      console.error(chalk2.red(`  \u274C Error compiling source ${id}: ${error}`));
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
        console.warn(chalk2.yellow(`  \u26A0\uFE0F  Failed to parse style body: ${input.substring(0, 100)}...`));
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
  restoreTokens(obj, tokens) {
    if (typeof obj === "string") {
      const match = obj.match(/^__TOKEN_(\d+)__$/);
      if (match) {
        const idx = parseInt(match[1]);
        return tokens[idx] || obj;
      }
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.restoreTokens(item, tokens));
    }
    if (obj && typeof obj === "object") {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.restoreTokens(value, tokens);
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
        console.log(chalk2.blue("\n\u{1F50D} Phase 1: Scanning & Usage Analysis..."));
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
              console.warn(chalk2.yellow(`  \u26A0\uFE0F  Scanning fallback for ${path5.basename(file)}`));
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
          console.log(chalk2.gray(`  \u{1F4CA} Processed ${Math.min(i + BATCH_SIZE, components.length)}/${components.length} files`));
        }
      }
      if (errors.length > 0 && this.config.verbose) {
        console.warn(chalk2.yellow(`  \u26A0\uFE0F  ${errors.length} scanning errors occurred`));
      }
      if (!this.config.silent) {
        console.log(chalk2.blue("\n\u{1F3D7}\uFE0F  Phase 2: Generating Component Styles..."));
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
                console.log(chalk2.gray(`   \u{1F4DD} ${name} \u2192 ${className2 || "(empty)"}`));
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
              console.log(chalk2.green(`   \u2728 ${baseName} \u2192 ${path5.relative(process.cwd(), classFilePath)}`));
            }
          }
        } catch (error) {
          console.error(chalk2.red(`   \u274C Failed to process ${baseName}: ${error.message}`));
        }
      }
      if (!this.config.silent) {
        console.log(chalk2.blue("\n\u{1F30D} Phase 3: Finalizing Global Assets..."));
      }
      const finalAtomicCSS = this.atomicOptimizer ? this.atomicOptimizer.generateAtomicCSS() : "";
      const globalCssPath = path5.join(publicDir, "global.css");
      fs6.writeFileSync(globalCssPath, formatCSS(finalAtomicCSS, this.config.output.minify));
      if (this.config.verbose) {
        console.log(chalk2.blue(`   \u{1F4E6} Global CSS \u2192 ${path5.relative(process.cwd(), globalCssPath)} (${finalAtomicCSS.length} bytes)`));
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
        console.log(chalk2.blue(`   \u{1F4E6} Manifest \u2192 ${path5.relative(process.cwd(), manifestPath)}`));
      }
      if (!this.config.silent) {
        console.log(chalk2.green(`
\u2705 Build Complete!`));
        console.log(chalk2.gray(`   \u{1F4C1} Components processed: ${processedComponents}`));
        console.log(chalk2.gray(`   \u{1F4C1} Class files generated: ${generatedClassFiles.length}`));
        console.log(chalk2.gray(`   \u{1F4C1} Global CSS: ${path5.relative(process.cwd(), globalCssPath)}`));
        console.log(chalk2.gray(`   \u{1F4C1} Manifest: ${path5.relative(process.cwd(), manifestPath)}`));
        if (this.atomicOptimizer) {
          const atomicCount = Object.keys(this.atomicOptimizer.atomicMap).length;
          const stats = this.atomicOptimizer.getStats();
          console.log(chalk2.cyan(`
\u{1F4CA} Optimization Stats:`));
          console.log(chalk2.gray(`   Atomic Rules: ${atomicCount}`));
          console.log(chalk2.gray(`   Total Styles: ${stats.totalStyles}`));
          console.log(chalk2.gray(`   Unique Properties: ${stats.uniqueProperties}`));
          if (stats.savings) {
            console.log(chalk2.green(`   CSS Savings: ${stats.savings}`));
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

// src/plugins/vite.ts
import path6 from "path";
import fs7 from "fs";
function chaincssPlugin(options = {}) {
  const compiler = new ChainCSSCompiler({
    atomic: { enabled: options.atomic !== false },
    output: { minify: options.minify || false },
    verbose: options.verbose || false
  });
  const virtualCssId = "virtual:chaincss.css";
  const resolvedCssId = "\0" + virtualCssId;
  const virtualManifestId = "virtual:chaincss-manifest";
  const resolvedManifestId = "\0" + virtualManifestId;
  let generatedCSS = "";
  let generatedManifest = {};
  let processedFiles = /* @__PURE__ */ new Set();
  let lastHmrUpdate = 0;
  let hmrTimeout = null;
  let server = null;
  function log(message, level = "info") {
    if (!options.verbose && level === "info") return;
    const prefix = "[ChainCSS]";
    switch (level) {
      case "warn":
        console.warn(`${prefix} \u26A0\uFE0F ${message}`);
        break;
      case "error":
        console.error(`${prefix} \u274C ${message}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }
  function shouldProcess(id) {
    if (id.startsWith("\0") || id.includes("virtual:")) return false;
    if (id.includes("node_modules")) return false;
    if (options.exclude) {
      for (const pattern of options.exclude) {
        if (id.includes(pattern)) return false;
      }
    }
    if (options.include) {
      for (const pattern of options.include) {
        if (id.includes(pattern)) return true;
      }
      return false;
    }
    const isUserFile = id.includes("/src/") || id.includes("/components/");
    const isComponent = /\.(t|j)sx?$/.test(id);
    return isUserFile && isComponent;
  }
  function updateCSS() {
    try {
      const freshCSS = compiler.getCombinedCSS();
      if (freshCSS && freshCSS !== generatedCSS) {
        generatedCSS = freshCSS;
        if (options.verbose) {
          log(`CSS updated: ${generatedCSS.length} bytes`);
        }
      }
      return generatedCSS;
    } catch (error) {
      log(`Failed to get CSS: ${error.message}`, "error");
      return generatedCSS;
    }
  }
  function updateManifest() {
    try {
      const freshManifest = compiler.getAtomicMap();
      if (JSON.stringify(freshManifest) !== JSON.stringify(generatedManifest)) {
        generatedManifest = freshManifest;
        if (options.verbose) {
          log(`Manifest updated: ${Object.keys(generatedManifest).length} entries`);
        }
      }
      return generatedManifest;
    } catch (error) {
      log(`Failed to get manifest: ${error.message}`, "error");
      return generatedManifest;
    }
  }
  function sendHMRUpdate() {
    if (!server || !options.hmr !== false) return;
    if (hmrTimeout) clearTimeout(hmrTimeout);
    hmrTimeout = setTimeout(() => {
      const now = Date.now();
      if (now - lastHmrUpdate < 100) return;
      lastHmrUpdate = now;
      const css = updateCSS();
      const manifest = updateManifest();
      server.ws.send({
        type: "custom",
        event: "chaincss:update",
        data: {
          css,
          map: manifest,
          timestamp: now
        }
      });
      if (options.verbose) {
        log(`HMR update sent: ${css.length} bytes`);
      }
      hmrTimeout = null;
    }, 50);
  }
  function generateBootstrapCode(css) {
    const shouldInjectGlobal = options.injectGlobal !== false;
    if (!shouldInjectGlobal) {
      return `
        // ChainCSS Runtime Bootstrap (No CSS Injection)
        import manifest from "virtual:chaincss-manifest";
        import { setManifest } from "chaincss/runtime";
        
        try {
          setManifest(manifest);
          console.log("[ChainCSS] \u2705 Runtime initialized");
        } catch (err) {
          console.error("[ChainCSS] Failed to initialize:", err);
        }
      `;
    }
    const escapedCSS = css.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
    return `
      // ChainCSS Runtime Bootstrap
      import manifest from "virtual:chaincss-manifest";
      import { setManifest } from "chaincss/runtime";
      
      // Initialize ChainCSS
      try {
        setManifest(manifest);
        console.log("[ChainCSS] \u2705 Runtime initialized");
      } catch (err) {
        console.error("[ChainCSS] Failed to initialize:", err);
      }
      
      // Inject CSS
      (function() {
        const css = \`${escapedCSS}\`;
        const styleId = 'chaincss-injected-styles';
        
        if (css && css.trim()) {
          let styleTag = document.getElementById(styleId);
          if (!styleTag) {
            styleTag = document.createElement('style');
            styleTag.id = styleId;
            styleTag.setAttribute('data-chaincss', 'true');
            document.head.appendChild(styleTag);
          }
          styleTag.textContent = css;
          console.log("[ChainCSS] \u2705 Injected", css.length, "bytes of CSS");
        } else if (document.getElementById(styleId)) {
          // Remove empty style tag
          const existing = document.getElementById(styleId);
          if (existing) existing.remove();
        }
      })();
      
      // HMR Support
      if (import.meta.hot) {
        import.meta.hot.on('chaincss:update', (data) => {
          if (data.map) setManifest({ atomicMap: data.map });
          if (data.css) {
            const styleTag = document.getElementById('chaincss-injected-styles');
            if (styleTag) {
              styleTag.textContent = data.css;
              console.log("[ChainCSS] \u{1F504} HMR update:", data.css.length, "bytes");
            }
          }
        });
        
        // Accept self for HMR
        import.meta.hot.accept();
      }
    `;
  }
  return {
    name: "chaincss",
    enforce: "pre",
    configureServer(_server) {
      server = _server;
      log("Vite plugin initialized");
      _server.watcher.on("change", (filePath) => {
        if (filePath.includes("chaincss.config")) {
          log("Config changed, clearing cache...");
          compiler.clearCSS();
          processedFiles.clear();
          updateCSS();
          updateManifest();
          sendHMRUpdate();
        }
      });
    },
    resolveId(id) {
      if (id === virtualCssId) return resolvedCssId;
      if (id === virtualManifestId) return resolvedManifestId;
      return null;
    },
    load(id) {
      if (id === resolvedManifestId) {
        const manifest = updateManifest();
        const manifestData = {
          atomicMap: manifest,
          version: "2.0.0",
          timestamp: Date.now()
        };
        return `export default ${JSON.stringify(manifestData)};`;
      }
      if (id === resolvedCssId) {
        const css = updateCSS();
        return css || "/* ChainCSS: No styles */";
      }
      return null;
    },
    async transform(source, id) {
      if (!shouldProcess(id)) return null;
      const fileName = path6.basename(id);
      try {
        if (processedFiles.has(id) && !source.includes("chain(")) {
          return null;
        }
        log(`Processing: ${fileName}`);
        processedFiles.add(id);
        await compiler.compileSource(source, id);
        updateCSS();
        updateManifest();
        if (server && options.hmr !== false) {
          sendHMRUpdate();
        }
        const isEntryFile = /(main|index|App|entry)\.(t|j)sx?$/.test(id);
        if (isEntryFile && !source.includes("virtual:chaincss.css")) {
          const bootstrapCode = generateBootstrapCode(generatedCSS);
          log(`Bootstrapping entry file: ${fileName} (${generatedCSS.length} bytes)`);
          return {
            code: `${bootstrapCode}
${source}`,
            map: null
          };
        }
        return null;
      } catch (error) {
        log(`Failed to process ${fileName}: ${error.message}`, "error");
        return null;
      }
    },
    handleHotUpdate({ file, server: hotServer, modules }) {
      if (!shouldProcess(file)) return modules;
      log(`HMR update: ${path6.basename(file)}`);
      processedFiles.delete(file);
      compiler.clearCSS();
      const css = updateCSS();
      const manifest = updateManifest();
      if (options.hmr !== false) {
        hotServer.ws.send({
          type: "custom",
          event: "chaincss:update",
          data: {
            css,
            map: manifest,
            file: path6.basename(file),
            timestamp: Date.now()
          }
        });
      }
      const cssModule = [...modules].find((m) => m.id === resolvedCssId);
      if (cssModule) {
        return [...modules, cssModule];
      }
      return modules;
    },
    buildStart() {
      log("Build started");
      processedFiles.clear();
      generatedCSS = "";
      generatedManifest = {};
      compiler.clearCSS();
    },
    buildEnd() {
      const finalCSS = updateCSS();
      log(`Build complete - Final CSS: ${finalCSS.length} bytes`);
      if (options.cssOutput) {
        try {
          const outputPath = path6.resolve(process.cwd(), options.cssOutput);
          const outputDir = path6.dirname(outputPath);
          if (!fs7.existsSync(outputDir)) {
            fs7.mkdirSync(outputDir, { recursive: true });
          }
          fs7.writeFileSync(outputPath, finalCSS, "utf8");
          log(`CSS written to: ${outputPath}`);
        } catch (error) {
          log(`Failed to write CSS: ${error.message}`, "error");
        }
      }
      if (options.manifestOutput) {
        try {
          const manifestPath = path6.resolve(process.cwd(), options.manifestOutput);
          const manifestDir = path6.dirname(manifestPath);
          if (!fs7.existsSync(manifestDir)) {
            fs7.mkdirSync(manifestDir, { recursive: true });
          }
          fs7.writeFileSync(manifestPath, JSON.stringify(generatedManifest, null, 2), "utf8");
          log(`Manifest written to: ${manifestPath}`);
        } catch (error) {
          log(`Failed to write manifest: ${error.message}`, "error");
        }
      }
    },
    generateBundle(_options, bundle) {
      for (const [fileName, chunk] of Object.entries(bundle)) {
        if (fileName.endsWith(".css") && generatedCSS) {
          if (!chunk.source || chunk.source && chunk.source.length === 0) {
            chunk.source = generatedCSS;
            log(`Wrote ${generatedCSS.length} bytes to ${fileName}`);
          }
        }
      }
    },
    // Clean up on close
    closeBundle() {
      if (hmrTimeout) {
        clearTimeout(hmrTimeout);
      }
      log("Plugin closed");
    }
  };
}
export {
  chaincssPlugin as default
};
