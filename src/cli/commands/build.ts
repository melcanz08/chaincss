// src/cli/commands/build.ts

import path from 'path';
import chalk from 'chalk';
import { ChainCSSCompiler } from '../../core/compiler.js';
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { findInputFiles, ensureDirectory } from '../utils/file-utils.js';
import type { BuildOptions } from '../types.js';

export async function buildCommand(options: BuildOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  
  logger.header('ChainCSS Build');
  
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
  
  logger.info(`Input patterns: ${inputs.join(', ')}`);
  const files = findInputFiles(inputs);
  
  if (files.length === 0) {
    logger.warn('No .chain.js or .chain.ts files found');
    return;
  }
  
  logger.success(`Found ${files.length} file(s) to compile`);
  
  ensureDirectory(outputDir);
  
  // Initialize compiler
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
  
  const startTime = Date.now();
  
  // Compile all files using compileComponents
  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const relativePath = path.relative(process.cwd(), file);
      logger.progress(i + 1, files.length, `Compiling ${relativePath}...`);
      
      try {
        await compiler.compile(file, outputDir);
      } catch (error) {
        logger.error(`Failed to compile ${relativePath}: ${(error as Error).message}`);
      }
    }
    
    logger.progress(files.length, files.length, 'Complete!');
    logger.success(`Built ${files.length} file(s) in ${Date.now() - startTime}ms`);
    
    // Show stats
    const stats = compiler.getStats();
    if (stats.totalStyles > 0) {
      logger.info('Compilation statistics:');
      logger.table({
        'Total styles': stats.totalStyles,
        'Atomic styles': stats.atomicStyles,
        'Standard styles': (stats as any).standardStyles || 0,
        'CSS savings': stats.savings || '0%'
      });
    }
    
  } catch (error) {
    logger.error(`Compilation failed: ${(error as Error).message}`);
    process.exit(1);
  }
  
  // Watch mode
  if (options.watch || config.watch) {
    logger.info('Watching for changes...');
    const chokidar = await import('chokidar');
    const watcher = chokidar.watch(inputs, {
      ignored: ['**/node_modules/**', '**/dist/**', '**/.chaincss-cache/**']
    });
    
    watcher.on('change', async (filePath: string) => {
      const ext = path.extname(filePath);
      if (ext === '.js' || ext === '.ts' || ext === '.jsx' || ext === '.tsx') {
        logger.step(`Change detected: ${path.basename(filePath)}`);
        try {
          await compiler.compile(filePath, outputDir);
          logger.success(`Recompiled ${path.basename(filePath)}`);
        } catch (error) {
          logger.error(`Failed to recompile: ${(error as Error).message}`);
        }
      }
    });
    
    // Keep process alive
    process.on('SIGINT', () => {
      logger.info('Stopping watch mode...');
      watcher.close();
      process.exit(0);
    });
  }
}