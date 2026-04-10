/// chaincss/src/cli/commands/build.ts

import path from 'path';
import { ChainCSSCompiler } from '../../core/compiler.js';
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { findInputFiles, ensureDirectory, getOutputPath } from '../utils/file-utils.js';
import type { BuildOptions } from '../types.js';

export async function buildCommand(options: BuildOptions): Promise<void> {
  const logger = createLogger(options.verbose);
  
  logger.header('ChainCSS Build');
  
  // Load configuration - ADD AWAIT HERE
  const config = await loadConfig(options.config);
  const inputs = config.inputs || [];
  const outputDir = config.output || 'dist/styles';
  
  if (inputs.length === 0) {
    logger.error('No input patterns found in configuration');
    process.exit(1);
  }
  
  logger.step(`Finding files matching: ${inputs.join(', ')}`);
  const files = findInputFiles(inputs);
  
  if (files.length === 0) {
    logger.warn('No .chain.js or .chain.ts files found');
    return;
  }
  
  logger.info(`Found ${files.length} file(s) to compile`);
  
  // Ensure output directory exists
  ensureDirectory(outputDir);
  
  // Initialize compiler
  const compiler = new ChainCSSCompiler({
    tokens: config.tokens,  // ADD TOKEN SUPPORT
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
  
  const startTime = Date.now();
  let compiledCount = 0;
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = path.relative(process.cwd(), file);
    logger.progress(i + 1, files.length, `Compiling ${relativePath}...`);
    
    try {
      const outputPath = getOutputPath(file, outputDir);
      await compiler.compile(file, outputPath);
      compiledCount++;
    } catch (error) {
      logger.error(`Failed to compile ${relativePath}:`, error);
    }
  }
  
  logger.progress(files.length, files.length, 'Complete!');
  logger.success(`Built ${compiledCount} file(s) in ${Date.now() - startTime}ms`);
  
  // Watch mode
  if (options.watch || config.watch) {
    logger.info('Watching for changes...');
    const chokidar = await import('chokidar');
    const watcher = chokidar.watch(inputs);
    
    watcher.on('change', async (filePath: string) => {
      if (filePath.endsWith('.chain.js') || filePath.endsWith('.chain.ts')) {
        logger.debug(`File changed: ${filePath}`);
        const outputPath = getOutputPath(filePath, outputDir);
        await compiler.compile(filePath, outputPath);
        logger.success(`Recompiled ${path.basename(filePath)}`);
      }
    });
  }
}