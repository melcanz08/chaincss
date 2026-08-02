// src/compiler/tokens/theme-contract.ts

import { checkContrast } from "./design-orchestrator.js";

export interface ThemeContract {
  [key: string]: ThemeContract | string;
}
export interface ThemeTokens {
  [key: string]: string | number | ThemeTokens;
}

export class Theme {
  private tokens: ThemeTokens;
  private cache = new Map<string, string | undefined>();

  constructor(tokens: ThemeTokens) {
    this.tokens = tokens;
  }

  get(path: string): string | undefined {
    if (this.cache.has(path)) return this.cache.get(path);
    const parts = path.split(".");
    let cur: any = this.tokens;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") {
        this.cache.set(path, undefined);
        return undefined;
      }
      cur = cur[p];
    }

    // Resolve cross-token reference expansions natively if requested directly by compiler passes
    if (typeof cur === "string" && cur.startsWith("$")) {
      const resolvedValue = this.get(cur.slice(1));
      this.cache.set(path, resolvedValue);
      return resolvedValue;
    }

    const val =
      typeof cur === "string" || typeof cur === "number"
        ? String(cur)
        : undefined;
    this.cache.set(path, val);
    return val;
  }

  set(path: string, value: string): void {
    const parts = path.split(".");
    let cur: any = this.tokens;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== "object")
        cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    this.cache.clear();
  }

  has(path: string): boolean {
    return this.get(path) !== undefined;
  }

  toObject(): ThemeTokens {
    return this.tokens;
  }

  /**
   * Generates production-ready token definitions scoped dynamically to any target selector
   * (e.g., :root, [data-theme="dark"], .theme-alternate)
   */
  toCSSVariables(prefix = "theme", options?: { selector?: string }): string {
    const selector = options?.selector || ":root";
    let css = "";

    const flatten = (obj: ThemeTokens, p = "") => {
      for (const [k, v] of Object.entries(obj)) {
        const np = p ? `${p}-${k}` : k;
        if (v && typeof v === "object") {
          flatten(v as ThemeTokens, np);
        } else {
          // v3.3 normalization: seamlessly convert '$colors.primary' tokens to target dash pointers
          const val =
            typeof v === "string" && v.startsWith("$")
              ? `var(--${prefix}-${v.slice(1).replace(/\./g, "-")})`
              : v;
          css += `  --${prefix}-${np}: ${val};\n`;
        }
      }
    };

    flatten(this.tokens);
    return `${selector} {\n${css}}\n`;
  }

  /**
   * Automatically scans your theme mapping for specific visual nodes to track visual accessibility thresholds
   */
  auditContrast(pairs: Array<{ fg: string; bg: string; label?: string }>) {
    return pairs
      .map((p) => {
        const fgValue = this.get(p.fg) || "";
        const bgValue = this.get(p.bg) || "";

        // Handle fallback strings gracefully if a token reference isn't established yet
        if (!fgValue || !bgValue) return null;

        const contrastData = checkContrast(fgValue, bgValue);
        return {
          label: p.label || `${p.fg} on ${p.bg}`,
          fg: fgValue,
          bg: bgValue,
          ...contrastData,
        };
      })
      .filter(Boolean);
  }

  toJSON() {
    return JSON.stringify(this.tokens, null, 2);
  }
}

export function createThemeContract<T extends ThemeContract>(
  contractShape: T,
): T & {
  __isContract: true;
  __validate: (theme: ThemeTokens) => boolean;
  __shape: T;
} {
  return Object.assign({}, contractShape, {
    __isContract: true as const,
    __shape: contractShape,
    __validate: (theme: ThemeTokens) => validateTheme(contractShape, theme),
  }) as any;
}

export function validateTheme(
  contract: ThemeContract,
  theme: ThemeTokens = {},
  path = "",
  options?: { strict?: boolean },
): boolean {
  const errors: string[] = [];
  const warnings: string[] = [];

  function validate(
    cPart: ThemeContract,
    tPart: ThemeTokens | undefined,
    curPath: string,
  ) {
    if (
      typeof cPart === "object" &&
      cPart !== null &&
      typeof cPart !== "string"
    ) {
      const required = Object.keys(cPart);
      const present = Object.keys(tPart || {});

      for (const k of required) {
        const np = curPath ? `${curPath}.${k}` : k;
        if (!tPart || !(k in tPart)) {
          errors.push(`  ✗ Missing required token: "${np}"`);
        } else {
          validate(cPart[k] as ThemeContract, tPart[k] as ThemeTokens, np);
        }
      }

      if (options?.strict) {
        for (const k of present) {
          if (!(k in cPart))
            errors.push(
              `  ✗ Extra token not in strict contract: "${curPath ? `${curPath}.${k}` : k}"`,
            );
        }
      } else {
        for (const k of present) {
          if (!(k in cPart))
            warnings.push(
              `  ⚠ Extra token not in contract: "${curPath ? `${curPath}.${k}` : k}"`,
            );
        }
      }
    } else {
      if (
        tPart !== undefined &&
        typeof tPart !== "string" &&
        typeof tPart !== "number"
      ) {
        errors.push(
          `  ✗ Token "${curPath}" must be string|number, got ${typeof tPart}`,
        );
      }
    }
  }

  validate(contract, theme, path);
  if (warnings.length) for (const w of warnings) console.warn(w);
  if (errors.length)
    throw new Error(
      `Theme Contract Validation Failed (${errors.length} errors):\n${errors.join("\n")}`,
    );

  return true;
}

export function createTheme<T extends ThemeContract>(
  contract: T | (T & { __isContract: boolean }),
  themeValues: ThemeTokens,
  options?: { strict?: boolean },
): Theme {
  if (typeof (contract as any).__validate === "function") {
    (contract as any).__validate(themeValues);
  } else {
    validateTheme(contract as T, themeValues, "", { strict: options?.strict });
  }

  const tokens: ThemeTokens = {};
  function build(
    cPart: T,
    tPart: ThemeTokens | undefined,
    target: ThemeTokens,
  ) {
    for (const k of Object.keys(cPart)) {
      if (typeof cPart[k] === "object" && cPart[k] !== null) {
        target[k] = {};
        build(
          cPart[k] as any,
          (tPart?.[k] as ThemeTokens) || {},
          target[k] as ThemeTokens,
        );
      } else {
        target[k] = tPart?.[k] as string;
      }
    }
  }

  build(contract as T, themeValues, tokens);
  return new Theme(tokens);
}

export function isThemeContract(
  obj: any,
): obj is ThemeContract & { __isContract: true } {
  return obj && typeof obj === "object" && obj.__isContract === true;
}

export function createThemeFromFigma(
  contract: ThemeContract,
  figmaJson: any,
): Theme {
  const flat: ThemeTokens = {};
  function walk(node: any, target: any) {
    for (const [k, v] of Object.entries(node as any)) {
      if (v && typeof v === "object" && "value" in (v as any)) {
        target[k] = (v as any).value;
      } else if (v && typeof v === "object") {
        target[k] = {};
        walk(v, target[k]);
      }
    }
  }
  walk(figmaJson, flat);
  return createTheme(contract as any, flat);
}

export default {
  Theme,
  createThemeContract,
  validateTheme,
  createTheme,
  isThemeContract,
  createThemeFromFigma,
};

// Usage : Example

/*import { createThemeContract, createTheme } from './src/compiler/tokens/theme-contract.js'

const designContract = createThemeContract({
  colors: {
    background: 'string',
    text: 'string'
  }
});

const lightTheme = createTheme(designContract, {
  colors: { background: '#ffffff', text: '#111111' }
});

const darkTheme = createTheme(designContract, {
  colors: { background: '#111111', text: '#f9f9f9' }
});

// Write out light defaults on the root document level
const globalLightCss = lightTheme.toCSSVariables('chain');
// :root { --chain-colors-background: #ffffff; ... }

// Append the dark theme onto a target attribute query node seamlessly!
const globalDarkCss = darkTheme.toCSSVariables('chain', { selector: '[data-theme="dark"]' });
// [data-theme="dark"] { --chain-colors-background: #111111; ... }*/
