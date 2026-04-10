// chaincss/src/cli/utils/logger.ts

import chalk from 'chalk';

export type LogLevel = 'info' | 'success' | 'warn' | 'error' | 'debug';

export class Logger {
  private verbose: boolean;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  info(message: string, ...args: any[]): void {
    console.log(chalk.blue('ℹ'), message, ...args);
  }

  success(message: string, ...args: any[]): void {
    console.log(chalk.green('✓'), message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.log(chalk.yellow('⚠'), message, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.log(chalk.red('✗'), message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (this.verbose) {
      console.log(chalk.gray('🔍'), message, ...args);
    }
  }

  step(message: string, ...args: any[]): void {
    console.log(chalk.cyan('→'), message, ...args);
  }

  header(message: string): void {
    console.log();
    console.log(chalk.bold.cyan(message));
    console.log(chalk.gray('─'.repeat(message.length)));
  }

  divider(): void {
    console.log(chalk.gray('─'.repeat(50)));
  }

  table(data: Record<string, any>): void {
    const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));
    
    for (const [key, value] of Object.entries(data)) {
      const paddedKey = key.padEnd(maxKeyLength);
      console.log(`  ${chalk.cyan(paddedKey)}: ${value}`);
    }
  }

  progress(current: number, total: number, message: string): void {
    const percent = Math.round((current / total) * 100);
    const barLength = 30;
    const filledLength = Math.round((barLength * current) / total);
    const bar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
    
    process.stdout.write(`\r  ${bar} ${percent}% ${message}`);
    if (current === total) {
      process.stdout.write('\n');
    }
  }
}

export function createLogger(verbose: boolean = false): Logger {
  return new Logger(verbose);
}