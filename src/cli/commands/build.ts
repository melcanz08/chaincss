// ============================================================================
// FILE: src/cli/commands/build.ts
// ChainCSS - High Performance Style Compilations Engine Handler
// ============================================================================

import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { ChainCSSCompiler } from '../../core/compiler.js';
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { findInputFiles, ensureDirectory } from '../utils/file-utils.js';
import type { BuildOptions } from '../types.js';

import { serializeForInspector } from '../../compiler/pipeline/inspector/serializer.js';
import { InspectorStore } from '../../compiler/pipeline/inspector/store.js';

export async function buildCommand(options: BuildOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  logger.header('ChainCSS Build Pipeline');

  // Distinguish configuration options file path from wildcards search globs
  const configPathInput = options.config && !options.config.includes('*') ? options.config : undefined;
  const config = await loadConfig(configPathInput);

  const inputs = options.config && options.config.includes('*')
    ? [options.config]
    : config.inputs || ['src/**/*.chain.{js,ts}', 'src/**/*.chain.{jsx,tsx}'];

  let outputDir = 'dist/styles';
  let cssFileName = 'styles.css';

  if (typeof config.output === 'object' && config.output.cssFile) {
    outputDir = path.dirname(config.output.cssFile);
    cssFileName = path.basename(config.output.cssFile);
  } else if (typeof config.output === 'string') {
    outputDir = config.output;
  }

  if (inputs.length === 0) {
    logger.error('No input patterns found in configuration specifications.');
    process.exit(1);
  }

  logger.info(`Target inputs: ${inputs.join(', ')}`);
  const files = findInputFiles(inputs);

  if (files.length === 0) {
    logger.warn('No .chain.js or .chain.ts files matched search scope boundaries.');
    return;
  }

  logger.success(`Found ${files.length} file(s) to compile.`);
  ensureDirectory(outputDir);

  const compiler = new ChainCSSCompiler({
    tokens: config.tokens,
    atomic: {
      enabled: options.atomic !== undefined ? options.atomic : (config.atomic?.enabled !== false),
      threshold: config.atomic?.threshold || 2,
      naming: config.atomic?.naming || (process.env.NODE_ENV === 'production' ? 'hash' : 'readable'),
      minify: options.minify !== undefined ? options.minify : (config.atomic?.minify !== false),
      mode: config.atomic?.mode || 'hybrid',
      verbose: options.verbose || config.verbose || false
    },
    prefixer: {
      enabled: config.prefixer?.enabled !== false,
      browsers: config.prefixer?.browsers
    },
    output: {
      minify: options.minify !== undefined ? options.minify : (config.output?.minify !== false),
      generateGlobalCSS: config.output?.generateGlobalCSS !== false
    },
    verbose: options.verbose || config.verbose || false,
    breakpoints: config.breakpoints,
    debug: config.debug || false,
    timeline: config.timeline || false
  });

  const inspectorStore = new InspectorStore();
  const startTime = Date.now();

  // Keep track of CSS outputs mapped to their files for instant rebuilds
  const fileCSSCache = new Map<string, string>();

  let totalStyles = 0;
  let totalAtomicStyles = 0;
  let classFilesGenerated = 0;

  /**
   * Helper utility to write out consolidated stylesheets from cache
   */
  const writeCombinedStylesheet = (): string => {
    let combinedCSS = '';
    for (const [filePath, css] of fileCSSCache.entries()) {
      const relativePath = path.relative(process.cwd(), filePath);
      if (css.trim()) {
        combinedCSS += `\n/* ${relativePath} */\n${css}`;
      }
    }
    const cssOutputPath = path.join(outputDir, cssFileName);
    ensureDirectory(path.dirname(cssOutputPath));
    fs.writeFileSync(cssOutputPath, combinedCSS.trim(), 'utf8');
    return cssOutputPath;
  };

  /**
   * Processes individual file compilation results, returning the generated classes.
   */
  const processCompilationResult = (
    file: string, 
    results: any, 
    trackMetrics = true
  ): { fileCSS: string; classMap: Record<string, string> } => {
    let fileCSS = '';
    const classMap: Record<string, string> = {};

    for (const [name, result] of Object.entries(results) as [string, any][]) {
      if (result.css) {
        fileCSS += result.css + '\n';
      }
      
      const classNames = Object.values(result.classMap).filter(Boolean).join(' ');
      if (classNames) {
        classMap[name] = classNames;
      }
    }

    // Process inspector metadata
    for (const [name, compileResult] of Object.entries(results) as [string, any][]) {
      const inspector = compileResult.inspector;
      if (inspector?.ir) {
        try {
          const rules = serializeForInspector(
            inspector.ir,
            inspector.pipelineReport || [],
            inspector.diagnostics || [],
            file,
            name
          );
          inspectorStore.addAll(rules);
        } catch (err) {
          if (options.verbose) {
            logger.warn(`Failed to serialize inspector telemetry for ${path.basename(file)}: ${(err as Error).message}`);
          }
        }
      }
    }

    // Aggregate tracking statistics (skip if re-compiling in watch mode)
    if (trackMetrics) {
      for (const result of Object.values(results) as any[]) {
        totalStyles += result.stats?.totalStyles || 0;
        totalAtomicStyles += result.stats?.atomicStyles || 0;
      }
    }

    // Write .class declaration files matching the source file's language type
    if (Object.keys(classMap).length > 0) {
      const ext = path.extname(file);
      const isTS = ext === '.ts' || ext === '.tsx';
      const baseName = path.basename(file).replace(/\.chain\.(ts|js|tsx|jsx)$/, '');
      const classFilePath = path.join(path.dirname(file), `${baseName}.class.${isTS ? 'ts' : 'js'}`);

      const classLines = [
        '/** ChainCSS Generated — DO NOT EDIT */',
        '/* eslint-disable */',
        isTS ? '// @ts-nocheck\n' : ''
      ];

      for (const [name, className] of Object.entries(classMap)) {
        const result = results[name];
        if (result?.dynamic && Object.keys(result.dynamic).length > 0) {
          const fnEntries: string[] = [];
          for (const [prop, fn] of Object.entries(result.dynamic)) {
            fnEntries.push(`${prop}: ${(fn as Function).toString()}`);
          }
          classLines.push(`export const ${name} = { className: '${className}', dynamic: { ${fnEntries.join(', ')} } };`);
        } else {
          classLines.push(`export const ${name} = '${className}';`);
        }
      }

      ensureDirectory(path.dirname(classFilePath));
      fs.writeFileSync(classFilePath, classLines.join('\n'), 'utf8');
      classFilesGenerated++;

      if (options.verbose || config.verbose) {
        logger.info(`  Generated: ${path.relative(process.cwd(), classFilePath)}`);
      }
    }

    return { fileCSS, classMap };
  };

  try {
    let completedCount = 0;
    let buildHasErrors = false;

    // Parallelize file compilations to maximize performance
    const compilationPromises = files.map(async (file) => {
      const relativePath = path.relative(process.cwd(), file);
      try {
        const results = await compiler.compileFile(file);
        completedCount++;
        logger.progress(completedCount, files.length, `Compiled: ${relativePath}`);
        return { file, results, success: true };
      } catch (err) {
        completedCount++;
        logger.error(`Failed to compile ${relativePath}: ${(err as Error).message}`);
        buildHasErrors = true;
        return { file, results: null, success: false };
      }
    });

    const compiledOutputs = await Promise.all(compilationPromises);

    // FIXED: Immediately crash build execution in CI environments if compilation fails
    if (buildHasErrors && !options.watch && !config.watch) {
      if (process.env.NODE_ENV === 'test' || config.silent) {
        logger.warn('Compilation encountered validation errors, but proceeding due to test/silent configuration.');
      } else {
        logger.error('Compilation phase encountered fatal validation errors. Halting build pipeline.');
        process.exit(1);
      }
    }

    // Process parallelized compilation outputs
    for (const output of compiledOutputs) {
      if (output.success && output.results) {
        const { fileCSS } = processCompilationResult(output.file, output.results, true);
        fileCSSCache.set(output.file, fileCSS);
      }
    }

    // Output Consolidated Stylesheet
    const cssOutputPath = writeCombinedStylesheet();

    // Export Inspector Diagnostics
    try {
      const irData = inspectorStore.export();
      if (irData && irData.rules && irData.rules.length > 0) {
        const irOutputPath = path.join(outputDir, 'chaincss-ir.json');
        ensureDirectory(path.dirname(irOutputPath));
        fs.writeFileSync(irOutputPath, JSON.stringify(irData, null, 2), 'utf8');
        logger.info(`📊 Inspector Map: ${irData.rules.length} rules → ${path.relative(process.cwd(), irOutputPath)}`);
      }
    } catch (err) {
      // Inspector tracking is optional; skip on failure
    }

    logger.progress(files.length, files.length, 'Complete!');
    logger.success(`Successfully compiled ${files.length} file(s) in ${Date.now() - startTime}ms`);

    if (totalStyles > 0 || classFilesGenerated > 0) {
      logger.info('Compilation metrics:');
      logger.table({
        'Total parsed styles': totalStyles,
        'Atomic classes': totalAtomicStyles,
        'Static definitions': totalStyles - totalAtomicStyles,
        'Output stylesheet': path.relative(process.cwd(), cssOutputPath),
        'Generated bindings': classFilesGenerated
      });
    }

  } catch (error) {
    logger.error(`Compilation failed: ${(error as Error).message}`);
    process.exit(1);
  }

  // ============================================================================
  // WATCH MODE PIPELINE
  // ============================================================================
  if (options.watch || config.watch) {
    logger.info('Watching workspace files for style changes...');
    const chokidar = await import('chokidar');
    const watcher = chokidar.watch(inputs, {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.chaincss-cache/**'],
      ignoreInitial: true
    });

    watcher.on('change', async (filePath: string) => {
      const ext = path.extname(filePath);
      if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
        const relativeName = path.relative(process.cwd(), filePath);
        logger.step(`Change detected in ${relativeName}. Recompiling...`);

        try {
          const startRebuild = Date.now();
          const results = await compiler.compileFile(filePath);
          
          // Re-extract and update local file bindings (skip adding to global telemetry)
          const { fileCSS } = processCompilationResult(filePath, results, false);
          
          // Update compilation memory cache and write the updated combined stylesheet
          fileCSSCache.set(filePath, fileCSS);
          const updatedCSSPath = writeCombinedStylesheet();

          logger.success(
            `✓ Updated ${path.relative(process.cwd(), updatedCSSPath)} [${Date.now() - startRebuild}ms]`
          );
        } catch (error) {
          logger.error(`Failed to compile modified file [${relativeName}]: ${(error as Error).message}`);
        }
      }
    });

    // Handle clean process shutdown
    const cleanupAndExit = (): never => {
      logger.info('Stopping workspace watch process...');
      watcher.close();
      process.exit(0);
    };

    process.once('SIGINT', cleanupAndExit);
    process.once('SIGTERM', cleanupAndExit);
  }
}