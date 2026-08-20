// ============================================================================
// FILE: src/adapters/cli/commands/watch.ts (UPDATED WITH INCREMENTAL)
// ChainCSS - Dynamic Watch Engine with Live Config Hot-Reloading
// ============================================================================

import path from "path";
import fs from "fs";
import crypto from "crypto";
import { ChainCSSCompiler } from "@core/usecases/compiler.js";
import { createLogger } from "@shared/logger/index.js";
import { loadConfig } from "../utils/config-loader.js";
import { findInputFiles, ensureDirectory } from "../utils/file-utils.js";
import { createPipeline } from "@compiler/pipeline/pipeline.js";
import { StatefulIncrementalCompiler } from "@compiler/incremental/stateful-compiler.js";
import type { BuildOptions } from "../types.js";

export interface WatchOptions extends BuildOptions {
  debounce?: number;
}

export async function watchCommand(options: WatchOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  logger.header("ChainCSS Watch Mode");

  // Load configuration
  let config = await loadConfig(options.config);
  let inputs = config.inputs || [
    "src/**/*.chain.{js,ts}",
    "src/**/*.chain.{jsx,tsx}",
  ];

  // Dynamic output directory resolution
  const getOutputDir = (currentConfig: any): string => {
    if (
      typeof currentConfig.output === "object" &&
      currentConfig.output.cssFile
    ) {
      return path.dirname(currentConfig.output.cssFile);
    } else if (typeof currentConfig.output === "string") {
      return currentConfig.output;
    }
    return "dist/styles";
  };

  let outputDir = getOutputDir(config);

  if (inputs.length === 0) {
    logger.error("No input patterns found in configuration");
    process.exit(1);
  }

  logger.info(`Watching files matching: ${inputs.join(", ")}`);

  // Find initial files
  const initialFiles = findInputFiles(inputs);
  logger.success(`Found ${initialFiles.length} file(s) to watch`);

  // Ensure output directory exists
  ensureDirectory(outputDir);

  // Helper factory to initialize compiler
  const createCompilerInstance = (latestConfig: any) => {
    return new ChainCSSCompiler({
      tokens: latestConfig.tokens,
      atomic: {
        enabled: latestConfig.atomic?.enabled !== false,
        threshold: latestConfig.atomic?.threshold || 2,
        naming:
          latestConfig.atomic?.naming ||
          (process.env.NODE_ENV === "production" ? "hash" : "readable"),
        minify: latestConfig.atomic?.minify !== false,
        mode: latestConfig.atomic?.mode || "hybrid",
        verbose: options.verbose || latestConfig.verbose || false,
      },
      prefixer: {
        enabled: latestConfig.prefixer?.enabled !== false,
        browsers: latestConfig.prefixer?.browsers,
      },
      output: {
        minify: latestConfig.output?.minify !== false,
      },
      verbose: options.verbose || latestConfig.verbose || false,
      breakpoints: latestConfig.breakpoints,
      debug: latestConfig.debug || false,
      timeline: latestConfig.timeline || false,
    });
  };

  // Initialize mutable compiler instance
  let compiler = createCompilerInstance(config);

  // Initialize incremental compiler
  let incrementalCompiler: StatefulIncrementalCompiler | null = null;

  const initializeIncrementalCompiler = (): StatefulIncrementalCompiler => {
    const pipeline = createPipeline("default");
    
    const newCompiler = new StatefulIncrementalCompiler({
      pipeline,
      parseFile: async (filePath: string, source: string) => {
        const results = await compiler.compileVirtualSource(source, filePath);
        const ir = (results as any)?.__ir || {
          id: "temp",
          rules: [],
          meta: {
            version: "1.0",
            createdAt: Date.now(),
            sourceFiles: [filePath],
            passCount: 0,
            passes: [],
            dirtyRules: 0,
            compiledAt: Date.now(),
          },
          diagnostics: [],
        };
        return ir;
      },
      generateRuleId: (filePath: string, stableName: string) => {
        const hash = crypto
          .createHash("md5")
          .update(`${filePath}:${stableName}`)
          .digest("hex")
          .slice(0, 8);
        return hash;
      },
      rebuild: async () => {
        const allFiles = findInputFiles(inputs);
        const allRules: any[] = [];
        
        for (const file of allFiles) {
          const source = fs.readFileSync(file, "utf8");
          const results = await compiler.compileVirtualSource(source, file);
          const ir = (results as any)?.__ir;
          if (ir?.rules) {
            allRules.push(...ir.rules);
          }
        }
        
        return {
          id: "full-rebuild",
          rules: allRules,
          atRules: [],
          meta: {
            version: "1.0",
            createdAt: Date.now(),
            sourceFiles: allFiles,
            passCount: 0,
            passes: [],
            dirtyRules: 0,
            compiledAt: Date.now(),
          },
          diagnostics: [],
        };
      },
      fullRebuildOnConfig: true,
      fullRebuildOnToken: false,
    });
    incrementalCompiler = newCompiler;
    return newCompiler;
  };

  // Initial compilation
  logger.step("Initial compilation...");
  let compiledCount = 0;

  for (let i = 0; i < initialFiles.length; i++) {
    const file = initialFiles[i];
    const relativePath = path.relative(process.cwd(), file);
    logger.progress(i + 1, initialFiles.length, `Compiling ${relativePath}...`);

    try {
      await compiler.compile(file, outputDir);
      compiledCount++;
    } catch (error) {
      logger.error(
        `Failed to compile ${relativePath}: ${(error as Error).message}`,
      );
    }
  }

  logger.progress(
    initialFiles.length,
    initialFiles.length,
    "Initial build complete!",
  );
  logger.success(`Compiled ${compiledCount} file(s)`);

  // Initialize incremental compiler after initial compilation
  const incCompiler = initializeIncrementalCompiler();

  // Set initial IR
  if ((compiler as any).getCurrentIR) {
    const currentIR = (compiler as any).getCurrentIR();
    if (currentIR) {
      incCompiler.setIR(currentIR);
      logger.info("⚡ Incremental compilation enabled");
    }
  }

  // Setup file watcher
  logger.divider();
  logger.info(`👀 Watching for changes... (press Ctrl+C to stop)\n`);

  const chokidar = await import("chokidar");
  const debounceDelay = options.debounce || 200;

  // Track configuration path for hot-reloads
  const configPath = options.config
    ? path.resolve(process.cwd(), options.config)
    : [
        "chaincss.config.js",
        "chaincss.config.ts",
        "chaincss.config.json",
        "chaincss.config.mjs",
      ]
        .map((p) => path.join(process.cwd(), p))
        .find((p) => fs.existsSync(p));

  const watchTargets = [...inputs];
  if (configPath) {
    watchTargets.push(configPath);
    logger.info(
      `⚙️  Loaded configuration file watcher for: ${path.relative(process.cwd(), configPath)}`,
    );
  }

  // Create watcher
  const watcher = chokidar.watch(watchTargets, {
    ignored: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.chaincss-cache/**",
      "**/*.css",
      "**/*.d.ts",
      "**/*.class.ts",
      "**/*.class.js",
    ],
    persistent: true,
    ignoreInitial: true,
  });

  // Debounce queue
  let debounceTimer: NodeJS.Timeout | null = null;
  let pendingFiles = new Set<string>();
  let pendingDeletions = new Set<string>();

  function scheduleRecompile() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      const filesToCompile = Array.from(pendingFiles);
      const filesToDelete = Array.from(pendingDeletions);
      pendingFiles.clear();
      pendingDeletions.clear();

      logger.divider();
      logger.info(
        `📦 Processing ${filesToCompile.length} changed file(s), ${filesToDelete.length} deleted file(s)...`,
      );

      let successCount = 0;
      let failCount = 0;
      let incrementalUsed = false;

      // Try incremental compilation first
      if (
        incrementalCompiler &&
        incrementalCompiler.getIR() &&
        filesToDelete.length === 0 // Only incremental for changes, not deletions yet
      ) {
        try {
          const updateResult = await incrementalCompiler.update({
            changedFiles: filesToCompile.map((file) => ({
              filePath: file,
              kind: determineChangeKind(file),
              source: fs.readFileSync(file, "utf8"),
            })),
            deletedFiles: filesToDelete,
          });

          // Write the resulting CSS
          if (updateResult.finalCSS) {
            const cssOutputPath = path.join(outputDir, "chaincss.css");
            ensureDirectory(path.dirname(cssOutputPath));
            fs.writeFileSync(cssOutputPath, updateResult.finalCSS);
          }

          const stats = updateResult.incremental;
          logger.success(
            `⚡ Incremental: ${stats.recompiledCount}/${stats.totalRules} rules recompiled, ` +
            `${stats.reusedCount} reused`,
          );
          
          incrementalUsed = true;
          successCount = filesToCompile.length;
        } catch (incrementalErr) {
          logger.warn(
            `Incremental compilation failed, falling back to full: ${(incrementalErr as Error).message}`,
          );
        }
      }

      // Fallback to full compilation if incremental was not used
      if (!incrementalUsed) {
        for (const file of filesToCompile) {
          const relativePath = path.relative(process.cwd(), file);
          try {
            await compiler.compile(file, outputDir);
            logger.success(`  ✓ ${relativePath}`);
            successCount++;
          } catch (error) {
            logger.error(`  ✗ ${relativePath}: ${(error as Error).message}`);
            failCount++;
          }
        }
      }

      // Handle deletions
      if (filesToDelete.length > 0) {
        for (const file of filesToDelete) {
          const relativePath = path.relative(process.cwd(), file);
          const baseName = path.basename(file, path.extname(file));
          const cssFile = path.join(outputDir, `${baseName}.css`);
          const classFile = path.join(outputDir, `${baseName}.class.js`);

          if (fs.existsSync(cssFile)) {
            fs.unlinkSync(cssFile);
            logger.info(`  Removed stylesheet: ${relativePath}`);
          }
          if (fs.existsSync(classFile)) {
            fs.unlinkSync(classFile);
            logger.info(`  Removed map: ${relativePath}`);
          }

          // Notify incremental compiler
          if (incrementalCompiler && incrementalCompiler.getIR()) {
            await incrementalCompiler.update({
              changedFiles: [],
              deletedFiles: [file],
            }).catch(() => {});
          }
        }
      }

      if (successCount > 0) {
        logger.success(`✅ Recompiled ${successCount} file(s) successfully`);
      }
      if (failCount > 0) {
        logger.error(`❌ Failed to recompile ${failCount} file(s)`);
      }

      debounceTimer = null;
    }, debounceDelay);
  }

  function determineChangeKind(filePath: string): "style" | "token" | "config" | "unknown" {
    const basename = path.basename(filePath);
    if (basename.includes("config")) return "config";
    if (basename.includes("token") || basename.includes("theme")) return "token";
    return "style";
  }

  // Handle file events
  watcher.on("all", async (event, filePath) => {
    const ext = path.extname(filePath);
    const isSourceFile =
      ext === ".js" || ext === ".ts" || ext === ".jsx" || ext === ".tsx";
    const relativePath = path.relative(process.cwd(), filePath);

    // Configuration changes
    if (configPath && filePath === configPath && event === "change") {
      logger.divider();
      logger.info(`⚙️  Configuration change detected: ${relativePath}`);
      logger.step("Reloading workspace options & re-initializing compiler...");

      try {
        const configUrl = options.config
          ? `${options.config}?update=${Date.now()}`
          : undefined;

        config = await loadConfig(configUrl);
        outputDir = getOutputDir(config);
        inputs = config.inputs || [
          "src/**/*.chain.{js,ts}",
          "src/**/*.chain.{jsx,tsx}",
        ];

        compiler = createCompilerInstance(config);
        initializeIncrementalCompiler();

        // Recompile all matching files
        const activeFiles = findInputFiles(inputs);
        activeFiles.forEach((f) => pendingFiles.add(f));
        scheduleRecompile();
      } catch (err) {
        logger.error(
          `Failed to reload configuration: ${(err as Error).message}`,
        );
      }
      return;
    }

    if (!isSourceFile) return;

    // Modified files
    if (event === "change") {
      if (options.verbose) {
        logger.info(`File changed: ${relativePath}`);
      }
      pendingFiles.add(filePath);
      scheduleRecompile();
    }

    // Added files
    if (event === "add") {
      logger.info(`📄 New file detected: ${relativePath}`);
      pendingFiles.add(filePath);
      scheduleRecompile();
    }

    // Deleted files
    if (event === "unlink") {
      logger.warn(`🗑️ File deleted: ${relativePath}`);
      pendingDeletions.add(filePath);
      scheduleRecompile();
    }
  });

  // Handle watcher errors
  watcher.on("error", (error: unknown) => {
    logger.error(
      `Watcher error: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  // Handle process termination
  const cleanup = () => {
    logger.info("\n👋 Shutting down watcher...");
    watcher.close();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    process.exit(0);
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  // Keep process active
  process.stdin.resume();
}