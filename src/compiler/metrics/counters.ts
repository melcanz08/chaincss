// src/compiler/metrics/counters.ts
// Event counters for tracking compiler operations

export type CounterName =
  | 'files_processed'
  | 'rules_compiled'
  | 'atomic_classes_generated'
  | 'tokens_resolved'
  | 'cache_hits'
  | 'cache_misses'
  | 'optimizations_applied'
  | 'diagnostics_generated'
  | 'pipeline_passes_run'
  | 'errors_encountered'
  | 'warnings_issued';

export class Counter {
  private counts: Map<CounterName, number> = new Map();

  increment(name: CounterName, by: number = 1): void {
    const current = this.counts.get(name) || 0;
    this.counts.set(name, current + by);
  }

  get(name: CounterName): number {
    return this.counts.get(name) || 0;
  }

  reset(name?: CounterName): void {
    if (name) {
      this.counts.delete(name);
    } else {
      this.counts.clear();
    }
  }

  getAll(): Record<CounterName, number> {
    const result: Partial<Record<CounterName, number>> = {};
    for (const [key, value] of this.counts) {
      result[key] = value;
    }
    return result as Record<CounterName, number>;
  }

  snapshot(): Record<CounterName, number> {
    return { ...this.getAll() };
  }
}
