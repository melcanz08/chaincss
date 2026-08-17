// src/core/usecases/style-compiler.ts

import type {
  StyleObject,
  CSSProperties,
  PseudoStyles,
  AtRule,
  NestedRule,
} from "@shared/types/index.js";
import {
  parseStyleObject,
} from "@shared/types/index.js";
import { partitionStyles } from "./value-classifier.js";

import { parseIR } from "../../compiler/pipeline/ir/parser.js";
import { generateCSS } from "../../compiler/pipeline/ir/css-printer.js";
import {
  createDefaultPipeline,
  type Pipeline,
} from "../../compiler/pipeline/pipeline.js";

interface InternalCompileOptions {
  minify?: boolean;
  sourceMap?: boolean;
  scopeSelector?: string;
  sourceFile?: string;
}
function buildAtRuleKey(atRule: AtRule): string {
  const parts: string[] = [`@${atRule.type}`];
  const query = getAtRuleQuery(atRule);
  if (query) parts.push(query);
  return parts.join(" ");
}

// Fix #1: Module-level pipeline singleton — no new pipeline per compileToCSS
let _defaultPipeline: Pipeline | null = null;

function getDefaultPipeline(): Pipeline {
  if (!_defaultPipeline) {
    _defaultPipeline = createDefaultPipeline();
  }
  return _defaultPipeline;
}

function getAtRuleQuery(r: AtRule): string {
  if (r.type === "media") return r.query || "";
  if (r.type === "supports" || r.type === "container") return r.condition || "";
  if (r.type === "layer") return r.name || "";
  return "";
}
function getAtRuleStyles(r: AtRule): StyleObject | undefined {
  return "styles" in r ? r.styles : undefined;
}


export function compileToCSS(
  styleObject: StyleObject,
  options: InternalCompileOptions = {},
): string {
  try {
    const styleDef: any = { ...styleObject };
    if (options.scopeSelector && !styleDef.selectors) {
      styleDef.selectors = [options.scopeSelector];
    }

    const ir = parseIR(
      { style: styleDef },
      options.sourceFile,
    );

    // Fix #1: Reuse singleton pipeline instead of creating new one
    const pipeline = getDefaultPipeline();
    const result = pipeline.execute(ir);

    return generateCSS(result.ir, {
      minify: !!options.minify,
    });
  } catch (error) {
    const context = options.sourceFile || options.scopeSelector || "unknown";
    throw new Error(
      `[ChainCSS] Failed to compile style for "${context}": ${(error as Error).message}`,
    );
  }
}

// Fix #3: Dead code removed — compilePseudoClass, compileNestedRule,
// compileDeclarations, compileWrapper, compileAtRule all deleted.
// The pipeline printer handles all CSS generation now.

export function partitionForBuild(
  styleObject: StyleObject,
  options: InternalCompileOptions = {},
  visited = new Set<any>(),
): any {
  try {
    if (visited.has(styleObject))
      throw new Error(`Circular style reference detected`);
    visited.add(styleObject);
    const parsed = parseStyleObject(styleObject as Record<string, unknown>);
    const allNested = parsed.nestedRules || [];
    const allAt = parsed.atRules || [];
    const { static: topStatic, dynamic: topDynamic } = partitionStyles(
      parsed.regularProps,
    );
    const staticNestedRules: NestedRule[] = [];
    const dynamicNestedRules: Record<string, any> = {};
    for (const rule of allNested) {
      const nestedResult = partitionForBuild(
        rule.styles as StyleObject,
        options,
        visited,
      );
      if (nestedResult.hasDynamic)
        dynamicNestedRules[rule.selector] = nestedResult.dynamicValues;
      staticNestedRules.push({
        selector: rule.selector,
        styles: nestedResult.staticObject,
      });
    }
    const staticAtRules: AtRule[] = [];
    const dynamicAtRules: Record<string, any> = {};
    for (const atRule of allAt) {
      if (getAtRuleStyles(atRule)) {
        const atResult = partitionForBuild(
          getAtRuleStyles(atRule) as StyleObject,
          options,
          visited,
        );
        if (atResult.hasDynamic) {
          const key = buildAtRuleKey(atRule);
          dynamicAtRules[key] = atResult.dynamicValues;
        }
        staticAtRules.push({
          ...atRule,
          styles: atResult.staticObject,
        } as AtRule);
      } else {
        staticAtRules.push(atRule);
      }
    }
    const staticPseudoClasses: any = {};
    const dynamicPseudoClasses: Record<string, any> = {};
    for (const [pseudo, styles] of Object.entries(parsed.pseudoClasses)) {
      const { static: s, dynamic: d } = partitionStyles(
        styles as CSSProperties,
      );
      if (Object.keys(s).length > 0)
        staticPseudoClasses[pseudo as `&:${string}`] = s as PseudoStyles;
      if (Object.keys(d).length > 0) dynamicPseudoClasses[pseudo] = d;
    }
    const staticStyleObject: StyleObject = {
      ...topStatic,
      ...staticPseudoClasses,
      _atRules: staticAtRules,
      _nestedRules: staticNestedRules,
    };
    if (parsed.selectors) staticStyleObject.selectors = parsed.selectors;
    const css = compileToCSS(staticStyleObject, options);
    const dynamicValues: Record<string, any> = {
      ...topDynamic,
      ...dynamicPseudoClasses,
    };
    if (Object.keys(dynamicNestedRules).length > 0)
      dynamicValues._nestedRules = dynamicNestedRules;
    if (Object.keys(dynamicAtRules).length > 0)
      dynamicValues._atRules = dynamicAtRules;
    const hasDynamic = Object.keys(dynamicValues).length > 0;
    visited.delete(styleObject);
    return { css, dynamicValues, hasDynamic, staticObject: staticStyleObject };
  } catch (error) {
    visited.delete(styleObject);
    const context = options.sourceFile || options.scopeSelector || "unknown";
    throw new Error(
      `[ChainCSS] Failed to partition style for "${context}": ${(error as Error).message}`,
    );
  }
}

export function run(...styleObjects: StyleObject[]): string {
  return styleObjects
    .map((obj) => compileToCSS(obj))
    .filter(Boolean)
    .join("\n\n");
}

// Fix #4: Explicit transpile overloads — no fragile heuristic
export function transpile(map: Record<string, StyleObject>): string;
export function transpile(...objects: StyleObject[]): string;
export function transpile(...args: any[]): string {
  if (
    args.length === 1 &&
    typeof args[0] === "object" &&
    !Array.isArray(args[0]) &&
    !(args[0] as any).selectors
  ) {
    const vals = Object.values(args[0]);
    // Only treat as map if all values look like StyleObjects
    if (vals.every((v) => v && typeof v === "object")) {
      return run(...(vals as StyleObject[]));
    }
  }
  return run(...(args as StyleObject[]));
}