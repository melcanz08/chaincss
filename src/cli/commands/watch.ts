// src/cli/commands/watch.ts (with fixes for logger)

import path from 'path';
import chalk from 'chalk';
import fs from 'fs';
import { ChainCSSCompiler } from '../../core/compiler.js';
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { findInputFiles, ensureDirectory, getOutputPath } from '../utils/file-utils.js';
import type { BuildOptions } from '../types.js';

export interface WatchOptions extends BuildOptions {
  debounce?: number;
}

export async function watchCommand(options: WatchOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  
  logger.header('ChainCSS Watch Mode');
  
  // Load configuration
  const config = await loadConfig(options.config);
  const inputs = config.inputs || ['src/**/*.chain.{js,ts}', 'src/**/*.chain.{jsx,tsx}'];
  
  // Determine output directory
  let outputDir = 'dist/styles';
  if (typeof config.output === 'object' && config.output.cssFile) {
    outputDir = path.dirname(config.output.cssFile);
  } else if (typeof config.output === 'string') {
    outputDir = config.output;
  }
  
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
  
  // Initialize compiler
  const compiler = new ChainCSSCompiler({
    tokens: config.tokens,
    atomic: {
      enabled: config.atomic?.enabled !== false,
      threshold: config.atomic?.threshold || 2,
      naming: config.atomic?.naming || (process.env.NODE_ENV === 'production' ? 'hash' : 'readable'),
      minify: config.atomic?.minify !== false,
      mode: config.atomic?.mode || 'hybrid',
      verbose: options.verbose || config.verbose || false
    },
    prefixer: {
      enabled: config.prefixer?.enabled !== false,
      browsers: config.prefixer?.browsers
    },
    output: {
      minify: config.output?.minify !== false
    },
    verbose: options.verbose || config.verbose || false,
    breakpoints: config.breakpoints,
    debug: config.debug || false,
    timeline: config.timeline || false
  });
  
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
  const debounceDelay = options.debounce || 100;
  
  // Create watcher
  const watcher = chokidar.watch(inputs, {
    ignored: ['**/node_modules/**', '**/dist/**', '**/.chaincss-cache/**', '**/*.css', '**/*.d.ts'],
    persistent: true,
    ignoreInitial: true
  });
  
  // Debounce function to avoid multiple rapid recompilations
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
  
  // Handle file changes
  watcher.on('change', (filePath: string) => {
    const ext = path.extname(filePath);
    if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
      const relativePath = path.relative(process.cwd(), filePath);
      if (options.verbose) {
        logger.info(`File changed: ${relativePath}`);
      }
      pendingFiles.add(filePath);
      scheduleRecompile();
    }
  });
  
  // Handle new files
  watcher.on('add', (filePath: string) => {
    const ext = path.extname(filePath);
    if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
      const relativePath = path.relative(process.cwd(), filePath);
      logger.info(`📄 New file detected: ${relativePath}`);
      pendingFiles.add(filePath);
      scheduleRecompile();
    }
  });
  
  // Handle deleted files
  watcher.on('unlink', (filePath: string) => {
    const ext = path.extname(filePath);
    if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
      const relativePath = path.relative(process.cwd(), filePath);
      logger.warn(`🗑️ File deleted: ${relativePath}`);
      
      // Remove corresponding output files
      const baseName = path.basename(filePath, ext);
      const outputBase = path.join(outputDir, baseName);
      const cssFile = `${outputBase}.css`;
      const classFile = `${outputBase}.class.js`;
      
      if (fs.existsSync(cssFile)) fs.unlinkSync(cssFile);
      if (fs.existsSync(classFile)) fs.unlinkSync(classFile);
      
      logger.info(`  Removed output files for ${relativePath}`);
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
  
  // Keep the process alive
  await new Promise(() => {});
}