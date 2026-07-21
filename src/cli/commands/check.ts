// ============================================================================
// FILE: src/cli/commands/check.ts
// ============================================================================

import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { ChainCSSCompiler } from '../../core/compiler.js';
import { createLogger } from '../utils/logger.js';
import { loadConfig } from '../utils/config-loader.js';
import { findInputFiles } from '../utils/file-utils.js';
import { createPipeline } from '../../compiler/pipeline/unified-pipeline.js';
import type { BuildOptions } from '../types.js';

interface CheckResult {
  file: string;
  errors: number;
  warnings: number;
  infos: number;
  diagnostics: any[];
}

// Safely relative-ize paths within error strings to keep CI logs pristine
function cleanErrorMessage(msg: string): string {
  const cwd = process.cwd();
  // Escape backslashes for Windows safety
  const escapedCwd = cwd.replace(/\\/g, '\\\\');
  const regex = new RegExp(escapedCwd, 'g');
  return msg.replace(regex, '.');
}

export async function checkCommand(options: BuildOptions & { fix?: boolean; strict?: boolean }): Promise<void> {
  const logger = createLogger(options.verbose);
  const fix = options.fix || false;
  const isStrict = options.strict || false;

  logger.header(fix ? 'ChainCSS Check & Fix' : 'ChainCSS Audit');

  const config = await loadConfig(
    options.config && !options.config.includes('*') ? options.config : undefined
  );
  
  // If config path contains a wildcard, treat it as an input pattern directly
  const configHasWildcard = options.config && options.config.includes('*');
  const inputs = configHasWildcard
    ? [options.config!]
    : (config.inputs && config.inputs.length > 0 ? config.inputs : ['src/**/*.chain.{js,ts}']);

  if (inputs.length === 0) {
    logger.error('No input patterns found in configuration');
    process.exit(1);
  }

  logger.info(`Input patterns: ${inputs.join(', ')}`);
  const files = findInputFiles(inputs);

  if (files.length === 0) {
    if (isStrict || process.env.CI) {
      logger.error('Error: No .chain.js or .chain.ts files found matching input glob. Failing build in strict/CI mode.');
      process.exit(1);
    }
    logger.warn('No .chain.js or .chain.ts files found');
    return;
  }

  logger.success(`Found ${files.length} file(s) to audit`);

  // Initialize compiler — always verbose to collect diagnostics
  const compiler = new ChainCSSCompiler({
    verbose: true,
    silent: true,
    tokens: config.tokens,
    breakpoints: config.breakpoints,
  });

  // Use the CI pipeline for full validation + analysis
  compiler.setPipeline(createPipeline('ci'));

  const startTime = Date.now();
  let completedCount = 0;

  // Process all files concurrently exploiting asynchronous I/O safely
  const auditPromises = files.map(async (file) => {
    const relativePath = path.relative(process.cwd(), file);
    let fileErrors = 0;
    let fileWarnings = 0;
    let fileInfos = 0;
    let fileFixes = 0;
    const fileDiags: any[] = [];
    let writtenCssPath: string | null = null;

    try {
      const compileResults = await compiler.compileFile(file);

      for (const [, result] of Object.entries(compileResults)) {
        const diags = (result as any)._diagnostics || [];

        for (const d of diags) {
          if (d.severity === 'error') fileErrors++;
          else if (d.severity === 'warning') fileWarnings++;
          else fileInfos++;
          
          // Ensure diagnostic messages don't leak host machine paths
          if (d.message) d.message = cleanErrorMessage(d.message);
          if (d.suggestion) d.suggestion = cleanErrorMessage(d.suggestion);
          
          fileDiags.push(d);
        }

        if (fix && (result as any)._pipelineReport) {
          const report = (result as any)._pipelineReport;
          let fileChanged = false;
          
          for (const entry of report) {
            if (entry.result?.changes > 0) {
              fileFixes += entry.result.changes;
              fileChanged = true;
            }
          }
          
          // SAFE ASYNC WRITE: Avoids blocking event loop thread, preventing disk write races
          if (fileChanged && (result as any).css) {
            const cssFile = file.replace(/\.(js|ts|jsx|tsx)$/, '.css');
            const targetDir = path.dirname(cssFile);
            
            // Ensure container directories exist safely before writing
            await fs.promises.mkdir(targetDir, { recursive: true });
            await fs.promises.writeFile(cssFile, (result as any).css, 'utf8');
            writtenCssPath = path.relative(process.cwd(), cssFile);
          }
        }
      }

      completedCount++;
      logger.progress(completedCount, files.length, `Auditing ${relativePath}...`);

      return {
        file: relativePath,
        errors: fileErrors,
        warnings: fileWarnings,
        infos: fileInfos,
        fixes: fileFixes,
        diagnostics: fileDiags,
        writtenCssPath,
        success: true
      };
    } catch (error) {
      completedCount++;
      logger.progress(completedCount, files.length, `Failed ${relativePath}`);
      
      const sanitizedErrorMsg = cleanErrorMessage((error as Error).message);
      logger.error(`Failed to audit ${relativePath}: ${sanitizedErrorMsg}`);
      
      return {
        file: relativePath,
        errors: 1, // Treat failed compilations as blocking errors
        warnings: 0,
        infos: 0,
        fixes: 0,
        diagnostics: [{
          severity: 'error',
          message: `Compilation breakdown: ${sanitizedErrorMsg}`
        }],
        writtenCssPath: null,
        success: false
      };
    }
  });

  const rawResults = await Promise.all(auditPromises);
  logger.progress(files.length, files.length, 'Complete!');

  // Aggregate stats cleanly out of concurrent processing context
  const results: CheckResult[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfos = 0;
  let totalFixes = 0;

  for (const r of rawResults) {
    totalErrors += r.errors;
    totalWarnings += r.warnings;
    totalInfos += r.infos;
    totalFixes += r.fixes;

    if (r.success) {
      results.push({
        file: r.file,
        errors: r.errors,
        warnings: r.warnings,
        infos: r.infos,
        diagnostics: r.diagnostics,
      });
    }

    if (r.writtenCssPath) {
      logger.success(`Fixed: ${r.writtenCssPath}`);
    }
  }

  // ── Report ──
  const elapsed = Date.now() - startTime;

  console.log('');
  console.log(chalk.bold('🔍 ChainCSS Audit Report'));
  console.log(chalk.gray('─'.repeat(60)));
  console.log(
    `  Files audited:  ${chalk.white(files.length)} in ${chalk.white(elapsed + 'ms')}`
  );

  // ── Detailed diagnostics ──
  const hasIssues = totalErrors > 0 || totalWarnings > 0 || totalInfos > 0;
  if (hasIssues) {
    console.log('');
    console.log(chalk.bold('📋 Details'));
    console.log(chalk.gray('─'.repeat(60)));

    for (const r of results) {
      if (r.diagnostics.length === 0) continue;

      let errorCount = 0;
      let warnCount = 0;
      let infoCount = 0;

      // Single-pass optimization loop to retrieve diagnostic counts
      for (const d of r.diagnostics) {
        if (d.severity === 'error') errorCount++;
        else if (d.severity === 'warning') warnCount++;
        else if (d.severity === 'info' || d.severity === 'hint') infoCount++;
      }

      const label = [
        errorCount > 0 ? chalk.red(`${errorCount} errors`) : '',
        warnCount > 0 ? chalk.yellow(`${warnCount} warnings`) : '',
        infoCount > 0 ? chalk.gray(`${infoCount} info`) : '',
      ].filter(Boolean).join(', ');

      console.log('');
      console.log(`  ${chalk.cyan(r.file)} ${chalk.gray(`(${label})`)}`);

      for (const d of r.diagnostics) {
        if (d.id === 'pipeline-skip') continue;
        const icon = d.severity === 'error' ? '❌' : d.severity === 'warning' ? '⚠️ ' : 'ℹ️ ';
        const colorFn = d.severity === 'error' ? chalk.red : d.severity === 'warning' ? chalk.yellow : chalk.gray;

        console.log(colorFn(`    ${icon} ${d.message}`));
        if (d.suggestion) {
          console.log(chalk.gray(`        → ${d.suggestion}`));
        }
      }
    }
  }

  // ── Summary ──
  console.log('');
  console.log(chalk.gray('─'.repeat(60)));

  if (totalErrors > 0) {
    console.log(`  ${chalk.red('🔴 ERRORS')} — ${chalk.bold(totalErrors)}`);
  }
  if (totalWarnings > 0) {
    console.log(`  ${chalk.yellow('🟡 WARNINGS')} — ${chalk.bold(totalWarnings)}`);
  }
  if (totalInfos > 0) {
    console.log(`  ${chalk.blue('🔵 INFO')} — ${chalk.bold(totalInfos)}`);
  }
  if (fix && totalFixes > 0) {
    console.log(`  ${chalk.green('🔧 FIXED')} — ${chalk.bold(totalFixes)} auto-corrections`);
  }

  // Pattern suggestions
  const patternDiags = results.flatMap(r => r.diagnostics).filter(
    d => d.pass === 'pattern-detector' || d.pass === 'layout-analyzer'
  );
  if (patternDiags.length > 0) {
    console.log('');
    console.log(`  ${chalk.magenta('🧩 PATTERNS')} — ${chalk.bold(patternDiags.length)} found`);
    for (const d of patternDiags.slice(0, 5)) {
      console.log(chalk.gray(`    ${d.message}`));
      if (d.suggestion) {
        console.log(chalk.gray(`      → ${d.suggestion}`));
      }
    }
    if (patternDiags.length > 5) {
      console.log(chalk.gray(`    ... and ${patternDiags.length - 5} more`));
    }
  }

  console.log('');
  console.log(chalk.gray('─'.repeat(60)));

  if (totalErrors === 0 && totalWarnings === 0) {
    console.log(chalk.green('✅ All checks passed!'));
  } else if (totalErrors > 0) {
    console.log(chalk.red(`❌ ${totalErrors} critical issue(s) found.`));
    if (!fix) {
      console.log(chalk.gray('  Run with --fix to auto-correct what can be fixed.'));
    }
  } else {
    console.log(chalk.yellow(`⚠️  ${totalWarnings} warning(s) found.`));
    if (!fix) {
      console.log(chalk.gray('  Run with --fix to auto-correct what can be fixed.'));
    }
  }

  if (!fix) {
    console.log('');
    console.log(chalk.gray('  Run "chaincss check --fix" to auto-correct issues.'));
  }

  if (totalErrors > 0) {
    process.exit(1);
  }
}