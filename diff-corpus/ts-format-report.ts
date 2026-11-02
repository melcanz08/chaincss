// ts-format-report.ts — TS oracle for the diagnostics parity harness.
//
// Mirror of ts-parseir.ts, ts-loadconfig.ts, ts-export-source.ts:
// a single-scenario driver that reads a JSON "scenario" file (list
// of diagnostics to report) and writes the rendered report to stdout.
//
// The scenario is a JSON object of the form:
//   {
//     "diagnostics": [
//       { "severity": "error", "message": "...", "file": "...", "line": 1,
//         "column": 1, "code": "E01", "suggestion": "...", "metadata": {...} }
//     ]
//   }
//
// Optional fields may be omitted (matching the TS `Diagnostic` interface).
//
// Timestamps and IDs are non-deterministic in the reporter. After
// generating the report, this script normalizes:
//   - all Diagnostic.id           → "diag-NORMALIZED"
//   - all Diagnostic.timestamp    → 0
//   - report.generatedAt          → 0
//   - the " Generated:" line      → " Generated: NORMALIZED"
// before writing to stdout. The ALGOL26 side does the same
// normalization before serializing its report, so the comparator
// can compare raw bytes.
//
// Output format: JSON.stringify(report, null, 2) plus the rendered
// formatReport() string wrapped in a marker so the comparator can
// find it. See run_diagnostics_parity.sh for the consumer.

import { readFileSync } from "node:fs";
import { DiagnosticReporter, type Diagnostic } from "../src/compiler/diagnostics/index.js";

interface ScenarioDiagnostic {
  severity: "info" | "warning" | "error" | "debug";
  message: string;
  file?: string;
  line?: number;
  column?: number;
  code?: string;
  suggestion?: string;
  metadata?: Record<string, unknown>;
}

interface Scenario {
  diagnostics: ScenarioDiagnostic[];
}

function main() {
  const scenarioPath = process.argv[2];
  if (!scenarioPath) {
    console.error("usage: ts-format-report.ts <scenario.json>");
    process.exit(1);
  }
  const raw = readFileSync(scenarioPath, "utf8");
  const scenario: Scenario = JSON.parse(raw);

  const reporter = new DiagnosticReporter();
  for (const d of scenario.diagnostics) {
    reporter.report({
      severity: d.severity,
      message: d.message,
      file: d.file,
      line: d.line,
      column: d.column,
      code: d.code,
      suggestion: d.suggestion,
      metadata: d.metadata,
    });
  }

  const report = reporter.generateReport();
  // Normalize non-deterministic fields in the report object. The ID
  // and timestamp fields are declared by the reporter itself, so the
  // normalization runs after generation. The `version` field is
  // deterministic ("2.14.5").
  for (const d of report.diagnostics) {
    (d as Diagnostic).id = "diag-NORMALIZED";
    (d as Diagnostic).timestamp = 0;
  }
  report.generatedAt = 0;

  // formatReport() calls generateReport() internally — it does NOT
  // read the local `report` we just modified. So the `Generated:`
  // line in the returned string carries a fresh Date.now(). The
  // ALGOL26 side emits a fixed epoch-zero string (G28). We normalize
  // the rendered output here so both sides match byte-for-byte.
  //
  // Regex targets the exact ISO 8601 shape: `YYYY-MM-DDTHH:MM:SS.mmmZ`
  // (24 chars), preceded by a single space and the "Generated:" label.
  const rendered = reporter.formatReport().replace(
    / Generated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/,
    " Generated: 1970-01-01T00:00:00.000Z"
  );

  const out = {
    report: report,
    rendered: rendered,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main();
