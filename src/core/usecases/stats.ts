// src/core/usecases/stats.ts

export interface AggregatedStats {
  totalStyles: number;
  atomicStyles: number;
  deadRulesEliminated: number;
  pipelinePasses: number;
  filesProcessed: number;
  /** CPU time (sum of all file durations — not wall time) */
  cpuDuration: number;
  /** Wall time since tracker creation (accurate with concurrency) */
  wallDuration: number;
  averageCompressionSavings: number;
  weightedCompressionSavings?: number;
}

export interface CurrentStats {
  totalStyles: number;
  atomicStyles: number;
  uniqueProperties?: number;
  savings: string;
  deadRulesEliminated: number;
  pipelinePasses: number;
  compressionSavings?: string;
  totalDuration?: number;
}

function emptyStats(): AggregatedStats {
  return {
    totalStyles: 0,
    atomicStyles: 0,
    deadRulesEliminated: 0,
    pipelinePasses: 0,
    filesProcessed: 0,
    cpuDuration: 0,
    wallDuration: 0,
    averageCompressionSavings: 0,
    weightedCompressionSavings: 0,
  };
}

function parsePercent(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.match(/([\d.]+)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

export class StatsTracker {
  private stats: AggregatedStats = emptyStats();

  // O(1) avg tracking — no array growth for 1000 components / watch mode
  private compSum = 0;
  private compCount = 0;
  private weightedSum = 0;
  private weightedTotal = 0;

  // Fix #1: Wall time tracking — separate from CPU time
  private wallStart: number;

  constructor() {
    this.wallStart =
      typeof performance !== "undefined"
        ? performance.now()
        : Date.now();
  }

  reset() {
    this.stats = emptyStats();
    this.compSum = 0;
    this.compCount = 0;
    this.weightedSum = 0;
    this.weightedTotal = 0;
    this.wallStart =
      typeof performance !== "undefined"
        ? performance.now()
        : Date.now();
  }

  record(current: CurrentStats) {
    const s = this.stats;
    s.totalStyles += current.totalStyles ?? 0;
    s.atomicStyles += current.atomicStyles ?? 0;
    s.deadRulesEliminated += current.deadRulesEliminated ?? 0;

    // Fix #2: Document — max is "max pipeline depth", not total passes
    s.pipelinePasses = Math.max(s.pipelinePasses, current.pipelinePasses ?? 0);

    if (current.totalDuration != null) {
      // Fix #1: CPU time — sum of per-file durations
      s.cpuDuration += current.totalDuration;
    }

    // Fix #1: Wall time — actual elapsed time
    s.wallDuration =
      typeof performance !== "undefined"
        ? performance.now() - this.wallStart
        : Date.now() - this.wallStart;

    const pct = parsePercent(current.compressionSavings);
    if (pct !== null) {
      this.compSum += pct;
      this.compCount++;
      // Fix #3: Keep float internally — round only on output
      s.averageCompressionSavings = this.compSum / this.compCount;

      const weight = current.totalStyles > 0 ? current.totalStyles : 1;
      this.weightedSum += pct * weight;
      this.weightedTotal += weight;
      s.weightedCompressionSavings = this.weightedSum / this.weightedTotal;
    }
  }

  recordFileProcessed() {
    this.stats.filesProcessed++;
  }

  /** Legacy compat */
  recordAndReturn(current: CurrentStats): CurrentStats {
    this.record(current);
    return current;
  }

  get(): AggregatedStats {
    return { ...this.stats };
  }

  getFormatted() {
    const s = this.stats;
    return {
      totalStyles: s.totalStyles,
      atomicStyles: s.atomicStyles,
      uniqueProperties: 0,
      savings:
        s.deadRulesEliminated > 0
          ? `${s.deadRulesEliminated} rules eliminated`
          : "0%",
      deadRulesEliminated: s.deadRulesEliminated,
      pipelinePasses: s.pipelinePasses,
      filesProcessed: s.filesProcessed,
      // Fix #1: Report both CPU and wall time
      cpuDuration: `${s.cpuDuration.toFixed(2)}ms`,
      wallDuration: `${s.wallDuration.toFixed(2)}ms`,
      // Fix #3: Round only on output
      compressionSavings: `${Math.round(s.averageCompressionSavings)}%`,
      weightedCompressionSavings: `${Math.round(s.weightedCompressionSavings ?? 0)}%`,
    };
  }
}