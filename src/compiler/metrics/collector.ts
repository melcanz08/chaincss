// src/compiler/metrics/collector.ts
// Unified metrics collector

import { Counter, type CounterName } from "./counters.js";
import { Timer, type TimerName, type TimerRecord } from "./timers.js";

export interface MetricsSnapshot {
  counters: Record<CounterName, number>;
  timers: {
    completed: TimerRecord[];
    running: TimerRecord[];
    totalDuration: number;
  };
  timestamp: number;
  version: string;
}

export class MetricsCollector {
  private counter: Counter;
  private timer: Timer;
  private version: string = "2.14.5";
  private history: MetricsSnapshot[] = [];
  private maxHistory: number = 100;

  constructor() {
    this.counter = new Counter();
    this.timer = new Timer();
  }

  // Counter methods
  increment(name: CounterName, by: number = 1): void {
    this.counter.increment(name, by);
  }

  getCounter(name: CounterName): number {
    return this.counter.get(name);
  }

  // Timer methods
  start(name: TimerName, metadata?: Record<string, any>): void {
    this.timer.start(name, metadata);
  }

  stop(name: TimerName): TimerRecord | null {
    return this.timer.stop(name);
  }

  getTimerDuration(name: TimerName): number | null {
    return this.timer.getDuration(name);
  }

  // Snapshot
  snapshot(): MetricsSnapshot {
    return {
      counters: this.counter.snapshot(),
      timers: this.timer.snapshot(),
      timestamp: Date.now(),
      version: this.version,
    };
  }

  // History
  recordHistory(): void {
    const snapshot = this.snapshot();
    this.history.push(snapshot);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  getHistory(): MetricsSnapshot[] {
    return this.history;
  }

  // Reset
  reset(): void {
    this.counter.reset();
    this.timer.clear();
  }

  // Export report
  generateReport(): string {
    const snapshot = this.snapshot();
    const lines = [
      "═══════════════════════════════════════════",
      " ChainCSS Compiler Metrics Report",
      "═══════════════════════════════════════════",
      "",
      ` Version: ${snapshot.version}`,
      ` Timestamp: ${new Date(snapshot.timestamp).toISOString()}`,
      ` Total Duration: ${snapshot.timers.totalDuration.toFixed(2)}ms`,
      "",
      " ── Counters ──",
    ];

    for (const [name, value] of Object.entries(snapshot.counters)) {
      lines.push(`   ${name.padEnd(30)} ${String(value).padStart(6)}`);
    }

    lines.push("", " ── Timers ──");
    for (const record of snapshot.timers.completed) {
      const duration = record.duration?.toFixed(2) || "0.00";
      lines.push(`   ${record.name.padEnd(25)} ${duration.padStart(7)}ms`);
    }

    const running = snapshot.timers.running;
    if (running.length > 0) {
      lines.push("", " ⏳ Running Timers:");
      for (const record of running) {
        const elapsed = (performance.now() - record.startTime).toFixed(2);
        lines.push(
          `   ${record.name.padEnd(25)} ${elapsed.padStart(7)}ms (running)`,
        );
      }
    }

    lines.push("", "═══════════════════════════════════════════");
    return lines.join("\n");
  }
}

export const defaultMetrics = new MetricsCollector();
