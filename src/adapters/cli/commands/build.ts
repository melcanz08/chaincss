// ============================================================================
// FILE: src/adapters/cli/commands/build.ts
// ============================================================================

import path from "path";
import fs from "fs";
import chalk from "chalk";
import { ChainCSSCompiler } from "@core/usecases/compiler.js";
import { createLogger } from "@shared/logger/index.js";
import { loadConfig } from "../utils/config-loader.js";
import { findInputFiles, ensureDirectory } from "../utils/file-utils.js";
import type { BuildOptions } from "../types.js";

import { serializeForInspector } from "@compiler/pipeline/inspector/serializer.js";
import { InspectorStore } from "@compiler/pipeline/inspector/store.js";
import {
  createCompilerState,
  updateState,
  markChangedRules,
  getStateStats,
  saveCompilerStateToDisk,
  restoreCompilerStateFromDisk,
  type CompilerState,
} from "@compiler/pipeline/persistent-compiler.js";
import { PersistentCache } from "@compiler/cache/content-addressable-cache.js";

export async function buildCommand(options: BuildOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  logger.header("ChainCSS Build Pipeline");

  // ============================================================================
  // PERSISTENT COMPILER STATE — cold-start recovery
  // ============================================================================
  const isPersistent = options.persistent !== false;
  let compilerState: CompilerState | null = null;
  let persistentCache: PersistentCache | null = null;

  if (isPersistent) {
    logger.info("🔁 Persistent compiler enabled");
    persistentCache = new PersistentCache({
      cacheDir: path.join(process.cwd(), ".chaincss-cache", "persistent"),
      maxAgeDays: 1,
    });

    const projectHash = Buffer.from(process.cwd())
      .toString("base64")
      .substring(0, 8);
    try {
      compilerState = await restoreCompilerStateFromDisk(
        persistentCache,
        projectHash,
      );
    } catch {
      compilerState = null;
    }
    if (compilerState) {
      logger.success(
        `📦 Restored state (${compilerState.stats.totalCompiles} compiles, ${compilerState.stats.currentLiveRules} live rules)`,
      );
    } else {
      logger.info("🆕 No cached state — starting fresh");
    }
  }

  const configPathInput =
    options.config && !options.config.includes("*")
      ? options.config
      : undefined;
  const config = await loadConfig(configPathInput);

  const inputs =
    options.config && options.config.includes("*")
      ? [options.config]
      : config.inputs || ["src/**/*.chain.{js,ts}", "src/**/*.chain.{jsx,tsx}"];

  let outputDir = "dist/styles";
  let cssFileName = "styles.css";

  if (typeof config.output === "object" && config.output.cssFile) {
    outputDir = path.dirname(config.output.cssFile);
    cssFileName = path.basename(config.output.cssFile);
  } else if (typeof config.output === "string") {
    outputDir = config.output;
  }

  if (inputs.length === 0) {
    logger.error("No input patterns found in configuration specifications.");
    process.exit(1);
  }

  logger.info(`Target inputs: ${inputs.join(", ")}`);
  const files = findInputFiles(inputs);

  if (files.length === 0) {
    logger.warn(
      "No .chain.js or .chain.ts files matched search scope boundaries.",
    );
    return;
  }

  logger.success(`Found ${files.length} file(s) to compile.`);
  ensureDirectory(outputDir);

  const compiler = new ChainCSSCompiler({
    tokens: config.tokens,
    atomic: {
      enabled:
        options.atomic !== undefined
          ? options.atomic
          : config.atomic?.enabled !== false,
      threshold: config.atomic?.threshold || 2,
      naming:
        config.atomic?.naming ||
        (process.env.NODE_ENV === "production" ? "hash" : "readable"),
      minify:
        options.minify !== undefined
          ? options.minify
          : config.atomic?.minify !== false,
      mode: config.atomic?.mode || "hybrid",
      verbose: options.verbose || config.verbose || false,
    },
    prefixer: {
      enabled: config.prefixer?.enabled !== false,
      browsers: config.prefixer?.browsers,
    },
    output: {
      minify:
        options.minify !== undefined
          ? options.minify
          : config.output?.minify !== false,
      generateGlobalCSS: config.output?.generateGlobalCSS !== false,
    },
    verbose: options.verbose || config.verbose || false,
    breakpoints: config.breakpoints,
    debug: config.debug || false,
    timeline: config.timeline || false,
  });

  if (isPersistent) {
    compiler.setPersistentMode(true);
    if (compilerState) {
      compiler.setCompilerState(compilerState);
    }
  }

  const inspectorStore = new InspectorStore();
  const startTime = Date.now();
  const fileCSSCache = new Map<string, string>();

  let totalStyles = 0;
  let totalAtomicStyles = 0;
  let classFilesGenerated = 0;

  const writeCombinedStylesheet = (): string => {
    let combinedCSS = "";
    for (const [filePath, css] of fileCSSCache.entries()) {
      const relativePath = path.relative(process.cwd(), filePath);
      if (css.trim()) {
        combinedCSS += `\n/* ${relativePath} */\n${css}`;
      }
    }
    const cssOutputPath = path.join(outputDir, cssFileName);
    ensureDirectory(path.dirname(cssOutputPath));
    fs.writeFileSync(cssOutputPath, combinedCSS.trim(), "utf8");
    return cssOutputPath;
  };

  const processCompilationResult = (
    file: string,
    results: any,
    trackMetrics = true,
  ): { fileCSS: string; classMap: Record<string, string> } => {
    let fileCSS = "";
    const classMap: Record<string, string> = {};

    for (const [name, result] of Object.entries(results) as [string, any][]) {
      if (result.css) {
        fileCSS += result.css + "\n";
      }
      const classNames = Object.values(result.classMap)
        .filter(Boolean)
        .join(" ");
      if (classNames) {
        classMap[name] = classNames;
      }
    }

    for (const [name, compileResult] of Object.entries(results) as [
      string,
      any,
    ][]) {
      const inspector = compileResult.inspector;
      if (inspector?.ir) {
        try {
          const rules = serializeForInspector(
            inspector.ir,
            inspector.pipelineReport || [],
            inspector.diagnostics || [],
            file,
            name,
          );
          inspectorStore.addAll(rules);
        } catch (err) {
          if (options.verbose) {
            logger.warn(
              `Failed to serialize inspector telemetry for ${path.basename(file)}: ${(err as Error).message}`,
            );
          }
        }
      }
    }

    if (trackMetrics) {
      for (const result of Object.values(results) as any[]) {
        totalStyles += result.stats?.totalStyles || 0;
        totalAtomicStyles += result.stats?.atomicStyles || 0;
      }
    }

    if (Object.keys(classMap).length > 0) {
      const ext = path.extname(file);
      const isTS = ext === ".ts" || ext === ".tsx";
      const baseName = path
        .basename(file)
        .replace(/\.chain\.(ts|js|tsx|jsx)$/, "");
      const classFilePath = path.join(
        path.dirname(file),
        `${baseName}.class.${isTS ? "ts" : "js"}`,
      );

      const classLines = [
        "/** ChainCSS Generated — DO NOT EDIT */",
        "/* eslint-disable */",
        isTS ? "// @ts-nocheck\n" : "",
      ];

      for (const [name, className] of Object.entries(classMap)) {
        const result = results[name];
        if (result?.dynamic && Object.keys(result.dynamic).length > 0) {
          const fnEntries: string[] = [];
          for (const [prop, fn] of Object.entries(result.dynamic)) {
            fnEntries.push(`${prop}: ${(fn as Function).toString()}`);
          }
          classLines.push(
            `export const ${name} = { className: '${className}', dynamic: { ${fnEntries.join(", ")} } };`,
          );
        } else {
          classLines.push(`export const ${name} = '${className}';`);
        }
      }

      ensureDirectory(path.dirname(classFilePath));
      fs.writeFileSync(classFilePath, classLines.join("\n"), "utf8");
      classFilesGenerated++;

      if (options.verbose || config.verbose) {
        logger.info(
          `  Generated: ${path.relative(process.cwd(), classFilePath)}`,
        );
      }
    }

    return { fileCSS, classMap };
  };

  // ============================================================================
  // Resolve emission targets from CLI flag or config
  // ============================================================================
  const targetOption: string | string[] | undefined =
    options.target || (config.output as any)?.targets;
  const emissionTargets: string[] | null = targetOption
    ? targetOption === "all"
      ? ["css", "tailwind", "design-tokens", "figma", "graph-json"]
      : typeof targetOption === "string"
        ? targetOption
            .split(",")
            .map((t: string) => t.trim())
            .filter(Boolean)
        : Array.isArray(targetOption)
          ? targetOption
          : ["css"]
    : null;

  try {
    let completedCount = 0;
    let buildHasErrors = false;

    const compilationPromises = files.map(async (file) => {
      const relativePath = path.relative(process.cwd(), file);
      try {
        const results = await compiler.compileFile(file);
        completedCount++;
        logger.progress(
          completedCount,
          files.length,
          `Compiled: ${relativePath}`,
        );
        return { file, results, success: true };
      } catch (err) {
        completedCount++;
        logger.error(
          `Failed to compile ${relativePath}: ${(err as Error).message}`,
        );
        buildHasErrors = true;
        return { file, results: null, success: false };
      }
    });

    const compiledOutputs = await Promise.all(compilationPromises);

    if (buildHasErrors && !options.watch && !config.watch) {
      if (process.env.NODE_ENV === "test" || config.silent) {
        logger.warn(
          "Compilation encountered validation errors, but proceeding due to test/silent configuration.",
        );
      } else {
        logger.error(
          "Compilation phase encountered fatal validation errors. Halting build pipeline.",
        );
        process.exit(1);
      }
    }

    for (const output of compiledOutputs) {
      if (output.success && output.results) {
        const { fileCSS } = processCompilationResult(
          output.file,
          output.results,
          true,
        );
        fileCSSCache.set(output.file, fileCSS);
      }
    }

    const cssOutputPath = writeCombinedStylesheet();

    // Export Inspector Diagnostics
    try {
      const irData = inspectorStore.export();
      if (irData && irData.rules && irData.rules.length > 0) {
        const irOutputPath = path.join(outputDir, "chaincss-ir.json");
        ensureDirectory(path.dirname(irOutputPath));
        fs.writeFileSync(irOutputPath, JSON.stringify(irData, null, 2), "utf8");
        logger.info(
          `📊 Inspector Map: ${irData.rules.length} rules → ${path.relative(process.cwd(), irOutputPath)}`,
        );
      }
    } catch (err) {
      // Inspector tracking is optional; skip on failure
    }

    // ==========================================================================
    // MULTI-TARGET EMISSION
    // ==========================================================================
    if (emissionTargets && emissionTargets.length > 0) {
      const { emit } =
        await import("@compiler/pipeline/lowering/emitter-registry.js");

      // Build merged IR from all successfully compiled files
      const allIRs: any[] = [];
      for (const output of compiledOutputs) {
        if (output.success && output.results) {
          for (const result of Object.values(output.results) as any[]) {
            if (result?.inspector?.ir) {
              allIRs.push(result.inspector.ir);
            }
          }
        }
      }

      if (allIRs.length > 0) {
        const mergedIR = {
          ...allIRs[0],
          rules: allIRs.flatMap((ir: any) => ir.rules || []),
          diagnostics: allIRs.flatMap((ir: any) => ir.diagnostics || []),
          meta: {
            ...allIRs[0].meta,
            sourceFiles: [
              ...new Set(
                allIRs.flatMap((ir: any) => ir.meta?.sourceFiles || []),
              ),
            ],
          },
        };

        for (const target of emissionTargets) {
          // Skip 'css' since it's already emitted via writeCombinedStylesheet
          if (target === "css") continue;

          try {
            const result = emit(mergedIR, target as any, {
              minify: options.minify,
            });
            if (result) {
              const targetPath = path.join(outputDir, result.fileName);
              ensureDirectory(path.dirname(targetPath));
              fs.writeFileSync(targetPath, result.output, "utf8");
              logger.info(
                `  🎯 ${target}: ${path.relative(process.cwd(), targetPath)} (${(result.bytes / 1024).toFixed(1)}KB)`,
              );
            }
          } catch (err) {
            logger.warn(
              `  ⚠️ Failed to emit ${target}: ${(err as Error).message}`,
            );
          }
        }
      }
    }

    logger.progress(files.length, files.length, "Complete!");
    logger.success(
      `Successfully compiled ${files.length} file(s) in ${Date.now() - startTime}ms`,
    );

    if (totalStyles > 0 || classFilesGenerated > 0) {
      logger.info("Compilation metrics:");
      logger.table({
        "Total parsed styles": totalStyles,
        "Atomic classes": totalAtomicStyles,
        "Static definitions": totalStyles - totalAtomicStyles,
        "Output stylesheet": path.relative(process.cwd(), cssOutputPath),
        "Generated bindings": classFilesGenerated,
      });
    }

    // ============================================================================
    // PERSISTENT STATE — save to disk after successful build
    // ============================================================================
    if (isPersistent && persistentCache && compilerState) {
      const projectHash = Buffer.from(process.cwd())
        .toString("base64")
        .substring(0, 8);
      updateState(compilerState, compilerState.ir, files);
      await saveCompilerStateToDisk(
        compilerState,
        persistentCache,
        projectHash,
      );
      logger.info("💾 Compiler state cached to disk");

      const stats = getStateStats(compilerState);
      logger.info("📊 Persistent Compiler Stats:");
      logger.table({
        "Total compiles": stats.totalCompiles,
        Incremental: stats.incrementalCompiles,
        "Full compiles": stats.fullCompiles,
        "Live rules": stats.currentLiveRules,
        "Dirty rules": stats.dirtyRules,
        "Compiled files": stats.compiledFiles,
        Uptime: `${Math.round(stats.uptime / 1000)}s`,
        "Avg recompile %": `${stats.averageRecompilePercent}%`,
      });
    }
  } catch (error) {
    logger.error(`Compilation failed: ${(error as Error).message}`);
    process.exit(1);
  }

  // ============================================================================
  // WATCH MODE PIPELINE (with incremental compilation)
  // ============================================================================
  if (options.watch || config.watch) {
    logger.info("Watching workspace files for style changes...");
    const chokidar = await import("chokidar");
    const watcher = chokidar.watch(inputs, {
      ignored: ["**/node_modules/**", "**/dist/**", "**/.chaincss-cache/**"],
      ignoreInitial: true,
    });

    watcher.on("change", async (filePath: string) => {
      const ext = path.extname(filePath);
      if ([".js", ".ts", ".jsx", ".tsx"].includes(ext)) {
        const relativeName = path.relative(process.cwd(), filePath);
        logger.step(`Change detected in ${relativeName}. Recompiling...`);

        if (options.verbose && compilerState) {
          const impact = compiler.getIncrementalImpact(filePath);
          if (impact) {
            logger.info(
              `  📊 Impact: ${impact.affectedRules}/${impact.totalRules} rules (${impact.affectedPercent}%)` +
                (impact.shouldIncremental
                  ? " — incremental"
                  : " — full recompile recommended"),
            );
          }
        }

        try {
          const startRebuild = Date.now();
          const results = await compiler.compileFile(filePath, true);
          const { fileCSS } = processCompilationResult(
            filePath,
            results,
            false,
          );
          fileCSSCache.set(filePath, fileCSS);
          const updatedCSSPath = writeCombinedStylesheet();

          // Re-emit multi-target outputs for the changed file
          if (emissionTargets && emissionTargets.length > 0) {
            const { emit } =
              await import("@compiler/pipeline/lowering/emitter-registry.js");
            const inspector = (Object.values(results)[0] as any)?.inspector;
            if (inspector?.ir) {
              for (const target of emissionTargets) {
                if (target === "css") continue;
                try {
                  const result = emit(inspector.ir, target as any, {
                    minify: options.minify,
                  });
                  if (result) {
                    const targetPath = path.join(outputDir, result.fileName);
                    ensureDirectory(path.dirname(targetPath));
                    fs.writeFileSync(targetPath, result.output, "utf8");
                  }
                } catch (err) {
                  // Silently skip failed emissions in watch mode
                }
              }
            }
          }

          if (persistentCache && compilerState) {
            const projectHash = Buffer.from(process.cwd())
              .toString("base64")
              .substring(0, 8);
            updateState(compilerState, compilerState.ir, [filePath]);
            await saveCompilerStateToDisk(
              compilerState,
              persistentCache,
              projectHash,
            );
          }

          logger.success(
            `✓ Updated ${path.relative(process.cwd(), updatedCSSPath)} [${Date.now() - startRebuild}ms]`,
          );
        } catch (error) {
          logger.error(
            `Failed to compile modified file [${relativeName}]: ${(error as Error).message}`,
          );
        }
      }
    });

    const cleanupAndExit = (): never => {
      logger.info("Stopping workspace watch process...");

      if (compilerState && persistentCache) {
        const projectHash = Buffer.from(process.cwd())
          .toString("base64")
          .substring(0, 8);
        saveCompilerStateToDisk(compilerState, persistentCache, projectHash)
          .then(() => {
            logger.info("💾 Final compiler state saved");
          })
          .catch(() => {});
      }

      watcher.close();
      process.exit(0);
    };

    process.once("SIGINT", cleanupAndExit);
    process.once("SIGTERM", cleanupAndExit);
  }
}
