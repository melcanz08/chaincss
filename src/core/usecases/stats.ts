// src/core/usecases/stats.ts 

export interface AggregatedStats {
  totalStyles: number
  atomicStyles: number
  deadRulesEliminated: number
  pipelinePasses: number
  filesProcessed: number
  totalDuration: number // ms
  averageCompressionSavings: number // simple avg %
  weightedCompressionSavings?: number // avg weighted by totalStyles
}

export interface CurrentStats {
  totalStyles: number
  atomicStyles: number
  uniqueProperties?: number
  savings: string
  deadRulesEliminated: number
  pipelinePasses: number
  compressionSavings?: string // e.g. "45%"
  totalDuration?: number // ms
}

function emptyStats(): AggregatedStats {
  return {
    totalStyles: 0,
    atomicStyles: 0,
    deadRulesEliminated: 0,
    pipelinePasses: 0,
    filesProcessed: 0,
    totalDuration: 0,
    averageCompressionSavings: 0,
    weightedCompressionSavings: 0,
  }
}

function parsePercent(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/([\d.]+)/)
  if (!m) return null
  const n = parseFloat(m[1])
  return Number.isFinite(n) ? n : null
}

export class StatsTracker {
  private stats: AggregatedStats = emptyStats()

  // O(1) avg tracking — no array growth for 1000 components / watch mode
  private compSum = 0
  private compCount = 0
  private weightedSum = 0
  private weightedTotal = 0

  reset() {
    this.stats = emptyStats()
    this.compSum = 0
    this.compCount = 0
    this.weightedSum = 0
    this.weightedTotal = 0
  }

  record(current: CurrentStats) {
    const s = this.stats
    s.totalStyles += current.totalStyles ?? 0
    s.atomicStyles += current.atomicStyles ?? 0
    s.deadRulesEliminated += current.deadRulesEliminated ?? 0
    s.pipelinePasses = Math.max(s.pipelinePasses, current.pipelinePasses ?? 0)

    if (current.totalDuration != null) {
      s.totalDuration += current.totalDuration
    }

    const pct = parsePercent(current.compressionSavings)
    if (pct !== null) {
      this.compSum += pct
      this.compCount++
      s.averageCompressionSavings = Math.round(this.compSum / this.compCount)

      const weight = current.totalStyles > 0 ? current.totalStyles : 1
      this.weightedSum += pct * weight
      this.weightedTotal += weight
      s.weightedCompressionSavings = Math.round(this.weightedSum / this.weightedTotal)
    }
  }

  recordFileProcessed() {
    this.stats.filesProcessed++
  }

  /** Legacy compat */
  recordAndReturn(current: CurrentStats): CurrentStats {
    this.record(current)
    return current
  }

  get(): AggregatedStats {
    return { ...this.stats }
  }

  getFormatted() {
    const s = this.stats
    return {
      totalStyles: s.totalStyles,
      atomicStyles: s.atomicStyles,
      uniqueProperties: 0, // reserved for AST prop tracking
      savings: s.deadRulesEliminated > 0 ? `${s.deadRulesEliminated} rules eliminated` : '0%',
      deadRulesEliminated: s.deadRulesEliminated,
      pipelinePasses: s.pipelinePasses,
      filesProcessed: s.filesProcessed,
      totalDuration: `${s.totalDuration.toFixed(2)}ms`,
      compressionSavings: `${s.averageCompressionSavings}%`,
      weightedCompressionSavings: `${s.weightedCompressionSavings ?? 0}%`,
    }
  }
}
