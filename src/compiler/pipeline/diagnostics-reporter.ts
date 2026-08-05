// src/compiler/pipeline/diagnostics-reporter.ts
// Aggregates diagnostics, timing, and suggestions from pipeline runs

import type { StyleIR, IRDiagnostic, IRRule } from "./ir/types.js";
import type {
  PipelineStageResult,
  Diagnostic,
  Correction,
} from "./pipeline-types.js";

export interface DiagnosticsReport {
  /** Total compilation time in ms */
  totalDuration: number;

  /** Per-pass timing breakdown */
  passTimings: Array<{
    stage: string;
    pass: string;
    duration: number;
    changes?: number;
  }>;

  /** All diagnostics grouped by severity */
  diagnostics: {
    errors: number;
    warnings: number;
    info: number;
    hints: number;
    items: Array<{
      severity: string;
      category?: string;
      message: string;
      suggestion?: string;
      pass: string;
      autoFixable?: boolean;
    }>;
  };

  /** Corrections made by passes */
  corrections: Array<{
    pass: string;
    property?: string;
    original: unknown;
    corrected: unknown;
    reason: string;
  }>;

  /** IR statistics */
  irStats: {
    totalRules: number;
    deadRules: number;
    totalDeclarations: number;
    uniqueProperties: number;
    passesRun: number;
    filesProcessed: number;
  };

  /** Performance breakdown */
  performance: {
    slowestPass: string;
    slowestPassDuration: number;
    totalPasses: number;
    averagePassDuration: number;
  };
}

/** Helper to recursively collect all declarations from rules, pseudo-classes, and nested rules */
function collectAllDeclarations(rules: IRRule[]): Array<{ property: string; value: unknown }> {
  const decls: Array<{ property: string; value: unknown }> = [];
  
  function traverse(ruleList: IRRule[]) {
    for (const rule of ruleList) {
      if (rule.declarations) {
        for (const d of rule.declarations) decls.push(d);
      }
      if (rule.pseudoClasses) {
        for (const pc of rule.pseudoClasses) {
          if (pc.declarations) {
            for (const d of pc.declarations) decls.push(d);
          }
        }
      }
      if (rule.nestedRules && rule.nestedRules.length > 0) {
        traverse(rule.nestedRules);
      }
    }
  }

  traverse(rules);
  return decls;
}

export function generateDiagnosticsReport(
  timeline: PipelineStageResult[],
  ir: StyleIR,
  totalDuration: number,
): DiagnosticsReport {
  // Aggregate pass timings
  const passTimings = timeline.map((stage) => ({
    stage: stage.stage,
    pass: stage.pass,
    duration: stage.duration,
    changes: (stage.result as any)?.changes,
  }));

  // Map to prevent duplicate diagnostic recording
  const uniqueDiagnosticsMap = new Map<
    string,
    {
      severity: string;
      category?: string;
      message: string;
      suggestion?: string;
      pass: string;
      autoFixable?: boolean;
    }
  >();

  function addDiagnostic(
    d: {
      id?: string;
      severity: string;
      category?: string;
      message: string;
      suggestion?: string;
      pass?: string;
      autoFixable?: boolean;
    },
    defaultPass: string,
  ) {
    const passName = d.pass || defaultPass || "unknown";
    const key = d.id || `${passName}:${d.severity}:${d.message}:${d.suggestion || ""}`;

    if (!uniqueDiagnosticsMap.has(key)) {
      uniqueDiagnosticsMap.set(key, {
        severity: d.severity,
        category: d.category,
        message: d.message,
        suggestion: d.suggestion,
        pass: passName,
        autoFixable: d.autoFixable,
      });
    }
  }

  // 1. Collect from ValidationPass results
  for (const stage of timeline) {
    const result = stage.result as any;

    if (result?.diagnostics) {
      for (const d of result.diagnostics as Diagnostic[]) {
        addDiagnostic(d, stage.pass);
      }
    }

    if (result?.ir?.diagnostics) {
      for (const d of result.ir.diagnostics as IRDiagnostic[]) {
        addDiagnostic(d, stage.pass);
      }
    }
  }

  // 2. Collect from final IR (catches any added outside pass results)
  if (ir?.diagnostics) {
    for (const d of ir.diagnostics) {
      addDiagnostic(d, d.pass || "pipeline");
    }
  }

  const allDiagnostics = Array.from(uniqueDiagnosticsMap.values());

  const errors = allDiagnostics.filter((d) => d.severity === "error").length;
  const warnings = allDiagnostics.filter((d) => d.severity === "warning").length;
  const info = allDiagnostics.filter((d) => d.severity === "info").length;
  const hints = allDiagnostics.filter((d) => d.severity === "hint").length;

  // Collect corrections
  const corrections: DiagnosticsReport["corrections"] = [];
  for (const stage of timeline) {
    const result = stage.result as any;
    if (result?.corrections) {
      for (const c of result.corrections as Correction[]) {
        corrections.push({
          pass: stage.pass,
          property: c.property,
          original: c.original,
          corrected: c.corrected,
          reason: c.reason,
        });
      }
    }
  }

  // IR statistics (Null-safe)
  const allRules = ir?.rules ?? [];
  const deadRules = allRules.filter((r) => r.isDead).length;
  const allDecls = collectAllDeclarations(allRules);
  const uniqueProperties = new Set(allDecls.map((d) => d.property)).size;

  // Performance
  const sortedPasses = [...passTimings].sort((a, b) => b.duration - a.duration);
  const slowestPass = sortedPasses[0];
  const totalPassTime = passTimings.reduce((sum, p) => sum + p.duration, 0);

  return {
    totalDuration,
    passTimings,
    diagnostics: {
      errors,
      warnings,
      info,
      hints,
      items: allDiagnostics,
    },
    corrections,
    irStats: {
      totalRules: allRules.length,
      deadRules,
      totalDeclarations: allDecls.length,
      uniqueProperties,
      passesRun: timeline.length,
      filesProcessed: ir?.meta?.sourceFiles?.length ?? 0,
    },
    performance: {
      slowestPass: slowestPass?.pass || "unknown",
      slowestPassDuration: slowestPass?.duration || 0,
      totalPasses: timeline.length,
      averagePassDuration:
        timeline.length > 0
          ? Math.round((totalPassTime / timeline.length) * 100) / 100
          : 0,
    },
  };
}

/** Format a diagnostics report as a human-readable string */
export function formatDiagnosticsReport(report: DiagnosticsReport): string {
  const lines: string[] = [];

  lines.push("═".repeat(60));
  lines.push("  ChainCSS Pipeline Diagnostics Report");
  lines.push("═".repeat(60));
  lines.push("");
  lines.push(`  Total time: ${report.totalDuration.toFixed(2)}ms`);
  lines.push(`  Passes run: ${report.performance.totalPasses}`);
  lines.push(
    `  Slowest pass: ${report.performance.slowestPass} (${report.performance.slowestPassDuration.toFixed(2)}ms)`,
  );
  lines.push(
    `  Avg pass: ${report.performance.averagePassDuration.toFixed(2)}ms`,
  );
  lines.push("");
  lines.push("  IR Statistics:");
  lines.push(
    `    Rules: ${report.irStats.totalRules} (${report.irStats.deadRules} dead)`,
  );
  lines.push(`    Declarations: ${report.irStats.totalDeclarations}`);
  lines.push(`    Unique properties: ${report.irStats.uniqueProperties}`);
  lines.push(`    Files: ${report.irStats.filesProcessed}`);
  lines.push("");
  lines.push("  Diagnostics:");
  lines.push(`    Errors:   ${report.diagnostics.errors}`);
  lines.push(`    Warnings: ${report.diagnostics.warnings}`);
  lines.push(`    Info:     ${report.diagnostics.info}`);
  lines.push(`    Hints:    ${report.diagnostics.hints}`);
  lines.push("");

  if (report.diagnostics.items.length > 0) {
    lines.push("  Details:");
    for (const item of report.diagnostics.items) {
      const icon =
        item.severity === "error"
          ? "❌"
          : item.severity === "warning"
            ? "⚠️"
            : item.severity === "info"
              ? "ℹ️"
              : "💡";
      lines.push(`    ${icon} [${item.pass}] ${item.message}`);
      if (item.suggestion) lines.push(`       → ${item.suggestion}`);
    }
    lines.push("");
  }

  if (report.corrections.length > 0) {
    lines.push("  Auto-corrections:");
    for (const c of report.corrections) {
      lines.push(
        `    🔧 [${c.pass}] ${c.property || "?"}: ${c.original} → ${c.corrected}`,
      );
      lines.push(`       ${c.reason}`);
    }
    lines.push("");
  }

  lines.push("  Pass Timings:");
  const maxDuration = report.performance.slowestPassDuration || 1;
  const MAX_BAR_WIDTH = 20;

  for (const pt of report.passTimings) {
    const barLength = Math.round((pt.duration / maxDuration) * MAX_BAR_WIDTH);
    const bar = "█".repeat(Math.max(0, barLength));
    lines.push(
      `    ${pt.pass.padEnd(30)} ${pt.duration.toFixed(2).padStart(6)}ms ${bar}`,
    );
  }
  lines.push("");
  lines.push("═".repeat(60));

  return lines.join("\n");
}