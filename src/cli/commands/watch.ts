// chaincss/src/cli/commands/watch.ts

import path from 'path';
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
  
  // Load configuration - ADD AWAIT HERE
  const config = await loadConfig(options.config);
  const inputs = config.inputs || [];
  const outputDir = config.output || 'dist/styles';
  
  if (inputs.length === 0) {
    logger.error('No input patterns found in configuration');
    process.exit(1);
  }
  
  logger.step(`Watching files matching: ${inputs.join(', ')}`);
  
  // Find initial files
  const initialFiles = findInputFiles(inputs);
  logger.info(`Found ${initialFiles.length} file(s) to watch`);
  
  // Ensure output directory exists
  ensureDirectory(outputDir);
  
  // Initialize compiler - ADD TOKEN SUPPORT
  const compiler = new ChainCSSCompiler({
    tokens: config.tokens,
    atomic: {
      enabled: config.atomic?.enabled !== false,
      threshold: config.atomic?.threshold || 3,
      naming: config.atomic?.naming || 'hash',
      minify: config.atomic?.minify !== false,
      mode: config.atomic?.mode || 'hybrid',
      verbose: options.verbose || config.verbose
    },
    prefixer: {
      enabled: config.prefixer?.enabled !== false,
      browsers: config.prefixer?.browsers
    },
    output: {
      minify: config.atomic?.minify !== false
    },
    verbose: options.verbose || config.verbose
  });
  
  // Initial compilation
  logger.step('Initial compilation...');
  let compiledCount = 0;
  
  for (let i = 0; i < initialFiles.length; i++) {
    const file = initialFiles[i];
    const relativePath = path.relative(process.cwd(), file);
    logger.progress(i + 1, initialFiles.length, `Compiling ${relativePath}...`);
    
    try {
      const outputPath = getOutputPath(file, outputDir);
      await compiler.compile(file, outputPath);
      compiledCount++;
    } catch (error) {
      logger.error(`Failed to compile ${relativePath}:`, error);
    }
  }
  
  logger.progress(initialFiles.length, initialFiles.length, 'Initial build complete!');
  logger.success(`Compiled ${compiledCount} file(s)`);
  
  // Setup file watcher
  logger.divider();
  logger.info(`👀 Watching for changes... (press Ctrl+C to stop)`);
  logger.info('');
  
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
          const outputPath = getOutputPath(file, outputDir);
          await compiler.compile(file, outputPath);
          logger.success(`  ✓ ${relativePath}`);
          successCount++;
        } catch (error) {
          logger.error(`  ✗ ${relativePath}:`, error instanceof Error ? error.message : error);
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
    if (filePath.endsWith('.chain.js') || filePath.endsWith('.chain.ts')) {
      const relativePath = path.relative(process.cwd(), filePath);
      logger.debug(`File changed: ${relativePath}`);
      pendingFiles.add(filePath);
      scheduleRecompile();
    }
  });
  
  // Handle new files
  watcher.on('add', (filePath: string) => {
    if (filePath.endsWith('.chain.js') || filePath.endsWith('.chain.ts')) {
      const relativePath = path.relative(process.cwd(), filePath);
      logger.info(`📄 New file detected: ${relativePath}`);
      pendingFiles.add(filePath);
      scheduleRecompile();
    }
  });
  
  // Handle deleted files
  watcher.on('unlink', (filePath: string) => {
    if (filePath.endsWith('.chain.js') || filePath.endsWith('.chain.ts')) {
      const relativePath = path.relative(process.cwd(), filePath);
      logger.warn(`🗑️ File deleted: ${relativePath}`);
      
      // Remove corresponding output files
      const outputPath = getOutputPath(filePath, outputDir);
      const fs = require('fs');
      const cssFile = `${outputPath}.css`;
      const jsFile = `${outputPath}.js`;
      const dtsFile = `${outputPath}.d.ts`;
      
      if (fs.existsSync(cssFile)) fs.unlinkSync(cssFile);
      if (fs.existsSync(jsFile)) fs.unlinkSync(jsFile);
      if (fs.existsSync(dtsFile)) fs.unlinkSync(dtsFile);
      
      logger.debug(`  Removed output files for ${relativePath}`);
    }
  });
  
  // Handle watcher errors
  watcher.on('error', (error: Error) => {
    logger.error('Watcher error:', error.message);
  });
  
  // Handle process termination
  const cleanup = () => {
    logger.info('');
    logger.info('👋 Shutting down watcher...');
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