// src/compiler/diagnostics/reporter.ts
// Diagnostic reporting

export type DiagnosticSeverity = 'info' | 'warning' | 'error' | 'debug';

export interface Diagnostic {
  id: string;
  severity: DiagnosticSeverity;
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  suggestion?: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface DiagnosticReport {
  diagnostics: Diagnostic[];
  summary: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
    debug: number;
  };
  generatedAt: number;
  version: string;
}

export class DiagnosticReporter {
  private diagnostics: Diagnostic[] = [];
  private version: string = '2.14.5';

  report(diagnostic: Omit<Diagnostic, 'timestamp' | 'id'>): Diagnostic {
    const full: Diagnostic = {
      ...diagnostic,
      id: this.generateId(),
      timestamp: Date.now(),
    };
    this.diagnostics.push(full);
    return full;
  }

  error(message: string, options?: Partial<Omit<Diagnostic, 'id' | 'timestamp' | 'severity'>>): Diagnostic {
    return this.report({
      severity: 'error',
      message,
      ...options,
    });
  }

  warning(message: string, options?: Partial<Omit<Diagnostic, 'id' | 'timestamp' | 'severity'>>): Diagnostic {
    return this.report({
      severity: 'warning',
      message,
      ...options,
    });
  }

  info(message: string, options?: Partial<Omit<Diagnostic, 'id' | 'timestamp' | 'severity'>>): Diagnostic {
    return this.report({
      severity: 'info',
      message,
      ...options,
    });
  }

  debug(message: string, options?: Partial<Omit<Diagnostic, 'id' | 'timestamp' | 'severity'>>): Diagnostic {
    return this.report({
      severity: 'debug',
      message,
      ...options,
    });
  }

  getDiagnostics(): Diagnostic[] {
    return this.diagnostics;
  }

  getErrors(): Diagnostic[] {
    return this.diagnostics.filter(d => d.severity === 'error');
  }

  getWarnings(): Diagnostic[] {
    return this.diagnostics.filter(d => d.severity === 'warning');
  }

  clear(): void {
    this.diagnostics = [];
  }

  generateReport(): DiagnosticReport {
    const errors = this.getErrors();
    const warnings = this.getWarnings();
    const info = this.diagnostics.filter(d => d.severity === 'info');
    const debug = this.diagnostics.filter(d => d.severity === 'debug');

    return {
      diagnostics: this.diagnostics,
      summary: {
        total: this.diagnostics.length,
        errors: errors.length,
        warnings: warnings.length,
        info: info.length,
        debug: debug.length,
      },
      generatedAt: Date.now(),
      version: this.version,
    };
  }

  formatReport(): string {
    const report = this.generateReport();
    const lines = [
      '═══════════════════════════════════════════',
      ' ChainCSS Diagnostic Report',
      '═══════════════════════════════════════════',
      '',
      ` Generated: ${new Date(report.generatedAt).toISOString()}`,
      ` Version: ${report.version}`,
      '',
      ` Summary:`,
      `   Total: ${report.summary.total}`,
      `   Errors: ${report.summary.errors}`,
      `   Warnings: ${report.summary.warnings}`,
      `   Info: ${report.summary.info}`,
      `   Debug: ${report.summary.debug}`,
      '',
    ];

    if (report.diagnostics.length > 0) {
      lines.push(' ── Diagnostics ──');
      for (const d of report.diagnostics) {
        const severityColor = d.severity === 'error' ? '✗' : 
                             d.severity === 'warning' ? '⚠' : 
                             d.severity === 'info' ? 'ℹ' : '🔍';
        const location = d.file ? ` (${d.file}${d.line ? `:${d.line}` : ''})` : '';
        lines.push(` ${severityColor} [${d.severity.toUpperCase()}] ${d.message}${location}`);
        if (d.suggestion) {
          lines.push(`   💡 ${d.suggestion}`);
        }
      }
    }

    lines.push('', '═══════════════════════════════════════════');
    return lines.join('\n');
  }

  private generateId(): string {
    return `diag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
