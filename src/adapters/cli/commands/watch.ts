// ============================================================================
// FILE: src/adapters/cli/commands/watch.ts
// ChainCSS - Dynamic Watch Engine with Live Config Hot-Reloading
// ============================================================================

import path from 'path';
import fs from 'fs';
import { ChainCSSCompiler } from '@core/usecases/compiler.js';
import { createLogger } from "@shared/logger/index.js";
import { loadConfig } from "../utils/config-loader.js";
import { findInputFiles, ensureDirectory } from '../utils/file-utils.js';
import type { BuildOptions } from '../types.js';

export interface WatchOptions extends BuildOptions {
  debounce?: number;
}

export async function watchCommand(options: WatchOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  logger.header('ChainCSS Watch Mode');

  // Load configuration (let binding allows dynamic reloading)
  let config = await loadConfig(options.config);
  let inputs = config.inputs || ['src/**/*.chain.{js,ts}', 'src/**/*.chain.{jsx,tsx}'];

  // Dynamic output directory resolution helper
  const getOutputDir = (currentConfig: any): string => {
    if (typeof currentConfig.output === 'object' && currentConfig.output.cssFile) {
      return path.dirname(currentConfig.output.cssFile);
    } else if (typeof currentConfig.output === 'string') {
      return currentConfig.output;
    }
    return 'dist/styles';
  };

  let outputDir = getOutputDir(config);

  if (inputs.length === 0) {
    logger.error('No input patterns found in configuration');
    process.exit(1);
  }

  logger.info(`Watching files matching: ${inputs.join(', ')}`);

  // Find initial files
  const initialFiles = findInputFiles(inputs);
  logger.success(`Found ${initialFiles.length} file(s) to watch`);

  // Ensure output directory exists
  ensureDirectory(outputDir);

  // Helper factory to initialize compiler with latest configurations
  const createCompilerInstance = (latestConfig: any) => {
    return new ChainCSSCompiler({
      tokens: latestConfig.tokens,
      atomic: {
        enabled: latestConfig.atomic?.enabled !== false,
        threshold: latestConfig.atomic?.threshold || 2,
        naming: latestConfig.atomic?.naming || (process.env.NODE_ENV === 'production' ? 'hash' : 'readable'),
        minify: latestConfig.atomic?.minify !== false,
        mode: latestConfig.atomic?.mode || 'hybrid',
        verbose: options.verbose || latestConfig.verbose || false
      },
      prefixer: {
        enabled: latestConfig.prefixer?.enabled !== false,
        browsers: latestConfig.prefixer?.browsers
      },
      output: {
        minify: latestConfig.output?.minify !== false
      },
      verbose: options.verbose || latestConfig.verbose || false,
      breakpoints: latestConfig.breakpoints,
      debug: latestConfig.debug || false,
      timeline: latestConfig.timeline || false
    });
  };

  // Initialize mutable compiler instance
  let compiler = createCompilerInstance(config);

  // Initial compilation
  logger.step('Initial compilation...');
  let compiledCount = 0;

  for (let i = 0; i < initialFiles.length; i++) {
    const file = initialFiles[i];
    const relativePath = path.relative(process.cwd(), file);
    logger.progress(i + 1, initialFiles.length, `Compiling ${relativePath}...`);

    try {
      await compiler.compile(file, outputDir);
      compiledCount++;
    } catch (error) {
      logger.error(`Failed to compile ${relativePath}: ${(error as Error).message}`);
    }
  }

  logger.progress(initialFiles.length, initialFiles.length, 'Initial build complete!');
  logger.success(`Compiled ${compiledCount} file(s)`);

  // Setup file watcher
  logger.divider();
  logger.info(`👀 Watching for changes... (press Ctrl+C to stop)\n`);

  const chokidar = await import('chokidar');
  const debounceDelay = options.debounce || 200;

  // Track the absolute configuration path to register hot-reloads
  const configPath = options.config
    ? path.resolve(process.cwd(), options.config)
    : ['chaincss.config.js', 'chaincss.config.ts', 'chaincss.config.json', 'chaincss.config.mjs']
        .map(p => path.join(process.cwd(), p))
        .find(p => fs.existsSync(p));

  const watchTargets = [...inputs];
  if (configPath) {
    watchTargets.push(configPath);
    logger.info(`⚙️  Loaded configuration file watcher for: ${path.relative(process.cwd(), configPath)}`);
  }

  // Create watcher
  const watcher = chokidar.watch(watchTargets, {
    // LOOP PROTECTION FIX: Explicitly ignore generated stylesheet mappings in project workspace
    ignored: [
      '**/node_modules/**', 
      '**/dist/**', 
      '**/.chaincss-cache/**', 
      '**/*.css', 
      '**/*.d.ts',
      '**/*.class.ts', // Prevents self-trigger loops
      '**/*.class.js'  // Prevents self-trigger loops
    ],
    persistent: true,
    ignoreInitial: true
  });

  // Debounce queue
  let debounceTimer: NodeJS.Timeout | null = null;
  let pendingFiles = new Set<string>();

  function scheduleRecompile() {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(async () => {
      const filesToCompile = Array.from(pendingFiles);
      pendingFiles.clear();

      logger.divider();
      logger.info(`📦 Recompiling ${filesToCompile.length} changed file(s)...`);

      let successCount = 0;
      let failCount = 0;

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

      if (successCount > 0) {
        logger.success(`✅ Recompiled ${successCount} file(s) successfully`);
      }
      if (failCount > 0) {
        logger.error(`❌ Failed to recompile ${failCount} file(s)`);
      }

      debounceTimer = null;
    }, debounceDelay);
  }

  // Handle file events
  watcher.on('all', async (event, filePath) => {
    const ext = path.extname(filePath);
    const isSourceFile = ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx';
    const relativePath = path.relative(process.cwd(), filePath);

    // Watcher hook: Configuration changes
    if (configPath && filePath === configPath && event === 'change') {
      logger.divider();
      logger.info(`⚙️  Configuration change detected: ${relativePath}`);
      logger.step('Reloading workspace options & re-initializing compiler...');
      
      try {
        // ESM CACHE BUSTING: Bypass module caching. Adding timestamp forces Node to re-import the file clean.
        const configUrl = options.config 
          ? `${options.config}?update=${Date.now()}` 
          : undefined;

        config = await loadConfig(configUrl);
        outputDir = getOutputDir(config); // DYNAMIC OUTPUT PATH RESOLUTION FIX
        inputs = config.inputs || ['src/**/*.chain.{js,ts}', 'src/**/*.chain.{jsx,tsx}'];
        
        compiler = createCompilerInstance(config);
        
        // Recompile all matching project files with updated tokens
        const activeFiles = findInputFiles(inputs);
        activeFiles.forEach(f => pendingFiles.add(f));
        scheduleRecompile();
      } catch (err) {
        logger.error(`Failed to reload configuration: ${(err as Error).message}`);
      }
      return;
    }

    if (!isSourceFile) return;

    // Watcher hook: Modified files
    if (event === 'change') {
      if (options.verbose) {
        logger.info(`File changed: ${relativePath}`);
      }
      pendingFiles.add(filePath);
      scheduleRecompile();
    }

    // Watcher hook: Added files
    if (event === 'add') {
      logger.info(`📄 New file detected: ${relativePath}`);
      pendingFiles.add(filePath);
      scheduleRecompile();
    }

    // Watcher hook: Deleted files
    if (event === 'unlink') {
      logger.warn(`🗑️ File deleted: ${relativePath}`);

      const baseName = path.basename(filePath, ext);
      const outputBase = path.join(outputDir, baseName);
      const cssFile = `${outputBase}.css`;

      // Match language-safe boundaries: .class.ts for TS, .class.js for JS
      const isTS = ext === '.ts' || ext === '.tsx';
      const classFile = `${outputBase}.class.${isTS ? 'ts' : 'js'}`;

      if (fs.existsSync(cssFile)) {
        fs.unlinkSync(cssFile);
        logger.info(`  Removed stylesheet: ${path.relative(process.cwd(), cssFile)}`);
      }
      if (fs.existsSync(classFile)) {
        fs.unlinkSync(classFile);
        logger.info(`  Removed map: ${path.relative(process.cwd(), classFile)}`);
      }
    }
  });

  // Handle watcher errors
  watcher.on('error', (error: unknown) => {
    logger.error(`Watcher error: ${error instanceof Error ? error.message : String(error)}`);
  });

  // Handle process termination
  const cleanup = () => {
    logger.info('\n👋 Shutting down watcher...');
    watcher.close();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep process active
  process.stdin.resume();
}