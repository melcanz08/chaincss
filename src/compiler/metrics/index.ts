// src/compiler/metrics/index.ts
// Public API for metrics

export { Counter, type CounterName } from './counters.js';
export { Timer, type TimerName, type TimerRecord } from './timers.js';
export { MetricsCollector, defaultMetrics, type MetricsSnapshot } from './collector.js';
