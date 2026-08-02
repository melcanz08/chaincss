// ============================================================================
// FILE: benchmarks/fixture-generator.ts
// Enhanced Fixture Generator & Concurrent Streamer for ChainCSS Revamped Architecture
// ============================================================================

import { Worker } from 'worker_threads';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { performance } from 'perf_hooks';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface BenchmarkConfig {
  fileCount: number;
  complexity: 'simple' | 'moderate' | 'complex' | 'extreme';
  enableTokenGraph: boolean;
  enableMacros: boolean;
}

export interface FixtureItem {
  path: string;
  content: string;
  dependencies?: string[];
}

export interface FixtureSet {
  config: BenchmarkConfig;
  fixtures: {
    chaincss: FixtureItem[];
    [key: string]: FixtureItem[];
  };
  metadata: {
    totalRules: number;
    totalComponents: number;
    complexityScore: number;
    tokenEntanglements: number;
  };
}

export class FixtureGenerator {
  generate(config: BenchmarkConfig): FixtureSet {
    const fixtures = {
      chaincss: this.generateChainCSS(config),
      stylex: this.generateStyleXPlaceholder(config),
      vanillaExtract: this.generateVanillaExtractPlaceholder(config),
    };

    return {
      config,
      fixtures,
      metadata: {
        totalRules: this.countTotalRules(fixtures.chaincss, config.complexity),
        totalComponents: config.fileCount,
        complexityScore: this.calculateComplexity(config),
        tokenEntanglements: config.enableTokenGraph ? config.fileCount * 3 : 0,
      },
    };
  }

  private generateChainCSS(config: BenchmarkConfig): FixtureItem[] {
    return Array.from({ length: config.fileCount }, (_, i) => {
      const componentName = `Component${i}`;
      const dependencies = config.enableTokenGraph && i > 0 
        ? [`Component${Math.max(0, i - 1)}`, `Component${Math.max(0, i - 2)}`] 
        : [];

      return {
        path: `components/${componentName}.css`,
        content: this.generateChainCSSContent(i, config.complexity, config.enableMacros, dependencies),
        dependencies,
      };
    });
  }

  private generateChainCSSContent(
    index: number, 
    complexity: string, 
    enableMacros: boolean, 
    dependencies: string[]
  ): string {
    const tokenGraphAnnotations = dependencies.length > 0
      ? `  /* @entangle: [${dependencies.join(', ')}] */\n`
      : '';

    if (complexity === 'simple') {
      return `
@component Component${index} {
${tokenGraphAnnotations}  color: var(--token-text-primary);
  padding: var(--token-space-md);
}
`;
    }

    if (complexity === 'moderate') {
      const macroBody = enableMacros ? `
  /* Macro shorthands */
  flex: row center between;
  gap: var(--token-space-sm);
  bg: var(--token-surface-card);
  rounded: var(--token-radius-md);` : `
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  background-color: var(--token-surface-card);
  border-radius: 6px;`;

      return `
@component Component${index} {
${tokenGraphAnnotations}  color: var(--token-text-primary);
  font: var(--token-font-body);
  padding: var(--token-space-lg);
${macroBody}

  &:hover {
    bg: var(--token-surface-hover);
    shadow: var(--token-shadow-sm);
  }
}
`;
    }

    // Complex / Extreme with 136+ macro simulation & token dependency graph
    const macroPasses = enableMacros ? `
  /* 136+ Macro Engine Shorthands */
  flex: col stretch start;
  size: 100% auto;
  padding: var(--token-space-xl) var(--token-space-2xl);
  bg: gradient(linear, var(--token-primary), var(--token-secondary));
  rounded: var(--token-radius-lg);
  shadow: var(--token-shadow-lg);
  transition: all 250ms ease-in-out;` : `
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
  width: 100%;
  height: auto;
  padding: 24px 32px;
  background: linear-gradient(var(--token-primary), var(--token-secondary));
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0,0,0,0.1);
  transition: all 250ms ease-in-out;`;

    const keyframesBlock = complexity === 'extreme' ? `
@keyframes pulse-glow-${index} {
  0% { opacity: 0.8; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.02); }
  100% { opacity: 0.8; transform: scale(1); }
}

.animated-${index} {
  animation: pulse-glow-${index} 3s infinite ease-in-out;
}` : '';

    return `
@component Component${index} {
${tokenGraphAnnotations}  /* Design Token Contract Binding */
  --local-accent: var(--token-brand-${index % 5});
  
  color: var(--token-text-main);
  font: var(--token-font-headline);
${macroPasses}

  @media (max-width: 768px) {
    padding: var(--token-space-md);
    flex: row center center;
  }
}
${keyframesBlock}
`;
  }

  private generateStyleXPlaceholder(config: BenchmarkConfig): FixtureItem[] {
    return Array.from({ length: config.fileCount }, (_, i) => ({
      path: `components/Component${i}.stylex.js`,
      content: `import stylex from '@stylexjs/stylex';\nexport const styles = stylex.create({ root: { color: 'var(--text)' } });`,
    }));
  }

  private generateVanillaExtractPlaceholder(config: BenchmarkConfig): FixtureItem[] {
    return Array.from({ length: config.fileCount }, (_, i) => ({
      path: `components/Component${i}.css.ts`,
      content: `import { style } from '@vanilla-extract/css';\nexport const root = style({ color: 'var(--text)' });`,
    }));
  }

  private countTotalRules(fixtures: FixtureItem[], complexity: string): number {
    const multiplier = complexity === 'simple' ? 2 : complexity === 'moderate' ? 8 : 25;
    return fixtures.length * multiplier;
  }

  private calculateComplexity(config: BenchmarkConfig): number {
    const scores = { simple: 1, moderate: 3, complex: 7, extreme: 15 };
    return config.fileCount * (scores[config.complexity] || 3);
  }
}

export class ConcurrentFixtureStreamer {
  public async generateAndStream(totalFiles: number, complexity: string, enableMacros: boolean): Promise<void> {
    const numWorkers = Math.max(1, os.cpus().length - 1); // Keep 1 core free for OS/runner
    const filesPerWorker = Math.ceil(totalFiles / numWorkers);
    const outputDir = path.join(__dirname, 'generated_fixtures');

    console.log(`🧵 Spawning ${numWorkers} worker threads to stream ${totalFiles} fixtures to disk...`);
    const startTime = performance.now();

    const workerPromises = Array.from({ length: numWorkers }, (_, workerId) => {
      return new Promise((resolve, reject) => {
        const startIndex = workerId * filesPerWorker;
        const count = Math.min(filesPerWorker, totalFiles - startIndex);

        if (count <= 0) {
          return resolve({ filesWritten: 0 });
        }

        const worker = new Worker(path.join(__dirname, 'fixture-worker.ts'), {
          workerData: {
            workerId,
            startIndex,
            count,
            outputDir,
            complexity,
            enableMacros,
          },
        });

        worker.on('message', (msg) => {
          if (msg.success) resolve(msg);
          else reject(new Error(msg.error));
        });

        worker.on('error', reject);
        worker.on('exit', (code) => {
          if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        });
      });
    });

    await Promise.all(workerPromises);
    const duration = performance.now() - startTime;
    console.log(`✅ Successfully streamed ${totalFiles} fixture files in ${duration.toFixed(2)}ms using worker pool.`);
  }
}