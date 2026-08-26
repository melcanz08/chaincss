// ============================================================================
// FILE: src/frameworks/core/browser-safe-compiler.ts
// Browser-safe compiler that bypasses the pipeline (avoids chalk dependency)
// ============================================================================


import { parseIR } from "@compiler/pipeline/ir/parser.js";
import { generateCSS } from "@compiler/pipeline/ir/css-printer.js";

// Define the type locally - no imports needed
interface StyleObject {
  selectors?: string | string[];
  _atRules?: any[];
  _nestedRules?: any[];
  nestedRules?: any[];
  atRules?: any[];
  _classes?: string[];
  _transforms?: Array<{ type: string; [key: string]: unknown }>;
  _name?: string;
  _mixed?: boolean;
  _intents?: string[];

  [property: string]: any;
}

interface BrowserCompileOptions {
  minify?: boolean;
  scopeSelector?: string;
  sourceFile?: string;
}

/**
 * Compiles a StyleObject directly to CSS without the pipeline.
 * This is the browser-safe version that avoids Node.js dependencies.
 */
export function compileToCSSBrowser(
  styleObject: StyleObject,
  options: BrowserCompileOptions = {},
): string {
  try {
    const styleDef: any = { ...styleObject };
    
    // Apply scope selector if provided
    if (options.scopeSelector && !styleDef.selectors) {
      styleDef.selectors = [options.scopeSelector];
    }

    // Parse directly to IR
    const ir = parseIR(
      { style: styleDef },
      options.sourceFile || "browser",
    );

    // Generate CSS directly (skips pipeline optimizations)
    return generateCSS(ir, {
      minify: !!options.minify,
    });
  } catch (error) {
    const context = options.sourceFile || options.scopeSelector || "browser";
    throw new Error(
      `[ChainCSS] Failed to compile style for "${context}": ${(error as Error).message}`,
    );
  }
}

/**
 * Compiles multiple StyleObjects to CSS strings.
 */
export function runBrowser(...styleObjects: StyleObject[]): string {
  return styleObjects
    .map((obj) => compileToCSSBrowser(obj))
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Transpiles StyleObjects or a map of StyleObjects to CSS.
 * Accepts either:
 *   transpileBrowser(style1, style2, ...)
 *   transpileBrowser({ name1: style1, name2: style2 })
 */
export function transpileBrowser(map: Record<string, StyleObject>): string;
export function transpileBrowser(...objects: StyleObject[]): string;
export function transpileBrowser(...args: any[]): string {
  // Check if first arg is a map (object of StyleObjects)
  if (
    args.length === 1 &&
    typeof args[0] === "object" &&
    !Array.isArray(args[0]) &&
    !(args[0] as any).selectors &&
    !(args[0] as any)._nestedRules &&
    !(args[0] as any)._atRules
  ) {
    const vals = Object.values(args[0]);
    // Only treat as map if all values look like StyleObjects
    if (vals.every((v) => v && typeof v === "object")) {
      return runBrowser(...(vals as StyleObject[]));
    }
  }
  
  // Otherwise, treat all args as individual StyleObjects
  return runBrowser(...(args as StyleObject[]));
}

/**
 * Injects CSS into the DOM.
 * Creates a <style> tag or uses existing one.
 */
export function injectCSS(css: string, id: string = "chaincss-styles"): void {
  if (typeof document === "undefined") return;
  
  let styleEl = document.getElementById(id) as HTMLStyleElement | null;
  
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = id;
    document.head.appendChild(styleEl);
  }
  
  styleEl.textContent = css;
}

export default {
  compileToCSS: compileToCSSBrowser,
  run: runBrowser,
  transpile: transpileBrowser,
  injectCSS,
};