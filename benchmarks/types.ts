// benchmarks/types.ts
export interface BenchmarkConfig {
  name: string;
  scenario: keyof typeof SCENARIOS.COMPLEXITY;
  fileCount: number;
  totalRules: number;
  features: string[]; // 'variants', 'theming', 'keyframes', etc.
  iterations: number; // for statistical significance
  warmupIterations: number;
}

export interface BenchmarkResult {
  compiler: string; // 'chaincss' | 'stylex' | 'vanilla-extract'
  scenario: string;
  metrics: {
    // Build performance
    compileTime: TimeStats;      // ms
    coldBuildTime: TimeStats;    // ms (no cache)
    incrementalBuildTime: TimeStats; // ms (changed 1 file)
    
    // Memory
    peakMemoryBytes: number[];
    avgMemoryBytes: number;
    memoryGrowthRate: number;    // bytes per component
    
    // Output
    cssSize: number;             // bytes (minified)
    cssSizeGzip: number;         // bytes (gzipped)
    jsSize: number;              // bytes (runtime + extracted styles)
    
    // Pipeline-specific
    passTimings: Record<string, TimeStats>; // time per compiler pass
    featuresDetected: string[];
    passesSkipped: number;
    cacheHitRate: number;
  };
  
  timestamp: number;
  systemInfo: SystemInfo;
}

export interface TimeStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}