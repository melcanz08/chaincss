// src/compiler/metrics/reporter.ts
// Automatically reports metrics during build/test

import { defaultMetrics } from './collector.js';

let metricsShown = false;

export function showMetrics(force: boolean = false): void {
  if (metricsShown && !force) return;
  metricsShown = true;

  const snapshot = defaultMetrics.snapshot();
  
  // Only show if there's actual data
  const hasData = Object.values(snapshot.counters).some(v => v > 0) || 
                  snapshot.timers.completed.length > 0;
  
  if (!hasData) return;

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              📊 ChainCSS Compiler Metrics                    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  
  // Counters
  const counterEntries = Object.entries(snapshot.counters).filter(([, v]) => v > 0);
  if (counterEntries.length > 0) {
    console.log('');
    console.log('  📈 Counters:');
    for (const [name, value] of counterEntries) {
      const label = name.replace(/_/g, ' ');
      console.log(`    ${label.padEnd(30)} ${String(value).padStart(6)}`);
    }
  }
  
  // Timers
  const timerEntries = snapshot.timers.completed;
  if (timerEntries.length > 0) {
    console.log('');
    console.log('  ⏱️  Timers:');
    for (const record of timerEntries) {
      const duration = record.duration?.toFixed(2) || '0.00';
      const label = record.name.replace(/_/g, ' ');
      console.log(`    ${label.padEnd(30)} ${duration.padStart(7)}ms`);
    }
  }
  
  // Summary
  console.log('');
  console.log('  📊 Summary:');
  console.log(`    Total Duration:  ${snapshot.timers.totalDuration.toFixed(2)}ms`);
  console.log(`    Pipeline Passes: ${snapshot.counters.pipeline_passes_run || 0}`);
  console.log(`    Rules Compiled:  ${snapshot.counters.rules_compiled || 0}`);
  
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║          ✨ Metrics collected during this run              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');
}

// Auto-show metrics on process exit
process.on('exit', () => {
  showMetrics();
});

// Also show on SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  showMetrics();
  process.exit();
});
