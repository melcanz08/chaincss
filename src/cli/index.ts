// src/cli/index.ts

import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';
import { loadConfig } from './utils/config-loader.js';

// ============================================================================
// Path Resolution
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const findPackageJson = (startDir: string): string => {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    const pkgPath = path.join(currentDir, 'package.json');
    if (existsSync(pkgPath)) return pkgPath;
    currentDir = path.dirname(currentDir);
  }
  throw new Error('Could not find package.json');
};

const packageJsonPath = findPackageJson(__dirname);
const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));

// ============================================================================
// CLI Setup
// ============================================================================

const program = new Command();

program
  .name('chaincss')
  .description('ChainCSS - Zero-runtime CSS-in-JS Compiler')
  .version(packageJson.version, '-V, --version')
  .usage('[command] [options]')
  .helpOption('-h, --help', 'Display help for command');

// ============================================================================
// Error Handling
// ============================================================================

const handleError = (error: unknown, command: string): void => {
  console.error(chalk.red(`\n❌ Error running "${command}":`));
  if (error instanceof Error) {
    console.error(chalk.red(`   ${error.message}`));
    if (process.env.DEBUG) console.error(error.stack);
  } else {
    console.error(chalk.red(`   ${String(error)}`));
  }
  process.exit(1);
};

// ============================================================================
// Init Command
// ============================================================================

program
  .command('init')
  .description('Initialize ChainCSS configuration file')
  .option('-f, --force', 'Overwrite existing config file')
  .action(async (options) => {
    try {
      const configPath = 'chaincss.config.js';
      if (existsSync(configPath) && !options.force) {
        console.log(chalk.yellow('Config file already exists. Use --force to overwrite.'));
        return;
      }

      const config = `export default {
  inputs: ['src/**/*.chain.{js,ts}', 'src/**/*.tsx'],
  output: {
    cssFile: 'global.css',
    classMapFile: 'style',
    minify: false,
    generateGlobalCSS: true
  },
  atomic: {
    enabled: false,
    naming: 'readable',
    mode: 'build'
  },
  verbose: true
};`;
      writeFileSync(configPath, config);
      console.log(chalk.green('✓ Created chaincss.config.js with Object-based output.'));
    } catch (error) {
      handleError(error, 'init');
    }
  });

// ============================================================================
// Build Command — delegates to commands/build.ts
// ============================================================================

program
  .command('build')
  .description('Compile ChainCSS styles to CSS')
  .option('-c, --config <pattern>', 'Glob pattern for input files')
  .option('-v, --verbose', 'Verbose output')
  .option('-w, --watch', 'Watch for changes and recompile')
  .option('--minify', 'Minify output CSS')
  .option('--atomic', 'Enable atomic CSS extraction')
  .action(async (opts) => {
    try {
      const { buildCommand } = await import('./commands/build.js');
      await buildCommand({
        config: opts.config,
        verbose: opts.verbose,
        watch: opts.watch,
        minify: opts.minify,
        atomic: opts.atomic,
      });
    } catch (error) {
      handleError(error, 'build');
    }
  });

// ============================================================================
// Watch Command — delegates to commands/build.ts with watch: true
// ============================================================================

program
  .command('watch')
  .description('Watch and automatically recompile styles')
  .option('-c, --config <pattern>', 'Glob pattern for input files')
  .option('-v, --verbose', 'Verbose output')
  .action(async (opts) => {
    try {
      const { buildCommand } = await import('./commands/build.js');
      await buildCommand({
        config: opts.config,
        verbose: opts.verbose,
        watch: true,
      });
    } catch (error) {
      handleError(error, 'watch');
    }
  });

// ============================================================================
// Timeline Command
// ============================================================================

program
  .command('timeline')
  .description('Manage style timeline')
  .argument('<action>', 'Action: list, diff, export, clear')
  .option('-s, --snapshot1 <id>', 'First snapshot ID or selector for diff')
  .option('--snapshot2 <id>', 'Second snapshot ID or selector for diff')
  .option('-o, --output <path>', 'Output file for export')
  .action(async (action, options) => {
    const { timelineCommand } = await import('./commands/timeline.js');
    await timelineCommand(action, options);
  });

// ============================================================================
// Cache Command
// ============================================================================

program
  .command('cache')
  .description('Manage persistent cache')
  .argument('<action>', 'Action: clear, stats, prune')
  .option('-v, --verbose', 'Verbose output')
  .action(async (action, options) => {
    const { cacheCommand } = await import('./commands/cache.js');
    await cacheCommand(action, options);
  });

// ============================================================================
// Check Command
// ============================================================================

program
  .command('check')
  .description('Audit styles for accessibility, typos, and design patterns')
  .option('-c, --config <pattern>', 'Glob pattern for input files')
  .option('-v, --verbose', 'Verbose output')
  .option('--fix', 'Auto-fix issues where possible')
  .action(async (opts) => {
    try {
      const { checkCommand } = await import('./commands/check.js');
      await checkCommand({
        config: opts.config,
        verbose: opts.verbose,
        fix: opts.fix,
      });
    } catch (error) {
      handleError(error, 'check');
    }
  });

// ============================================================================
// Help and Examples
// ============================================================================

program.on('--help', () => {
  console.log('');
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  # Initialize a new project'));
  console.log('  $ chaincss init');
  console.log('');
  console.log(chalk.gray('  # Build all styles'));
  console.log('  $ chaincss build -c "src/**/*.chain.js"');
  console.log('');
  console.log(chalk.gray('  # Watch for changes'));
  console.log('  $ chaincss watch -c "src/**/*.chain.js"');
  console.log('');
  console.log(chalk.gray('  # Audit styles for issues'));
  console.log('  $ chaincss check');
  console.log('');
  console.log(chalk.gray('  # Auto-fix issues'));
  console.log('  $ chaincss check --fix');
  console.log('');
  console.log(chalk.cyan('Documentation:'));
  console.log('  https://github.com/melcanz08/chaincss');
  console.log('');
});

// ============================================================================
// Parse Arguments
// ============================================================================

if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);