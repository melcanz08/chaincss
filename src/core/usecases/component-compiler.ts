// src/core/usecases/component-compiler.ts

import os from "os";
import path from "path";
import chalk from "chalk";
import { formatCSS } from "../interfaces/utils.js";
import type { CompileResult, StyleDefinition } from "@shared/types/index.js";
import type { ChainCSSPrefixer } from "@compiler/prefixer.js";
import type { ManifestWriter } from "@compiler/services/manifest-writer.js";
import { VERSION } from "@shared/constants/index.js";
import type { StatsTracker } from "./stats.js";

import fsp from "fs/promises";

export interface ComponentContext {
  config: any;
  loader: { import: (p: string) => Promise<any> };
  prefixer: ChainCSSPrefixer | null;
  manifestWriter: ManifestWriter;
  compileStyle: (id: string, def: StyleDefinition) => CompileResult;
  computeStats: () => any;
  getAggregatedStats: () => any;
  emit: (e: any) => void;
  statsTracker?: StatsTracker;
}

// Fix #1: Remove includes("-") — too greedy
function isStyleDef(v: any): boolean {
  if (!v || typeof v !== "object") return false;
  const keys = Object.keys(v);
  return (
    v.selectors ||
    v._atRules ||
    v._nestedRules ||
    v._intents?.length > 0 ||
    keys.some(k =>
      k.startsWith("&") ||
      k.startsWith(".") ||
      k === "hover" || k === "focus" || k === "active" ||
      /^[a-zA-Z]+(?:[A-Z][a-z]*)+$/.test(k)
    )
  );
}

function normalizeImports(raw: any): Record<string, StyleDefinition> {
  const styles: Record<string, StyleDefinition> = {};
  if (!raw || typeof raw !== "object") return styles;
  if (raw.default && typeof raw.default === "object" && raw.default.selectors) {
    styles["default"] = raw.default;
    for (const [k, v] of Object.entries(raw)) {
      if (k === "default" || k === "__esModule") continue;
      if (isStyleDef(v)) styles[k] = v as any;
    }
    return styles;
  }
  if (raw.default && typeof raw.default === "object") {
    const def = raw.default as Record<string, any>;
    if (Object.values(def).some(isStyleDef)) {
      for (const [k, v] of Object.entries(def))
        if (isStyleDef(v)) styles[k] = v as any;
    }
  }
  for (const [k, v] of Object.entries(raw)) {
    if (k === "default" || k === "__esModule") continue;
    if (isStyleDef(v)) styles[k] = v as any;
  }
  if (Object.keys(styles).length === 0) {
    for (const [k, v] of Object.entries(raw)) {
      if (k === "__esModule") continue;
      if (isStyleDef(v)) styles[k] = v as any;
    }
  }
  return styles;
}

function header(file: string): string {
  const rel = path.relative(process.cwd(), file);
  return `/**\n * ChainCSS Generated Class Map — v${VERSION}\n * Source: ${rel}\n * DO NOT EDIT MANUALLY\n */\n\n`;
}

function safeKey(k: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : JSON.stringify(k);
}

// Fix #2: Add try/catch for function serialization edge cases
function serializeDynamic(dynamic: Record<string, any>): string {
  const entries: string[] = [];
  for (const [prop, val] of Object.entries(dynamic)) {
    let serialized: string;
    if (typeof val === "function") {
      try {
        serialized = val.toString();
      } catch {
        serialized = JSON.stringify("[Function]");
      }
    } else {
      try {
        serialized = JSON.stringify(val);
      } catch {
        serialized = JSON.stringify(String(val));
      }
    }
    entries.push(`${safeKey(prop)}: ${serialized}`);
  }
  return `{ ${entries.join(", ")} }`;
}

export function createComponentCompiler(ctx: ComponentContext) {
  async function writeOutput(
    sourceDir: string,
    baseName: string,
    js: string,
    css: string,
    generated: string[],
  ): Promise<void> {
    await fsp.mkdir(sourceDir, { recursive: true });
    const classFile = path.join(sourceDir, `${baseName}.class.js`);
    const cssFile = path.join(sourceDir, `${baseName}.css`);
    await fsp.writeFile(classFile, js, "utf8");
    generated.push(classFile);
    if (css.trim()) {
      // Fix #4: Remove double prefixing — already done in style-compilation
      // Fix #3: Respect minify config
      await fsp.writeFile(
        cssFile,
        formatCSS(css, !!ctx.config.output.minify),
        "utf8",
      );
      generated.push(cssFile);
    } else {
      // Fix #5: No existsSync — just try unlink
      try {
        await fsp.unlink(cssFile);
      } catch {
        // File doesn't exist — that's fine
      }
    }
    if (ctx.config.verbose)
      console.log(
        chalk.green(
          `   ✨ ${baseName} → ${path.relative(process.cwd(), classFile)}`,
        ),
      );
  }

  async function compileOne(
    file: string,
    baseName: string,
    sourceDir: string,
    generated: string[],
  ): Promise<number> {
    let diag = 0;
    try {
      const raw = await ctx.loader.import(file);
      const styles = normalizeImports(raw);
      let js = header(file);
      let css = "";
      let hasExport = false;
      for (const [name, style] of Object.entries(styles)) {
        if (!isStyleDef(style)) continue;
        const result = ctx.compileStyle(name, style as StyleDefinition);
        const className =
          (Object.values(result.classMap)[0] as string | undefined) || "";

        // Fix: merge atomic classes from atomic-extractor meta
        const atomicClasses =
          (result as any).meta?.atomicClasses ||
          (result as any).atomicClasses ||
          (result as any)._ir?.rules?.[0]?.meta?.atomicClasses ||
          [];
        const finalClass = [className,...atomicClasses].filter(Boolean).join(" ");

        if (finalClass) {
          const dyn = result.dynamic;
          if (dyn && Object.keys(dyn).length > 0) {
            js += `export const ${safeKey(name)} = { className: '${finalClass}', dynamic: ${serializeDynamic(dyn as any)} };\n`;
          } else {
            js += `export const ${safeKey(name)} = '${finalClass}';\n`;
          }
          hasExport = true;
        }
        if (result.css) css += result.css + "\n";
        if ((result as any)._diagnostics)
          diag += (result as any)._diagnostics.length;
      }
      if (css.trim() || hasExport)
        await writeOutput(sourceDir, baseName, js, css, generated);
    } catch (e) {
      ctx.emit({
        type: "error",
        code: "FILE_PROCESS_FAILED",
        message: `Failed to compile ${baseName}: ${(e as Error).message}`,
        sourceFile: file,
        originalError: e,
      });
    }
    return diag;
  }

  async function compileAll(
    components: string[],
    onProgress?: (msg: string) => void,
  ) {
    let processed = 0;
    let totalDiags = 0;
    const classFiles: string[] = [];
    if (!ctx.config.silent)
      console.log(chalk.blue("\n🏗  Building Component Styles..."));
    const chainFiles = components.filter(
      (f) =>
        f.endsWith(".chain.js") ||
        f.endsWith(".chain.ts") ||
        f.endsWith(".chain.jsx") ||
        f.endsWith(".chain.tsx"),
    );

    // Fix #6: Adaptive concurrency based on available memory
    const CONCURRENCY = Math.min(
      16,
      Math.max(2, Math.floor(os.freemem() / 150_000_000)),
    );

    for (let i = 0; i < chainFiles.length; i += CONCURRENCY) {
      const batch = chainFiles.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (file) => {
          const baseName = path
            .basename(file)
            .replace(/\.chain\.(js|ts|jsx|tsx)$/, "");
          const sourceDir = path.dirname(file);
          const d = await compileOne(file, baseName, sourceDir, classFiles);
          ctx.statsTracker?.recordFileProcessed();
          onProgress?.(file);
          return d;
        }),
      );
      for (const d of results) {
        totalDiags += d;
        processed++;
      }
    }
    if (!ctx.config.silent)
      console.log(chalk.blue("\n📋 Finalizing Manifest..."));
    ctx.manifestWriter.write({
      version: VERSION,
      timestamp: new Date().toISOString(),
      // Fix #7: Wire real atomicMap from stats when available
      atomicMap: (ctx.getAggregatedStats() as any)?.atomicMap || {},
      stats: ctx.getAggregatedStats(),
      pipelineEnabled: true,
      diagnosticsCount: totalDiags,
      classFiles: classFiles.map((f) => path.relative(process.cwd(), f)),
    });
    if (!ctx.config.silent) {
      console.log(chalk.green(`\n✅ Build Complete!`));
      console.log(chalk.gray(`   📁 Components: ${processed}`));
      console.log(chalk.gray(`   📁 Generated files: ${classFiles.length}`));
    }
    return { processed, classFiles, totalDiags };
  }
  return { compileOne, compileAll, writeOutput, normalizeImports };
}