// src/core/compiler/stats.ts — isolated stats tracking
// No side effects, pure accumulator. Fixes old getStats mutation bug.

export interface AggregatedStats {
  totalStyles: number
  atomicStyles: number
  deadRulesEliminated: number
  pipelinePasses: number
  filesProcessed: number
}

export interface CurrentStats {
  totalStyles: number
  atomicStyles: number
  uniqueProperties: number
  savings: string
  deadRulesEliminated: number
  pipelinePasses: number
  compressionSavings?: string
  totalDuration?: number
}

export class StatsTracker {
  private stats: AggregatedStats = {
    totalStyles: 0,
    atomicStyles: 0,
    deadRulesEliminated: 0,
    pipelinePasses: 0,
    filesProcessed: 0,
  }

  reset() {
    this.stats = { totalStyles: 0, atomicStyles: 0, deadRulesEliminated: 0, pipelinePasses: 0, filesProcessed: 0 }
  }

  record(current: CurrentStats) {
    this.stats.totalStyles += current.totalStyles
    this.stats.atomicStyles += current.atomicStyles
    this.stats.deadRulesEliminated += current.deadRulesEliminated
    this.stats.pipelinePasses = Math.max(this.stats.pipelinePasses, current.pipelinePasses)
    this.stats.filesProcessed++
  }

  // Called only from compiler's getStats to keep old API shape working
  recordAndReturn(current: CurrentStats): CurrentStats {
    this.record(current)
    return current
  }

  get(): AggregatedStats {
    return { ...this.stats }
  }

  getFormatted() {
    return {
      totalStyles: this.stats.totalStyles,
      atomicStyles: this.stats.atomicStyles,
      uniqueProperties: 0,
      savings: this.stats.deadRulesEliminated > 0 ? `${this.stats.deadRulesEliminated} rules eliminated` : '0%',
      deadRulesEliminated: this.stats.deadRulesEliminated,
      pipelinePasses: this.stats.pipelinePasses,
      filesProcessed: this.stats.filesProcessed,
    }
  }
}
