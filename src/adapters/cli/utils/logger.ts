// ============================================================================
// FILE: src/adapters/cli/utils/logger.ts
// ============================================================================

import chalk from "chalk";

export type LogLevel = "info" | "success" | "warn" | "error" | "debug";

// Determine if environment natively supports full Unicode symbols (e.g., non-Windows, or Windows with modern terminal/UTF-8 active)
const supportsUnicode =
  process.platform !== "win32" ||
  process.env.WT_SESSION || // Windows Terminal
  process.env.TERM === "xterm-256color" ||
  process.env.LANG?.includes("UTF-8");

const SYMBOLS = {
  info: supportsUnicode ? "ℹ" : "i",
  success: supportsUnicode ? "✓" : "√",
  warn: supportsUnicode ? "⚠" : "!",
  error: supportsUnicode ? "✗" : "x",
  step: supportsUnicode ? "→" : ">",
  debug: supportsUnicode ? "🔍" : "D",
  barFilled: supportsUnicode ? "█" : "=",
  barEmpty: supportsUnicode ? "░" : "-",
  divider: "─",
};

export class Logger {
  private verbose: boolean;
  private isProgressBarActive: boolean = false;

  constructor(verbose: boolean = false) {
    this.verbose = verbose;
  }

  setVerbose(verbose: boolean): void {
    this.verbose = verbose;
  }

  isVerbose(): boolean {
    return this.verbose;
  }

  /**
   * Clears the current active progress bar line before writing standard log messages,
   * avoiding visual corruption when messages are logged during long operations.
   */
  private clearProgressLine(): void {
    if (this.isProgressBarActive && process.stdout.isTTY) {
      process.stdout.write("\r\x1b[K");
      this.isProgressBarActive = false;
    }
  }

  info(message: string, ...args: any[]): void {
    this.clearProgressLine();
    console.log(chalk.blue(SYMBOLS.info), message, ...args);
  }

  success(message: string, ...args: any[]): void {
    this.clearProgressLine();
    console.log(chalk.green(SYMBOLS.success), message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.clearProgressLine();
    console.error(chalk.yellow(SYMBOLS.warn), message, ...args);
  }

  error(message: string, ...args: any[]): void {
    this.clearProgressLine();
    console.error(chalk.red(SYMBOLS.error), message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    if (this.verbose) {
      this.clearProgressLine();
      console.log(chalk.gray(SYMBOLS.debug), message, ...args);
    }
  }

  step(message: string, ...args: any[]): void {
    this.clearProgressLine();
    console.log(chalk.cyan(SYMBOLS.step), message, ...args);
  }

  header(message: string): void {
    this.clearProgressLine();
    // Strip ANSI styling from message parameter to calculate underline length correctly
    const cleanLength = message.replace(
      /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
      "",
    ).length;
    console.log();
    console.log(chalk.bold.cyan(message));
    console.log(chalk.gray(SYMBOLS.divider.repeat(cleanLength)));
  }

  divider(): void {
    this.clearProgressLine();
    console.log(chalk.gray(SYMBOLS.divider.repeat(50)));
  }

  table(data: Record<string, any>): void {
    const keys = Object.keys(data);
    if (keys.length === 0) return;

    this.clearProgressLine();
    const maxKeyLength = Math.max(...keys.map((k) => k.length));

    for (const [key, value] of Object.entries(data)) {
      const paddedKey = key.padEnd(maxKeyLength);
      console.log(`  ${chalk.cyan(paddedKey)}: ${value}`);
    }
  }

  /**
   * Renders progress indicators cleanly with shell line clearing.
   * Safely degrades logs in non-interactive environments (CI pipelines).
   */
  progress(current: number, total: number, message: string): void {
    const safeTotal = total <= 0 ? 1 : total;
    const percent = Math.min(
      100,
      Math.max(0, Math.round((current / safeTotal) * 100)),
    );

    if (!process.stdout.isTTY) {
      if (current === total) {
        this.info(`${message} (100%)`);
      }
      return;
    }

    const barLength = 30;
    const filledLength = Math.min(
      barLength,
      Math.max(0, Math.round((barLength * current) / safeTotal)),
    );
    const bar =
      SYMBOLS.barFilled.repeat(filledLength) +
      SYMBOLS.barEmpty.repeat(barLength - filledLength);

    // '\r\x1b[K' returns carriage to start AND erases ghost characters
    process.stdout.write(`\r\x1b[K  ${bar} ${percent}% ${message}`);
    this.isProgressBarActive = true;

    if (current >= total) {
      process.stdout.write("\n");
      this.isProgressBarActive = false;
    }
  }
}

// Keep a private tracking map for isolated programmatic instances
const loggersMap = new Map<string, Logger>();

/**
 * Creates or retrieves a scoped Logger instance.
 * @param scope Unique namespace identifier. Defaults to 'global'.
 * @param verbose Enable debug logs on this instance.
 */
export function createLogger(
  verbose: boolean = false,
  scope: string = "global",
): Logger {
  let instance = loggersMap.get(scope);

  if (!instance) {
    instance = new Logger(verbose);
    loggersMap.set(scope, instance);
  } else {
    // Sync requested verbosity update
    instance.setVerbose(verbose);
  }

  return instance;
}
