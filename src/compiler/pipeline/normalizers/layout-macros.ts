export interface LayoutMacro {
  name: string;
  description: string;
  properties: Record<string, string | number>;
  defaults?: Record<string, string | number>;
  mediaQueries?: Record<string, Record<string, any>>;
}

const BUILTIN_LAYOUT_MACROS: Record<string, LayoutMacro> = {
  stickyHeader: {
    name: "stickyHeader",
    description: "Sticky header with scroll shadow and entrance animation",
    properties: {
      position: "sticky",
      top: "0",
      zIndex: "50",
      backgroundColor: "var(--header-bg, white)",
      backdropFilter: "blur(8px)",
      borderBottom: "1px solid transparent",
    },
    defaults: {
      "--header-bg": "white",
      "--header-shadow": "0 4px 12px rgba(0,0,0,0.1)",
    },
    mediaQueries: {
      "(max-width: 768px)": { padding: "12px 16px" },
      "(min-width: 769px)": { padding: "16px 32px" },
    },
  },
  card: {
    name: "card",
    description: "Standard card container with hover lift effect",
    properties: {
      display: "flex",
      flexDirection: "column",
      borderRadius: "12px",
      backgroundColor: "var(--card-bg, white)",
      boxShadow: "0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)",
      transition: "box-shadow 0.2s ease, transform 0.2s ease",
      overflow: "hidden",
    },
    defaults: {
      "--card-bg": "white",
      "--card-hover-shadow": "0 10px 30px rgba(0,0,0,0.15)",
    },
    mediaQueries: {
      "(hover: hover)": {
        "&:hover": {
          boxShadow: "var(--card-hover-shadow)",
          transform: "translateY(-2px)",
        },
      },
    },
  },
  hero: {
    name: "hero",
    description: "Full-width hero section with centered content",
    properties: {
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      minHeight: "60vh",
      padding: "48px 24px",
      textAlign: "center",
    },
    mediaQueries: {
      "(max-width: 768px)": { minHeight: "40vh", padding: "32px 16px" },
    },
  },
  container: {
    name: "container",
    description: "Responsive centered container with max-width",
    properties: {
      width: "100%",
      maxWidth: "1200px",
      marginLeft: "auto",
      marginRight: "auto",
      paddingLeft: "16px",
      paddingRight: "16px",
    },
    mediaQueries: {
      "(min-width: 768px)": { paddingLeft: "24px", paddingRight: "24px" },
      "(min-width: 1024px)": { paddingLeft: "32px", paddingRight: "32px" },
    },
  },
  center: {
    name: "center",
    description: "Absolute centering using flexbox",
    properties: {
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    },
  },
  gridList: {
    name: "gridList",
    description: "Responsive grid list with auto-fit columns",
    properties: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "24px",
    },
    mediaQueries: {
      "(max-width: 640px)": { gridTemplateColumns: "1fr", gap: "16px" },
    },
  },
  sidebar: {
    name: "sidebar",
    description: "Two-column layout: sidebar + main content",
    properties: {
      display: "grid",
      gridTemplateColumns: "280px 1fr",
      gap: "32px",
      minHeight: "100vh",
    },
    mediaQueries: {
      "(max-width: 1024px)": { gridTemplateColumns: "1fr", gap: "24px" },
    },
  },
  pill: {
    name: "pill",
    description: "Pill-shaped element (fully rounded)",
    properties: {
      borderRadius: "9999px",
      padding: "8px 20px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
  },
  autoContrast: {
    name: "autoContrast",
    description: "Automatically sets text color for WCAG AA contrast",
    properties: {},
  },
  glass: {
    name: "glass",
    description: "Frosted glass morphism effect",
    properties: {
      backgroundColor: "rgba(255, 255, 255, 0.1)",
      backdropFilter: "blur(16px)",
      border: "1px solid rgba(255, 255, 255, 0.2)",
      borderRadius: "16px",
    },
  },
  truncate: {
    name: "truncate",
    description: "Single-line text truncation with ellipsis",
    properties: {
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
  },
  srOnly: {
    name: "srOnly",
    description: "Screen-reader only (visually hidden but accessible)",
    properties: {
      position: "absolute",
      width: "1px",
      height: "1px",
      padding: "0",
      margin: "-1px",
      overflow: "hidden",
      clip: "rect(0, 0, 0, 0)",
      whiteSpace: "nowrap",
      borderWidth: "0",
    },
  },
  bentoNative: {
    name: "bentoNative",
    description: "Bento grid with subgrid + container queries (native)",
    properties: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      gap: "16px",
      containerType: "inline-size" as any,
    },
    mediaQueries: {
      "(max-width: 640px)": { gridTemplateColumns: "1fr" },
      "@container (max-width: 480px)": { gridTemplateColumns: "1fr" } as any,
    },
  },
  pricingRow: {
    name: "pricingRow",
    description: "Pricing row equal height via subgrid + :has() peer dim",
    properties: {
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gridTemplateRows: "auto auto 1fr auto",
      gap: "24px",
      alignItems: "stretch",
    },
    mediaQueries: {
      "(max-width: 960px)": {
        gridTemplateColumns: "1fr",
        gridTemplateRows: "auto",
      },
      "&:has(> :hover) > :not(:hover)": {
        opacity: "0.7",
        filter: "blur(0.5px)",
        transform: "scale(0.98)",
      } as any,
    },
  },
  autoGrid: {
    name: "autoGrid",
    description: "Auto-fit responsive grid, no media queries",
    properties: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
      gap: "24px",
    },
  },
};

export let LAYOUT_MACROS: Record<string, LayoutMacro> = {
  ...BUILTIN_LAYOUT_MACROS,
};

export function registerLayoutMacro(
  name: string,
  macro: LayoutMacro,
  allowOverride = false,
) {
  if (!allowOverride && BUILTIN_LAYOUT_MACROS[name]) {
    console.warn(
      `[ChainCSS] layout macro '${name}' overrides builtin. Use allowOverride:true to silence.`,
    );
  }
  LAYOUT_MACROS[name] = { ...macro, name };
}
export function registerLayoutMacros(
  macros: Record<string, LayoutMacro>,
  allowOverride = false,
) {
  for (const k in macros) {
    if (Object.prototype.hasOwnProperty.call(macros, k)) {
      registerLayoutMacro(k, macros[k], allowOverride);
    }
  }
}
export function resetLayoutMacros() {
  LAYOUT_MACROS = { ...BUILTIN_LAYOUT_MACROS };
}

export function resolveLayoutMacro(name: string): LayoutMacro | null {
  return LAYOUT_MACROS[name] || null;
}

export function expandLayoutMacro(name: string): Record<string, any> | null {
  const macro = resolveLayoutMacro(name);
  if (!macro) return null;

  const result: Record<string, any> = { ...macro.properties };
  if (macro.defaults) Object.assign(result, macro.defaults);

  const mq = macro.mediaQueries;
  if (mq) {
    for (const query in mq) {
      if (!Object.prototype.hasOwnProperty.call(mq, query)) continue;
      const props = mq[query];
      if (query.startsWith("@container")) {
        result.atRules = result.atRules || [];
        const cleanQuery = query.replace("@container", "").trim();
        result.atRules.push({
          type: "container",
          query: cleanQuery,
          styles: props,
          nestedRules: [],
        });
      } else if (
        query.charCodeAt(0) === 38 /* '&' */ ||
        query.charCodeAt(0) === 58 /* ':' */
      ) {
        result[query] = props;
      } else {
        result.atRules = result.atRules || [];
        result.atRules.push({
          type: "media",
          query,
          styles: props,
          nestedRules: [],
        });
      }
    }
  }
  return result;
}

export function getAvailableMacros(): string[] {
  return Object.keys(LAYOUT_MACROS);
}
export function getMacroDescription(name: string): string | null {
  return resolveLayoutMacro(name)?.description || null;
}

const contrastCache = new Map<string, string>();

export function autoContrast(bgColor: string): string {
  const input = (bgColor || "").trim().toLowerCase();
  if (!input || input.includes("var(")) return "#000000";

  const cached = contrastCache.get(input);
  if (cached !== undefined) return cached;

  let r = 128,
    g = 128,
    b = 128;
  let hex = "";
  if (input.charCodeAt(0) === 35 /* '#' */) hex = input.slice(1);
  else if (/^[a-f0-9]{3,8}$/.test(input)) hex = input;

  if (hex) {
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length >= 6) {
      r = parseInt(hex.slice(0, 2), 16);
      g = parseInt(hex.slice(2, 4), 16);
      b = parseInt(hex.slice(4, 6), 16);
    }
  } else if (input.startsWith("rgb")) {
    const m = input.match(/(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    if (m) {
      r = parseInt(m[1], 10);
      g = parseInt(m[2], 10);
      b = parseInt(m[3], 10);
    }
  } else if (input.startsWith("hsl")) {
    const m = input.match(/hsl\(\s*\d+,\s*[\d.]+%?\s*,\s*([\d.]+)%/);
    if (m) {
      const l = parseFloat(m[1]);
      r = g = b = Math.round(l * 2.55);
    }
  }

  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };

  const lum =
    0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  const contrastBlack = (lum + 0.05) / 0.05;
  const contrastWhite = 1.05 / (lum + 0.05);
  const result = contrastBlack > contrastWhite ? "#000000" : "#ffffff";

  if (contrastCache.size > 500) contrastCache.clear();
  contrastCache.set(input, result);
  return result;
}
