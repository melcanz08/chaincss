// benchmarks/fixture-generator.ts
import { generateComponent } from './fixtures/component-generator';
import { generateStyles } from './fixtures/style-generator';

export class FixtureGenerator {
  generate(config: BenchmarkConfig): FixtureSet {
    const fixtures = {
      chaincss: this.generateChainCSS(config),
      stylex: this.generateStyleX(config),
      vanillaExtract: this.generateVanillaExtract(config),
    };
    
    return {
      config,
      fixtures,
      metadata: {
        totalRules: this.countTotalRules(fixtures),
        totalComponents: config.fileCount,
        complexityScore: this.calculateComplexity(config),
      }
    };
  }
  
  private generateChainCSS(config: BenchmarkConfig) {
    // Generate equivalent CSS across all compilers
    return Array.from({ length: config.fileCount }, (_, i) => ({
      path: `components/Component${i}.css`,
      content: this.generateChainCSSContent(i, config.scenario),
    }));
  }
  
  private generateChainCSSContent(index: number, complexity: string): string {
    const features = {
      variants: complexity !== 'simple',
      theming: complexity === 'complex' || complexity === 'extreme',
      keyframes: complexity === 'extreme',
      containerQueries: complexity === 'complex' || complexity === 'extreme',
    };
    
    // Generate realistic component styles
    return `
      @component Component${index} {
        /* Base styles */
        color: var(--text-primary);
        padding: var(--spacing-${(index % 4) + 1});
        
        ${features.variants ? this.generateVariants(index) : ''}
        ${features.theming ? this.generateThemeVariants(index) : ''}
        ${features.keyframes ? this.generateKeyframes(index) : ''}
        ${features.containerQueries ? this.generateContainerQueries(index) : ''}
        
        /* States */
        &:hover {
          opacity: 0.9;
        }
        &:focus-visible {
          outline: 2px solid var(--focus-ring);
        }
        
        /* Dark mode */
        @media (prefers-color-scheme: dark) {
          color: var(--text-primary-dark);
        }
      }
    `;
  }
}