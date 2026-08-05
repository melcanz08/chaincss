// src/compiler/tokens/theme-contract.ts

import { checkContrast } from "./design-orchestrator.js";

export interface ThemeContract {
  [key: string]: ThemeContract | string;
}

export interface ThemeTokens {
  [key: string]: string | number | ThemeTokens | { $value?: any; value?: any };
}

const MAX_RECURSION_DEPTH = 10;

/**
 * Helper to unwrap W3C DTCG / Style Dictionary token objects ({ $value: ... } or { value: ... })
 */
function unwrapTokenValue(val: any): any {
  if (val !== null && typeof val === "object" && !Array.isArray(val)) {
    if ("$value" in val) return val.$value;
    if ("value" in val) return val.value;
  }
  return val;
}

export class Theme {
  private tokens: ThemeTokens;
  private cache = new Map<string, string | undefined>();

  constructor(tokens: ThemeTokens) {
    this.tokens = tokens;
  }

  get(path: string, visited: Set<string> = new Set()): string | undefined {
    if (!path) return undefined;

    // Strip optional leading '$' prefix
    const cleanPath = path.startsWith("$") ? path.slice(1) : path;

    if (visited.has(cleanPath)) {
      console.warn(`[ChainCSS] Circular token reference detected: "${cleanPath}"`);
      return undefined;
    }

    if (this.cache.has(cleanPath) && visited.size === 0) {
      return this.cache.get(cleanPath);
    }

    visited.add(cleanPath);

    const parts = cleanPath.split(".");
    let cur: any = this.tokens;
    for (const p of parts) {
      if (cur == null || typeof cur !== "object") {
        if (visited.size === 1) this.cache.set(cleanPath, undefined);
        return undefined;
      }
      cur = cur[p];
    }

    cur = unwrapTokenValue(cur);

    // Resolve cross-token reference expansions ($colors.primary)
    if (typeof cur === "string" && cur.startsWith("$")) {
      const resolvedValue = this.get(cur.slice(1), visited);
      if (visited.size === 1) this.cache.set(cleanPath, resolvedValue);
      return resolvedValue;
    }

    const val =
      typeof cur === "string" || typeof cur === "number"
        ? String(cur)
        : undefined;

    if (visited.size === 1) this.cache.set(cleanPath, val);
    return val;
  }

  set(path: string, value: string): void {
    const cleanPath = path.startsWith("$") ? path.slice(1) : path;
    const parts = cleanPath.split(".");
    let cur: any = this.tokens;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") {
        cur[parts[i]] = {};
      }
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
   */
  toCSSVariables(prefix = "theme", options?: { selector?: string }): string {
    const selector = options?.selector || ":root";
    const cssPrefix = prefix ? `--${prefix}-` : "--";
    let css = "";

    const flatten = (obj: ThemeTokens, p = "") => {
      if (!obj || typeof obj !== "object") return;

      for (const [k, v] of Object.entries(obj)) {
        const np = p ? `${p}-${k}` : k;
        const unwrapped = unwrapTokenValue(v);

        if (
          unwrapped !== null &&
          typeof unwrapped === "object" &&
          !Array.isArray(unwrapped)
        ) {
          flatten(unwrapped as ThemeTokens, np);
        } else if (unwrapped !== undefined) {
          // Convert '$colors.primary' references to var(--theme-colors-primary)
          const val =
            typeof unwrapped === "string" && unwrapped.startsWith("$")
              ? `var(${cssPrefix}${unwrapped.slice(1).replace(/\./g, "-")})`
              : unwrapped;

          css += `  ${cssPrefix}${np}: ${val};\n`;
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

        if (!fgValue || !bgValue) return null;

        try {
          const contrastData = checkContrast(fgValue, bgValue);
          return {
            label: p.label || `${p.fg} on ${p.bg}`,
            fg: fgValue,
            bg: bgValue,
            ...contrastData,
          };
        } catch {
          return null;
        }
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
  const contract = { ...contractShape };

  // Define metadata as non-enumerable to prevent polluting Object.keys()
  Object.defineProperties(contract, {
    __isContract: { value: true, enumerable: false, writable: false },
    __shape: { value: contractShape, enumerable: false, writable: false },
    __validate: {
      value: (theme: ThemeTokens) => validateTheme(contractShape, theme),
      enumerable: false,
      writable: false,
    },
  });

  return contract as any;
}

export function validateTheme(
  contract: ThemeContract,
  theme: ThemeTokens = {},
  path = "",
  options?: { strict?: boolean },
): boolean {
  const realContract = (contract as any).__shape || contract;
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
          if (!(k in cPart)) {
            errors.push(
              `  ✗ Extra token not in strict contract: "${curPath ? `${curPath}.${k}` : k}"`,
            );
          }
        }
      } else {
        for (const k of present) {
          if (!(k in cPart)) {
            warnings.push(
              `  ⚠ Extra token not in contract: "${curPath ? `${curPath}.${k}` : k}"`,
            );
          }
        }
      }
    } else {
      const unwrapped = unwrapTokenValue(tPart);
      if (
        unwrapped !== undefined &&
        typeof unwrapped !== "string" &&
        typeof unwrapped !== "number"
      ) {
        errors.push(
          `  ✗ Token "${curPath}" must be string|number, got ${typeof unwrapped}`,
        );
      }
    }
  }

  validate(realContract, theme, path);

  if (warnings.length) {
    for (const w of warnings) console.warn(w);
  }

  if (errors.length) {
    throw new Error(
      `Theme Contract Validation Failed (${errors.length} errors):\n${errors.join("\n")}`,
    );
  }

  return true;
}

export function createTheme<T extends ThemeContract>(
  contract: T | (T & { __isContract: boolean }),
  themeValues: ThemeTokens,
  options?: { strict?: boolean },
): Theme {
  const realContract = (contract as any).__shape || contract;

  if (typeof (contract as any).__validate === "function") {
    (contract as any).__validate(themeValues);
  } else {
    validateTheme(realContract as T, themeValues, "", {
      strict: options?.strict,
    });
  }

  const tokens: ThemeTokens = {};

  function build(
    cPart: any,
    tPart: ThemeTokens | undefined,
    target: ThemeTokens,
  ) {
    if (!cPart || typeof cPart !== "object") return;

    for (const k of Object.keys(cPart)) {
      const val = tPart?.[k];
      if (typeof cPart[k] === "object" && cPart[k] !== null) {
        target[k] = {};
        build(
          cPart[k],
          (val && typeof val === "object" ? val : {}) as ThemeTokens,
          target[k] as ThemeTokens,
        );
      } else {
        target[k] = unwrapTokenValue(val);
      }
    }
  }

  build(realContract, themeValues, tokens);
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
    if (!node || typeof node !== "object") return;

    for (const [k, v] of Object.entries(node)) {
      const unwrapped = unwrapTokenValue(v);
      if (
        v &&
        typeof v === "object" &&
        !("$value" in v) &&
        !("value" in v)
      ) {
        target[k] = {};
        walk(v, target[k]);
      } else {
        target[k] = unwrapped;
      }
    }
  }

  walk(figmaJson, flat);
  return createTheme(contract, flat);
}

export default {
  Theme,
  createThemeContract,
  validateTheme,
  createTheme,
  isThemeContract,
  createThemeFromFigma,
};