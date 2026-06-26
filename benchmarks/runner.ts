// benchmarks/runner.ts
import { execSync } from 'child_process';
import { performance } from 'perf_hooks';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { FixtureGenerator } from './fixture-generator';
import { BenchmarkConfig, BenchmarkResult, TimeStats } from './types';

export class BenchmarkRunner {
  private results: BenchmarkResult[] = [];
  private tempDir: string;
  
  constructor(
    private config: {
      outputDir: string;
      preserveFixtures: boolean;
      compareWith: ('stylex' | 'vanilla-extract')[];
    }
  ) {
    this.tempDir = resolve(process.cwd(), 'benchmarks/.fixtures');
  }
  
  async runSuite(scenarios: BenchmarkConfig[]) {
    console.log(`Running ${scenarios.length} benchmark scenarios...\n`);
    
    for (const scenario of scenarios) {
      console.log(`📊 ${scenario.name}...`);
      
      const generator = new FixtureGenerator();
      const fixtures = generator.generate(scenario);
      
      // Run each compiler
      const chaincssResult = await this.benchmarkChainCSS(scenario, fixtures);
      this.results.push(chaincssResult);
      
      for (const compiler of this.config.compareWith) {
        const result = await this.benchmarkCompiler(compiler, scenario, fixtures);
        this.results.push(result);
      }
      
      if (!this.config.preserveFixtures) {
        this.cleanup(scenario);
      }
    }
    
    return this.results;
  }
  
  private async benchmarkChainCSS(
    config: BenchmarkConfig, 
    fixtures: any
  ): Promise<BenchmarkResult> {
    const metrics = {
      compileTime: await this.measureCompileTime(() => {
        // Invoke ChainCSS compiler programmatically
        const { createCompiler } = require('../src/core/compiler');
        const compiler = createCompiler({
          pipeline: 'default',
          cache: config.iterations > 1, // Use cache for incremental tests
        });
        return compiler.compile(fixtures.chaincss);
      }, config),
      
      coldBuildTime: await this.measureColdBuild(config, fixtures),
      incrementalBuildTime: await this.measureIncrementalBuild(config, fixtures),
      
      peakMemoryBytes: await this.measureMemoryUsage(config, fixtures),
      avgMemoryBytes: await this.measureAverageMemory(config, fixtures),
      memoryGrowthRate: await this.calculateMemoryGrowth(config),
      
      cssSize: await this.measureOutputSize(config, fixtures, 'css'),
      cssSizeGzip: await this.measureGzipSize(config, fixtures, 'css'),
      jsSize: await this.measureOutputSize(config, fixtures, 'js'),
      
      passTimings: await this.measurePassTimings(config, fixtures),
      featuresDetected: await this.detectFeatures(fixtures),
      passesSkipped: await this.countSkippedPasses(config, fixtures),
      cacheHitRate: await this.measureCacheHitRate(config, fixtures),
    };
    
    return {
      compiler: 'chaincss',
      scenario: config.name,
      metrics,
      timestamp: Date.now(),
      systemInfo: this.getSystemInfo(),
    };
  }
  
  private async measureCompileTime(
    compile: () => Promise<any>, 
    config: BenchmarkConfig
  ): Promise<TimeStats> {
    const times: number[] = [];
    
    // Warmup
    for (let i = 0; i < config.warmupIterations; i++) {
      await compile();
    }
    
    // Actual measurements
    for (let i = 0; i < config.iterations; i++) {
      const start = performance.now();
      await compile();
      const end = performance.now();
      times.push(end - start);
    }
    
    return this.calculateStats(times);
  }
  
  private async measureMemoryUsage(config: BenchmarkConfig, fixtures: any) {
    const measurements: number[] = [];
    
    for (let i = 0; i < config.iterations; i++) {
      // Force GC if available
      if (global.gc) global.gc();
      
      const baseline = process.memoryUsage().heapUsed;
      
      // Run compilation
      await this.compileFixtures(fixtures);
      
      const peak = process.memoryUsage().heapUsed;
      measurements.push(peak - baseline);
    }
    
    return measurements;
  }
  
  private async measurePassTimings(config: BenchmarkConfig, fixtures: any) {
    // Hook into pipeline to measure each pass
    // This requires ChainCSS to expose timing info
    const passTimings: Record<string, number[]> = {};
    
    // Use the pipeline's timing capability if available
    // Or monkey-patch the passes to add timing
    const compiler = this.createInstrumentedCompiler();
    
    for (let i = 0; i < config.iterations; i++) {
      await compiler.compile(fixtures);
      
      const timings = compiler.getPassTimings();
      for (const [pass, time] of Object.entries(timings)) {
        if (!passTimings[pass]) passTimings[pass] = [];
        passTimings[pass].push(time as number);
      }
    }
    
    // Convert to stats
    const stats: Record<string, TimeStats> = {};
    for (const [pass, times] of Object.entries(passTimings)) {
      stats[pass] = this.calculateStats(times);
    }
    
    return stats;
  }
  
  private calculateStats(times: number[]): TimeStats {
    const sorted = [...times].sort((a, b) => a - b);
    const mean = times.reduce((sum, t) => sum + t, 0) / times.length;
    const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: sorted[Math.floor(sorted.length / 2)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
      stdDev: Math.sqrt(variance),
    };
  }
  
  private getSystemInfo() {
    return {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCores: require('os').cpus().length,
      memoryGB: Math.round(require('os').totalmem() / 1024 / 1024 / 1024),
    };
  }
}