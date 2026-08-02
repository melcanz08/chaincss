// src/compiler/metrics/timers.ts
// Performance timers for measuring compilation stages

export type TimerName =
  | 'total_compile'
  | 'parse'
  | 'normalize'
  | 'validate'
  | 'analyze'
  | 'optimize'
  | 'lower'
  | 'emit'
  | 'cache_lookup'
  | 'cache_write'
  | 'graph_build'
  | 'symbol_table_build'
  | 'token_resolution'
  | 'accessibility_check'
  | 'atomic_extraction';

export interface TimerRecord {
  name: TimerName;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export class Timer {
  private timers: Map<string, TimerRecord> = new Map();
  private completed: TimerRecord[] = [];

  start(name: TimerName, metadata?: Record<string, any>): void {
    const key = this.getKey(name);
    const existing = this.timers.get(key);
    if (existing && !existing.endTime) {
      // Timer already running, stop it first
      this.stop(name);
    }
    this.timers.set(key, {
      name,
      startTime: performance.now(),
      metadata,
    });
  }

  stop(name: TimerName): TimerRecord | null {
    const key = this.getKey(name);
    const record = this.timers.get(key);
    if (!record || record.endTime) {
      return null;
    }
    const endTime = performance.now();
    record.endTime = endTime;
    record.duration = endTime - record.startTime;
    this.completed.push(record);
    this.timers.delete(key);
    return record;
  }

  getDuration(name: TimerName): number | null {
    const record = this.completed.find(r => r.name === name);
    return record?.duration || null;
  }

  getTotalDuration(): number {
    return this.completed.reduce((sum, r) => sum + (r.duration || 0), 0);
  }

  getAll(): TimerRecord[] {
    return [...this.completed];
  }

  getRunning(): TimerRecord[] {
    const running: TimerRecord[] = [];
    for (const [, record] of this.timers) {
      if (!record.endTime) {
        running.push(record);
      }
    }
    return running;
  }

  snapshot(): {
    completed: TimerRecord[];
    running: TimerRecord[];
    totalDuration: number;
  } {
    return {
      completed: this.getAll(),
      running: this.getRunning(),
      totalDuration: this.getTotalDuration(),
    };
  }

  clear(): void {
    this.timers.clear();
    this.completed = [];
  }

  private getKey(name: TimerName): string {
    return `${name}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  }
}
