// ============================================================================
// FILE: src/cli/index.ts
// ChainCSS - Entangled CSS Framework Core CLI Engine Harness
// ============================================================================

import { Command } from 'commander';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import chalk from 'chalk';

import { buildCommand } from './commands/build.js';
import { timelineCommand } from './commands/timeline.js';
import { devCommand } from './commands/dev.js';
import { cacheCommand } from './commands/cache.js';
import { checkCommand } from './commands/check.js';
import { auditCommand } from './commands/audit.js';
import { entanglementCommand } from './commands/entanglement.js';
import { figmaInitCommand } from './commands/figma.js';
import { createCommand } from './commands/create.js';
import { normalizeCLIOptions } from './utils/cli-parser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Traverses upwards from the target directory path until it locates the project root package.json.
 */
function findPackageJson(startDir: string): string {
  let currentDir = startDir;
  const rootDir = path.parse(currentDir).root;

  while (currentDir !== rootDir) {
    const packagePath = path.join(currentDir, 'package.json');
    if (existsSync(packagePath)) {
      return packagePath;
    }
    currentDir = path.dirname(currentDir);
  }

  throw new Error('Could not locate project package.json boundaries upstream.');
}

/**
 * Safely resolves the package version, preventing top-level crashes in bundled environments.
 */
function getFrameworkVersion(): string {
  try {
    const pkgPath = findPackageJson(__dirname);
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    return pkg.version || '1.0.0';
  } catch {
    // Fallback if the file structure is compiled or missing package.json context
    return '1.0.0-compiled';
  }
}

/**
 * Global application error interceptor and exit code state coordinator.
 */
function handleCommandError(error: unknown, commandContext: string): never {
  console.error(
    chalk.red(`\n❌ Error executing [${commandContext}]:`),
    error instanceof Error ? error.message : String(error)
  );

  if (process.env.DEBUG && error instanceof Error) {
    console.error(chalk.gray(error.stack));
  }

  process.exit(1);
}

const version = getFrameworkVersion();
const program = new Command();

program
  .name('chaincss')
  .description('ChainCSS - Entangled High-Performance CSS Framework')
  .version(version, '-V, --version', 'Output the current version profile')
  .helpOption('-h, --help', 'Display comprehensive command instructions');

// ============================================================================
// COMMAND: init
// ============================================================================
program
  .command('init')
  .description('Initialize the standard compilation runtime configuration file')
  .option('-f, --force', 'Force overwrite an existing configuration layer')
  .action(async (rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      const targetConfigPath = 'chaincss.config.js';

      if (existsSync(targetConfigPath) && !options.force) {
        console.log(
          chalk.yellow('A chaincss.config.js file already exists. Provide --force to overwrite.')
        );
        return;
      }

      // Sanitized layout using standard space formatting characters (\u0020)
      const boilerplateContent = [
        "import { defineConfig } from 'chaincss';",
        "",
        "export default defineConfig({",
        "  namespace: 'chain-',",
        "  inputs: ['src/**/*.chain.{ts,tsx}'],",
        "  output: {",
        "    cssFile: 'dist/styles.css'",
        "  },",
        "  atomic: {",
        "    enabled: true",
        "  },",
        "  tokens: {",
        "    relationships: [",
        "      {",
        "        type: 'derived',",
        "        source: 'colors.primary.500',",
        "        target: 'colors.primary.100',",
        "        method: 'mix-white 80%'",
        "      },",
        "      {",
        "        type: 'contrast',",
        "        foreground: 'colors.text.onPrimary',",
        "        background: 'colors.primary.500',",
        "        target: 4.5,",
        "        autoFix: 'auto'",
        "      }",
        "    ]",
        "  }",
        "});",
        ""
      ].join('\n');

      writeFileSync(targetConfigPath, boilerplateContent, 'utf8');
      console.log(chalk.green('✓ Created boilerplate layout: chaincss.config.js'));
    } catch (err) {
      handleCommandError(err, 'init');
    }
  });

// ============================================================================
// COMMAND: create
// ============================================================================
const createSubcommand = program
  .command('create')
  .description('Scaffold new project resources and templates')
  .action(() => {
    createSubcommand.outputHelp();
  });

createSubcommand
  .command('app [name]')
  .description('Bootstrap a comprehensive starter application powered by ChainCSS')
  .option('-t, --template <type>', 'Specify architecture boilerplate variant (minimal | entangled | react)', 'entangled')
  .option('--pm <manager>', 'Define target node package dependency manager (npm | pnpm | yarn | bun)', 'npm')
  .option('--no-install', 'Skip automatic installation loops for node package modules')
  .option('-v, --verbose', 'Expose granular engineering execution logs')
  .action(async (name, rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      await createCommand(name, {
        template: options.template,
        pm: options.pm,
        install: options.install !== false,
        verbose: !!options.verbose
      });
    } catch (err) {
      handleCommandError(err, 'create app');
    }
  });

// ============================================================================
// COMMANDS: build & watch
// ============================================================================
program
  .command('build')
  .description('Compile and compile current project style architectures')
  .option('-c, --config <path>', 'Custom directory pointer target to locate configuration path')
  .option('-v, --verbose', 'Activate full telemetry feedback lines')
  .option('-w, --watch', 'Establish continuous monitor pipeline loop over styling changes')
  .option('--minify', 'Compress final parsed stylesheet output file dimensions')
  .option('--atomic', 'Process stylesheets down to individual optimized class values')
  .action(async (rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      await buildCommand(options);
    } catch (err) {
      handleCommandError(err, 'build');
    }
  });

program
  .command('watch')
  .description('Continuous live directory compilation loop tracking resource file changes')
  .option('-c, --config <path>', 'Alternative structural file search boundary address target')
  .option('-v, --verbose', 'Verbose engine status message streams')
  .action(async (rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      await buildCommand({ ...options, watch: true });
    } catch (err) {
      handleCommandError(err, 'watch');
    }
  });

// ============================================================================
// COMMAND: timeline
// ============================================================================
program
  .command('timeline')
  .description('Query, compare, and audit internal styling snapshot history arrays')
  .argument('<action>', 'Timeline tracking phase action command target (list | diff | export | clear)')
  .option('-s, --snapshot1 <id>', 'Baseline style target snapshot identification reference marker')
  .option('--snapshot2 <id>', 'Comparison target snapshot identification reference marker')
  .option('-o, --output <path>', 'Explicit destination path targeting compilation log outputs')
  .action(async (action, rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      await timelineCommand(action, options);
    } catch (err) {
      handleCommandError(err, 'timeline');
    }
  });

// ============================================================================
// COMMAND: dev
// ============================================================================
program
  .command('dev')
  .description('Launch the localized visual development server portal')
  .option('-c, --config <path>', 'Custom project definition configurations locator address')
  .option('-p, --port <number>', 'Assigned host port listening address allocation target', '3000')
  .action(async (rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      const parsedPort = parseInt(options.port, 10);
      
      if (Number.isNaN(parsedPort) || parsedPort <= 0 || parsedPort > 65535) {
        throw new Error(`The provided port identifier allocation [${options.port}] is invalid.`);
      }

      await devCommand({
        config: options.config,
        port: parsedPort
      });
    } catch (err) {
      handleCommandError(err, 'dev');
    }
  });

// ============================================================================
// COMMAND: cache
// ============================================================================
program
  .command('cache')
  .description('Inspect, empty, or balance incremental compilation cache structures')
  .argument('<action>', 'Specific sub-cache pipeline maintenance operational mode (clear | stats | prune)')
  .option('-v, --verbose', 'Verbose storage mapping telemetries output logs')
  .action(async (action, rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      await cacheCommand(action, options);
    } catch (err) {
      handleCommandError(err, 'cache');
    }
  });

// ============================================================================
// COMMAND: check
// ============================================================================
program
  .command('check')
  .description('Validate style constraints and track broken reference tokens')
  .option('-c, --config <path>', 'Target entry framework setup specification file')
  .option('-v, --verbose', 'Verbose structural inspection logging paths')
  .option('--fix', 'Automatically repair non-breaking syntax evaluation errors')
  .action(async (rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      await checkCommand(options);
    } catch (err) {
      handleCommandError(err, 'check');
    }
  });

// ============================================================================
// COMMAND: audit
// ============================================================================
program
  .command('audit')
  .description('Evaluate stylesheet structures against global WCAG accessibility formulas')
  .option('--theme <path>', 'Explicit file pointer to active design dictionary parameters')
  .option('--contract <path>', 'Contract file target parameter boundary constraint rules mapping')
  .option('--fail-on <level>', 'Target compliance ceiling metrics boundary index (AA | AAA)', 'AA')
  .option('--target <ratio>', 'Minimum acceptable relative luminance match coefficient ceiling', '4.5')
  .option('--json <path>', 'Export strict compliance reports to specified JSON path address')
  .option('--strict', 'Treat color verification warnings as structural compiler crash points')
  .option('--fix', 'Generate automated adjustment parameters targeting failed nodes')
  .option('--write', 'Persist corrections directly into the project token system files')
  .option('-v, --verbose', 'Verbose validation diagnostics pipeline details')
  .action(async (rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      await auditCommand({
        theme: options.theme,
        contract: options.contract,
        failOn: options.failOn,
        target: parseFloat(options.target),
        json: options.json,
        strict: !!options.strict,
        fix: !!options.fix,
        write: !!options.write,
        verbose: !!options.verbose
      });
    } catch (err) {
      handleCommandError(err, 'audit');
    }
  });

// ============================================================================
// COMMAND: entanglement
// ============================================================================
program
  .command('entanglement')
  .alias('entangle')
  .description('Execute real-time bidirectional token graph translation passes')
  .option('-i, --input <path>', 'Design systems tokens entry reference target pointer location', 'tokens.json')
  .option('-o, --output <path>', 'Generated stylesheet compilation targets endpoint location')
  .option('-w, --watch', 'Establish a live watch process over the target configuration file')
  .option('--figma', 'Enforce strict syntax compatibility mapping targeting Figma JSON parameters')
  .option('--fix', 'Resolve structural inconsistencies inline on input read steps', 'true')
  .option('--debounce <ms>', 'Throttling period applied before triggering rebuild sequence frames', '150')
  .option('-v, --verbose', 'Granular debugging pipeline logging status updates')
  .action(async (rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      await entanglementCommand({
        input: options.input,
        output: options.output,
        watch: !!options.watch,
        figma: !!options.figma,
        fix: options.fix !== 'false',
        debounceMs: parseInt(options.debounce, 10),
        verbose: !!options.verbose
      });
    } catch (err) {
      handleCommandError(err, 'entanglement');
    }
  });

// ============================================================================
// COMMAND: figma
// ============================================================================
const figmaSubcommand = program
  .command('figma')
  .description('Figma synchronization infrastructure setup integrations')
  .action(() => {
    figmaSubcommand.outputHelp();
  });

figmaSubcommand
  .command('init')
  .description('Configure a live, automated GitHub actions workflow mapping Figma file data')
  .option('--repo <org/repo>', 'The targeted repository link pointing to production repo assets')
  .option('--fileId <id>', 'Unique file reference signature assigned inside Figma platform canvases')
  .option('--branch <name>', 'Default synchronization development branch allocation target', 'main')
  .option('--path <location>', 'Destination repository filepath map for the generated tokens data file', 'tokens.json')
  .option('-y, --yes', 'Bypass all interactive text prompts using setup fallback values')
  .option('-v, --verbose', 'Verbose remote sync network telemetry output profiles')
  .action(async (rawOptions) => {
      const options = normalizeCLIOptions(rawOptions);
    try {
      await figmaInitCommand({
        repo: options.repo,
        fileId: options.fileId,
        branch: options.branch,
        path: options.path,
        yes: !!options.yes,
        verbose: !!options.verbose
      });
    } catch (err) {
      handleCommandError(err, 'figma init');
    }
  });

// ============================================================================
// HELP & EXAMPLES TERMINAL FORMATTING
// ============================================================================
program.on('--help', () => {
  console.log('');
  console.log(chalk.cyan('Examples:'));
  console.log(chalk.gray('  # Initialize development configuration parameters'));
  console.log('  $ chaincss init');
  console.log('');
  console.log(chalk.gray('  # Trigger production build optimization flow'));
  console.log('  $ chaincss build --minify --atomic');
  console.log('');
  console.log(chalk.gray('  # Audit contrast constraints and print failures'));
  console.log('  $ chaincss audit');
  console.log('');
  console.log(chalk.gray('  # Audit accessibility guidelines with automatic adjustments calculated'));
  console.log('  $ chaincss audit --fix --write');
  console.log('');
});

// Default fallback execution block when no arguments are provided
if (process.argv.length === 2) {
  program.outputHelp();
  process.exit(0);
}

program.parse(process.argv);