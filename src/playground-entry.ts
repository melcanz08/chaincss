// ~/dev/chaincss/src/playground-entry.ts
// Browser-safe entry point for the ChainCSS Playground.
// Supports three input modes:
//   1. Single expression: chain().flex().$el(".card")
//   2. Object mode: { card: chain().flex().$el(".card"), button: ... }
//   3. Full file mode: import ...; export const card = ...;

import { chain } from './core/entities/style-collector.js';
import { parseIR } from './compiler/pipeline/ir/parser.js';
import { createPipeline } from './compiler/pipeline/pipeline.js';
import { generateCSS } from './compiler/pipeline/ir/css-printer.js';

export interface PlaygroundResult {
  css: string;
  ast: any;
  diagnostics: any[];
  error?: string;
}

// ============================================================================
// Helper: Check if a value looks like a StyleObject
// ============================================================================

function isStyleObject(value: any): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    value.selectors !== undefined ||
    value._atRules !== undefined ||
    value._nestedRules !== undefined ||
    value.backgroundColor !== undefined ||
    value.display !== undefined ||
    value.color !== undefined ||
    value.padding !== undefined ||
    value.margin !== undefined ||
    value.width !== undefined ||
    value.height !== undefined ||
    value.fontSize !== undefined ||
    value.fontFamily !== undefined
  );
}

// ============================================================================
// Helper: Clean up a full .chain.ts file for browser evaluation
// ============================================================================

function cleanFullFile(code: string): string {
  let cleaned = code;

  // Remove import statements (the Playground doesn't need them)
  cleaned = cleaned.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '');
  
  // Remove export keywords
  cleaned = cleaned.replace(/export\s+const/g, 'const');
  cleaned = cleaned.replace(/export\s+function/g, 'function');
  cleaned = cleaned.replace(/export\s+default/g, 'default');

  // Wrap default export if present
  cleaned = cleaned.replace(/default\s+const/g, 'const');

  return cleaned;
}

// ============================================================================
// Helper: Evaluate a full .chain.ts file and extract exported styles
// ============================================================================

function evaluateFullFile(code: string): Record<string, any> {
  const cleanedCode = cleanFullFile(code);

  // Create a sandbox where variables declared with const/let/var are captured
  const sandbox: Record<string, any> = { chain };
  const exports: Record<string, any> = {};

  // Inject a proxy that captures all top-level variables
  const fullFunction = new Function('chain', 'exports', `
    const __styles = {};
    ${cleanedCode}
    
    // Capture all top-level variables that look like StyleObjects
    for (const [key, value] of Object.entries(this)) {
      if (key !== 'chain' && key !== 'exports' && isStyleObject(value)) {
        __styles[key] = value;
      }
    }
    
    // Also capture variables declared with const/let/var
    // (We can't easily get them from Function scope, so we use a trick)
    Object.assign(exports, __styles);
    return exports;
  `);

  // Since we can't access local variables from outside the Function,
  // we use a different approach: scan the code for const declarations
  // and evaluate them one by one.
  
  const constRegex = /const\s+([a-zA-Z_$][\w$]*)\s*=\s*/g;
  const constNames: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = constRegex.exec(cleanedCode)) !== null) {
    constNames.push(match[1]);
  }

  // Rebuild the code to explicitly export all const variables
  let exportCode = cleanedCode;
  if (constNames.length > 0) {
    exportCode += '\n';
    for (const name of constNames) {
      exportCode += `if (typeof ${name} !== 'undefined') { exports['${name}'] = ${name}; }\n`;
    }
  }

  const finalFunction = new Function('chain', 'exports', 'isStyleObject', `
    ${exportCode}
    return exports;
  `);

  const result = finalFunction(sandbox.chain, exports, isStyleObject);

  // Filter out non-StyleObjects
  const styles: Record<string, any> = {};
  for (const [key, value] of Object.entries(result)) {
    if (isStyleObject(value)) {
      styles[key] = value;
    }
  }

  // Auto-assign class names from variable names if .$el() was not called
  const variableNames: Record<string, string> = {};
  const autoNameRegex = /(?:export\s+)?const\s+([a-zA-Z_$][\w$]*)\s*=\s*chain\(/g;
  let autoMatch: RegExpExecArray | null;
  while ((autoMatch = autoNameRegex.exec(cleanedCode)) !== null) {
    const varName = autoMatch[1];
    const className = varName
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .toLowerCase();
    variableNames[varName] = className;
  }

  for (const [key, styleObj] of Object.entries(styles)) {
    if (styleObj && typeof styleObj === 'object' && !styleObj.selectors && !styleObj.selector && variableNames[key]) {
      styleObj.selector = `.${variableNames[key]}`;  // Use SINGULAR "selector"
    }
  }

  return styles;
}

// ============================================================================
// Helper: Evaluate ChainCSS code in all three modes
// ============================================================================

function evaluateChainCSS(code: string): Record<string, any> {
  const trimmed = code.trim();

  // Mode 1: Single expression
  try {
    const userFunction = new Function('chain', `return (${trimmed})`);
    const result = userFunction(chain);
    if (isStyleObject(result)) {
      return { playground_component: result };
    }
  } catch {
    // Not a single expression, try other modes
  }

  // Mode 2: Object mode
  try {
    const userFunction = new Function('chain', `return (${trimmed})`);
    const result = userFunction(chain);
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      const styles: Record<string, any> = {};
      for (const [key, value] of Object.entries(result)) {
        if (isStyleObject(value)) {
          styles[key] = value;
        }
      }
      if (Object.keys(styles).length > 0) {
        return styles;
      }
    }
  } catch {
    // Not object mode either
  }

  // Mode 3: Full file with imports and exports
  try {
    const styles = evaluateFullFile(trimmed);
    if (Object.keys(styles).length > 0) {
      return styles;
    }
  } catch {
    // Full file mode failed too
  }

  throw new Error(
    'Could not parse ChainCSS code. Expected one of:\n' +
    '  1. Single expression: chain().flex().$el(".card")\n' +
    '  2. Object of styles: { card: chain().flex().$el(".card"), button: ... }\n' +
    '  3. Full file with exports: export const card = chain().flex().$el(".card")'
  );
}

// ============================================================================
// Main Playground Compiler Function
// ============================================================================

export function compileString(code: string): PlaygroundResult {
  try {
    // 1. Evaluate the user's code
    const styles = evaluateChainCSS(code);

    // 2. Validate
    if (!styles || typeof styles !== 'object' || Object.keys(styles).length === 0) {
      throw new Error('No valid StyleObjects found. Did you forget to call .$el()?');
    }

    // 3. Parse the StyleObjects into the IR
    const ir = parseIR(styles, 'playground');

    // 4. Run the REAL compiler pipeline with the lint preset
    const pipeline = createPipeline('lint');
    const result = pipeline.execute(ir, 'playground');

    // 5. Collect diagnostics
    const diagnostics = result.ir.diagnostics || [];

    // 6. Generate final CSS
    const css = generateCSS(result.ir, { minify: false });

    return { css, ast: result.ir, diagnostics };
  } catch (e: any) {
    return {
      css: `/* Compilation Error */\n/* ${e.message} */`,
      ast: { error: e.message, stack: e.stack },
      diagnostics: [],
      error: e.message,
    };
  }
}