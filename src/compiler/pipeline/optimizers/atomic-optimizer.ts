// ============================================================================
// FILE: chaincss/src/compiler/pipeline/optimizers/atomic-optimizer.ts
// ============================================================================

/** 
 * @deprecated Use `atomic-extractor.ts` (pipeline-based) instead.
 * This standalone class will be removed in v3.0.
 * The pipeline-based version integrates with StyleIR, respects isDead flags,
 * and uses proper scope derivation through the 5-stage optimization pipeline.
 */

import type { AtomicClass } from '../../../core/types.js';
export type { AtomicClass };

// Types
export interface AtomicOptimizerStats {
  totalStyles: number;
  atomicStyles: number;
  standardStyles: number;
  uniqueProperties: number;
  savings: string;
  cacheHitRate?: number;
}

export interface AtomicOptimizerOptions {
  enabled?: boolean;
  threshold?: number;
  naming?: 'hash' | 'readable';
  cache?: boolean;
  cachePath?: string;
  minify?: boolean;
  mode?: 'standard' | 'atomic' | 'hybrid';
  outputStrategy?: 'component-first' | 'utility-first';
  alwaysAtomic?: string[];
  neverAtomic?: string[];
  frameworkOutput?: {
    react?: boolean;
    vue?: boolean;
    vanilla?: boolean;
  };
  preserveSelectors?: boolean;
  verbose?: boolean;
}

export interface ComponentClassMapEntry {
  atomicClasses: string[];
  hoverAtomicClasses: string[];
  selectors: string[];
  componentClassName?: string;
}

export interface OptimizeResult {
  css: string;
  map: Record<string, string>;
  stats: AtomicOptimizerStats;
  atomicCSS: string;
  componentCSS: string;
  componentMap?: Map<string, ComponentClassMapEntry>;
}

// Collision-safe FNV-1a hash generator for fast lookups
function hashKey(key: string): string {
  let hash = 2166136261;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return 'c' + hash.toString(36).slice(0, 5);
}

function kebab(s: string): string {
  return s.replace(/([A-Z])/g, '-$1').toLowerCase();
}

/** 
 * @deprecated Use `atomic-extractor.ts` (pipeline-based) instead.
 * This standalone class will be removed in v3.0.
 * The pipeline-based version integrates with StyleIR, respects isDead flags,
 * and uses proper scope derivation through the 5-stage optimization pipeline.
 */
export class AtomicOptimizer {
  private options: AtomicOptimizerOptions;
  public atomicMap: Record<string, string> = {};
  
  // High-performance operational registries
  private uniqueProps = new Set<string>();
  private globalUsageMap = new Map<string, { count: number; prop: string; val: string; pseudo: string; media: string }>();
  private componentRegistry = new Map<string, ComponentClassMapEntry>();
  
  private totalStylesProcessed = 0;
  private atomicStylesGenerated = 0;
  private originalByteSize = 0;
  private finalByteSize = 0;

  constructor(options: AtomicOptimizerOptions = {}) {
    this.options = {
      enabled: true,
      threshold: 2,
      naming: 'readable',
      mode: 'hybrid',
      outputStrategy: 'component-first',
      alwaysAtomic: [],
      neverAtomic: [],
      ...options
    };
  }

  /** @deprecated Use pipeline-based atomic-extractor */
  public optimize(styles: Record<string, any>): { map: Record<string, string>; css: string } {
    if (!this.options.enabled) {
      return { map: {}, css: '' };
    }

    this.reset();

    // 1. First Pass: Analyze property frequencies and register variants
    for (const [componentSelector, declarationBlock] of Object.entries(styles)) {
      this.analyzeStyles(componentSelector, declarationBlock);
    }

    // 2. Second Pass: Materialize rules and compute reference mappings
    let atomicCssOutput = '';
    let componentCssOutput = '';
    const outputMap: Record<string, string> = {};

    const threshold = this.options.threshold ?? 2;
    const neverAtomicSet = new Set(this.options.neverAtomic || []);
    const alwaysAtomicSet = new Set(this.options.alwaysAtomic || []);

    // Track atomic mappings generated during this execution cycle
    const activeAtomicSelectors = new Map<string, string>();

    for (const [componentSelector, declarationBlock] of Object.entries(styles)) {
      const atomicList: string[] = [];
      const hoverAtomicList: string[] = [];
      let structuralCssBuffer = '';

      const cleanSelector = componentSelector.trim();
      
      for (const [propKey, propVal] of Object.entries(declarationBlock)) {
        if (propVal === null || propVal === undefined) continue;

        const property = kebab(propKey);
        this.uniqueProps.add(property);
        this.totalStylesProcessed++;

        // Process plain values vs nested objects (pseudo-states/media-queries)
        if (typeof propVal === 'object' && !Array.isArray(propVal)) {
          const isMedia = propKey.startsWith('@media') || propKey.startsWith('@container');
          const isPseudo = propKey.startsWith(':') || propKey.startsWith('&');

          let nestedCss = '';
          for (const [subProp, subVal] of Object.entries(propVal)) {
            const subKebab = kebab(subProp);
            const valueStr = String(subVal);
            
            const scopeKey = `${propKey}::${subKebab}:${valueStr}`;
            const meta = this.globalUsageMap.get(scopeKey);
            const usageCount = meta ? meta.count : 1;

            const shouldBeAtomic = (alwaysAtomicSet.has(subKebab) || usageCount >= threshold) && !neverAtomicSet.has(subKebab);

            if (shouldBeAtomic && this.options.mode !== 'standard') {
              const className = this.getOrGenerateClassName(subKebab, valueStr, isPseudo ? propKey : 'root', isMedia ? propKey : 'all');
              activeAtomicSelectors.set(className, `${propKey} { .${className} { ${subKebab}: ${valueStr}; } }`);
              
              if (propKey === ':hover' || propKey === '&:hover') {
                hoverAtomicList.push(className);
              } else {
                atomicList.push(className);
              }
            } else {
              nestedCss += `  ${subKebab}: ${valueStr};\n`;
            }
          }

          if (nestedCss) {
            structuralCssBuffer += `${propKey} {\n${nestedCss}}\n`;
          }
        } else {
          // Standard declarations processing loop
          const valueStr = String(propVal);
          const scopeKey = `root::all::${property}:${valueStr}`;
          const meta = this.globalUsageMap.get(scopeKey);
          const usageCount = meta ? meta.count : 1;

          const shouldBeAtomic = (alwaysAtomicSet.has(property) || usageCount >= threshold) && !neverAtomicSet.has(property);

          if (shouldBeAtomic && this.options.mode !== 'standard') {
            const className = this.getOrGenerateClassName(property, valueStr, 'root', 'all');
            activeAtomicSelectors.set(className, `.${className} { ${property}: ${valueStr}; }`);
            atomicList.push(className);
          } else {
            structuralCssBuffer += `  ${property}: ${valueStr};\n`;
          }
        }
      }

      // Map references back to classes or update the dynamic component graph
      const componentClass = cleanSelector.replace(/^\./, '');
      if (this.options.mode === 'atomic') {
        outputMap[componentClass] = atomicList.join(' ');
      } else {
        // Hybrid mode ties them explicitly together
        outputMap[componentClass] = [componentClass, ...atomicList].join(' ');
        if (structuralCssBuffer) {
          componentCssOutput += `${cleanSelector} {\n${structuralCssBuffer}}\n`;
        }
      }

      this.componentRegistry.set(componentClass, {
        atomicClasses: atomicList,
        hoverAtomicClasses: hoverAtomicList,
        selectors: [cleanSelector],
        componentClassName: componentClass
      });
    }

    // Combine output buffers cleanly
    for (const atomicRules of activeAtomicSelectors.values()) {
      atomicCssOutput += atomicRules + '\n';
      this.atomicStylesGenerated++;
    }

    // Build metric diagnostics values
    this.originalByteSize = JSON.stringify(styles).length;
    const compositeCSS = (atomicCssOutput + componentCssOutput).trim();
    this.finalByteSize = compositeCSS.length;

    return {
      map: outputMap,
      css: compositeCSS
    };
  }

  private analyzeStyles(selector: string, block: any): void {
    if (typeof block !== 'object' || block === null) return;

    for (const [propKey, propVal] of Object.entries(block)) {
      if (propVal === null || propVal === undefined) continue;
      const property = kebab(propKey);

      if (typeof propVal === 'object' && !Array.isArray(propVal)) {
        const isMedia = propKey.startsWith('@media') || propKey.startsWith('@container');
        const isPseudo = propKey.startsWith(':') || propKey.startsWith('&');

        for (const [subProp, subVal] of Object.entries(propVal)) {
          const subKebab = kebab(subProp);
          const valStr = String(subVal);
          const scopeKey = `${propKey}::${subKebab}:${valStr}`;
          
          const existing = this.globalUsageMap.get(scopeKey);
          if (existing) {
            existing.count++;
          } else {
            this.globalUsageMap.set(scopeKey, {
              count: 1,
              prop: subKebab,
              val: valStr,
              pseudo: isPseudo ? propKey : 'root',
              media: isMedia ? propKey : 'all'
            });
          }
        }
      } else {
        const valStr = String(propVal);
        const scopeKey = `root::all::${property}:${valStr}`;
        
        const existing = this.globalUsageMap.get(scopeKey);
        if (existing) {
          existing.count++;
        } else {
          this.globalUsageMap.set(scopeKey, { count: 1, prop: property, val: valStr, pseudo: 'root', media: 'all' });
        }
      }
    }
  }

  private getOrGenerateClassName(prop: string, val: string, pseudo: string, media: string): string {
    const registryKey = `${pseudo}::${media}::${prop}:${val}`;
    if (this.atomicMap[registryKey]) return this.atomicMap[registryKey];

    let generatedToken = '';
    if (this.options.naming === 'hash') {
      generatedToken = hashKey(registryKey);
    } else {
      let cleanVal = val
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      generatedToken = `${prop.slice(0, 3)}-${cleanVal}`;
    }

    // Add variant signifiers to prevent token collisons across screen breakpoints
    if (pseudo !== 'root') {
      generatedToken = `${pseudo.replace(/[^a-zA-Z0-9]/g, '')}-${generatedToken}`;
    }
    if (media !== 'all') {
      generatedToken = `m-${hashKey(media)}-${generatedToken}`;
    }

    this.atomicMap[registryKey] = generatedToken;
    return generatedToken;
  }

  public reset(): void {
    this.atomicMap = {};
    this.uniqueProps.clear();
    this.globalUsageMap.clear();
    this.componentRegistry.clear();
    this.totalStylesProcessed = 0;
    this.atomicStylesGenerated = 0;
    this.originalByteSize = 0;
    this.finalByteSize = 0;
  }

  /** @deprecated Use pipeline-based atomic-extractor */
  public getStats(): AtomicOptimizerStats {
    const compressionRatio = this.originalByteSize > 0 
      ? ((1 - this.finalByteSize / this.originalByteSize) * 100).toFixed(1)
      : '0.0';

    return {
      totalStyles: this.totalStylesProcessed,
      atomicStyles: this.atomicStylesGenerated,
      standardStyles: Math.max(0, this.totalStylesProcessed - this.atomicStylesGenerated),
      uniqueProperties: this.uniqueProps.size,
      savings: `${compressionRatio}%`,
      cacheHitRate: 100
    };
  }

  /** @deprecated Use pipeline-based atomic-extractor */
  public getAtomicMap(): Record<string, string> {
    return this.atomicMap;
  }

  public getComponentMapEntry(id: string): ComponentClassMapEntry | null {
    const cleanId = id.replace(/^\./, '');
    return this.componentRegistry.get(cleanId) || null;
  }

  public getAllAtomicClasses(): string[] {
    return Object.values(this.atomicMap);
  }

  /** @deprecated Use pipeline-based atomic-extractor */
  public trackStyles(_styles: any[]): void {}
}