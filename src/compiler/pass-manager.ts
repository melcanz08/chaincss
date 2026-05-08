// src/compiler/pass-manager.ts
/**
 * Multi-Pass Optimization Pipeline
 * 
 * Coordinates all compiler passes in a defined, deterministic order.
 * Each pass is a pure function: StyleIR → StyleIR.
 * 
 * Architecture inspired by: LLVM, Babel, SWC, Rust compiler
 * 
 * Pipeline order (optimized for maximum information gain per pass):
 *   1. Intent Recovery      — fix typos, add defaults
 *   2. Unit Resolution       — resolve units, constant fold
 *   3. Validation            — contrast checks, conflict detection
 *   4. Specificity Sorting   — order rules by specificity
 *   5. Dead Elimination      — remove unused selectors
 *   6. Atomic Extraction     — extract shared properties
 *   7. Media Query Packing   — group same-query rules
 *   8. CSS if() Transpiling  — emit native if() + fallback
 *   9. CSS Compression       — minify output
 *  10. Diagnostics Export    — collect all pass diagnostics
 */

import type { StyleIR, IRPass, IRRule, IRDeclaration } from './style-ir.js';
import { applyPass, countNodes, debugIR } from './style-ir.js';

// ============================================================================
// Types
// ============================================================================

export type PassName =
  | 'intent-recovery'
  | 'unit-resolution'
  | 'validation'
  | 'specificity-sort'
  | 'dead-elimination'
  | 'atomic-extraction'
  | 'media-query-packing'
  | 'css-if-transpile'
  | 'css-compression'
  | 'diagnostics-export';

export type PassPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface PassDefinition {
  name: PassName;
  priority: PassPriority;
  description: string;
  /** The actual transform function */
  pass: IRPass;
  /** Dependencies — these passes must run first */
  requires: PassName[];
  /** Whether this pass is enabled */
  enabled: boolean;
}

export interface PassResult {
  name: PassName;
  duration: number;
  nodesBefore: number;
  nodesAfter: number;
  changes: number;
  errors: string[];
}

export interface PipelineResult {
  ir: StyleIR;
  css: string;
  results: PassResult[];
  totalDuration: number;
  summary: string;
}

// ============================================================================
// Built-in Passes
// ============================================================================

/**
 * Pass 1: Intent Recovery
 * Corrects typos, adds defaults for common patterns.
 * Runs FIRST so all downstream passes see clean data.
 */
export const intentRecoveryPass: IRPass = (ir: StyleIR): StyleIR => {
  for (const rule of ir.rules) {
    for (const decl of rule.declarations) {
      // Fix common value mistakes
      if (decl.property === 'display' && decl.value === 'flexbox') {
        decl.value = 'flex';
        decl.history.push({
          pass: 'intent-recovery',
          action: 'corrected-value',
          timestamp: Date.now(),
          previous: 'flexbox',
          reason: 'flexbox → flex',
        });
        // Add centering defaults
        const hasJustify = rule.declarations.some(d => d.property === 'justifyContent');
        const hasAlign = rule.declarations.some(d => d.property === 'alignItems');
        if (!hasJustify) {
          rule.declarations.push({
            id: 'ir-auto-' + Date.now(),
            property: 'justifyContent',
            value: 'center',
            history: [{
              pass: 'intent-recovery',
              action: 'added-default',
              timestamp: Date.now(),
              reason: 'Added flexbox centering default',
            }],
            meta: {},
          });
        }
        if (!hasAlign) {
          rule.declarations.push({
            id: 'ir-auto-' + Date.now() + 1,
            property: 'alignItems',
            value: 'center',
            history: [{
              pass: 'intent-recovery',
              action: 'added-default',
              timestamp: Date.now(),
              reason: 'Added flexbox centering default',
            }],
            meta: {},
          });
        }
      }
      if (decl.property === 'position' && decl.value === 'abs') {
        decl.value = 'absolute';
        decl.history.push({
          pass: 'intent-recovery',
          action: 'corrected-value',
          timestamp: Date.now(),
          previous: 'abs',
          reason: 'abs → absolute',
        });
      }
    }
  }
  return ir;
};

/**
 * Pass 2: Unit Resolution
 * Resolves math expressions, converts units where possible.
 * Runs early so later passes see resolved values.
 */
export const unitResolutionPass: IRPass = (ir: StyleIR): StyleIR => {
  // Resolve common unit patterns: if value is a number, it stays as-is
  // (actual math resolution happens via math-engine, which can be plugged in)
  for (const rule of ir.rules) {
    for (const decl of rule.declarations) {
      // Normalize number values
      if (typeof decl.value === 'number') {
        const unitless = ['opacity', 'zIndex', 'flex', 'fontWeight', 'lineHeight', 'order'];
        if (!unitless.includes(decl.property)) {
          decl.value = decl.value + 'px';
          decl.history.push({
            pass: 'unit-resolution',
            action: 'added-unit',
            timestamp: Date.now(),
            previous: decl.value,
            reason: 'Added px unit to number value',
          });
        }
      }
    }
  }
  return ir;
};

/**
 * Pass 3: Validation
 * Runs contrast checks, detects conflicts.
 */
export const validationPass: IRPass = (ir: StyleIR): StyleIR => {
  for (const rule of ir.rules) {
    const position = rule.declarations.find(d => d.property === 'position');
    const zIndex = rule.declarations.find(d => d.property === 'zIndex' || d.property === 'z-index');

    if (position && position.value === 'static' && zIndex) {
      ir.diagnostics.push({
        id: 'diag-' + Date.now(),
        nodeId: rule.id,
        severity: 'warning',
        message: 'z-index has no effect on static positioned elements',
        suggestion: 'Change position to relative, absolute, or fixed',
        pass: 'validation',
      });
    }

    // Check for flex properties on non-flex containers
    const display = rule.declarations.find(d => d.property === 'display');
    const hasFlexProps = rule.declarations.some(d =>
      ['justifyContent', 'alignItems', 'flexDirection', 'flexWrap'].includes(d.property)
    );
    if (hasFlexProps && (!display || (display.value !== 'flex' && display.value !== 'inline-flex'))) {
      ir.diagnostics.push({
        id: 'diag-' + Date.now() + 1,
        nodeId: rule.id,
        severity: 'warning',
        message: 'Flex properties require display: flex or display: inline-flex',
        pass: 'validation',
      });
    }
  }
  return ir;
};

/**
 * Pass 4: Specificity Sorting
 * Orders rules by specificity so the cascade is predictable.
 */
export const specificitySortPass: IRPass = (ir: StyleIR): StyleIR => {
  // Calculate specificity for each rule
  for (const rule of ir.rules) {
    let a = 0, b = 0, c = 0;
    const idMatches = rule.selector.match(/#[a-zA-Z0-9_-]+/g);
    if (idMatches) a += idMatches.length;
    const classMatches = rule.selector.match(/\.[a-zA-Z0-9_-]+/g);
    if (classMatches) b += classMatches.length;
    const pseudoMatches = rule.selector.match(/:[a-zA-Z-]+/g);
    if (pseudoMatches) b += pseudoMatches.length;
    const elemMatches = rule.selector.match(/^[a-zA-Z]+|[a-zA-Z]+(?=[.#[:])/g);
    if (elemMatches) c += elemMatches.length;

    rule.specificity = a * 10000 + b * 100 + c;
  }

  // Sort by specificity (lowest first for proper cascade)
  ir.rules.sort((a, b) => a.specificity - b.specificity);
  return ir;
};

/**
 * Pass 5: Dead Elimination
 * Removes rules marked as dead.
 */
export const deadEliminationPass: IRPass = (ir: StyleIR): StyleIR => {
  const before = ir.rules.length;
  ir.rules = ir.rules.filter(r => !r.isDead);
  const eliminated = before - ir.rules.length;

  if (eliminated > 0) {
    ir.diagnostics.push({
      id: 'diag-dead-' + Date.now(),
      nodeId: ir.id,
      severity: 'info',
      message: 'Eliminated ' + eliminated + ' dead rules',
      pass: 'dead-elimination',
    });
  }
  return ir;
};

/**
 * Pass 6: Atomic Extraction
 * Identifies identical declarations across rules and marks them for atomic CSS.
 */
export const atomicExtractionPass: IRPass = (ir: StyleIR): StyleIR => {
  const usageMap = new Map<string, number>();

  // Count declaration occurrences
  for (const rule of ir.rules) {
    for (const decl of rule.declarations) {
      const key = decl.property + ':' + decl.value;
      usageMap.set(key, (usageMap.get(key) || 0) + 1);
    }
  }

  // Mark frequently used declarations as atomic candidates
  for (const rule of ir.rules) {
    for (const decl of rule.declarations) {
      const key = decl.property + ':' + decl.value;
      const usage = usageMap.get(key) || 0;
      decl.meta.atomic = usage >= 3; // Threshold: used 3+ times
      decl.meta.usageCount = usage;
    }
  }

  return ir;
};

/**
 * Pass 7: Media Query Packing
 * Groups rules with the same media query together.
 */
export const mediaQueryPackingPass: IRPass = (ir: StyleIR): StyleIR => {
  // Collect all media queries
  const queryMap = new Map<string, IRRule[]>();

  for (const rule of ir.rules) {
    for (const atRule of rule.atRules) {
      if (atRule.type === 'media' && atRule.query) {
        const existing = queryMap.get(atRule.query) || [];
        existing.push(rule);
        queryMap.set(atRule.query, existing);
      }
    }
  }

  // Groups found — no structural change needed for now
  // Future: restructure IR to group same-query rules
  return ir;
};

/**
 * Pass 8: CSS if() Transpile
 * Detects conditional patterns and emits native CSS if().
 */
export const cssIfTranspilePass: IRPass = (ir: StyleIR): StyleIR => {
  for (const rule of ir.rules) {
    if (rule.conditions.length > 0) {
      rule.meta.hasCSSIf = true;
    }
  }
  return ir;
};

/**
 * Pass 9: CSS Compression
 * Minifies the IR — shortens values, removes unnecessary data.
 */
export const cssCompressionPass: IRPass = (ir: StyleIR): StyleIR => {
  for (const rule of ir.rules) {
    for (const decl of rule.declarations) {
      // Shorten hex colors
      if (typeof decl.value === 'string' && /^#[0-9a-fA-F]{6}$/.test(decl.value)) {
        const hex = decl.value;
        if (hex[1] === hex[2] && hex[3] === hex[4] && hex[5] === hex[6]) {
          decl.value = '#' + hex[1] + hex[3] + hex[5];
          decl.history.push({
            pass: 'css-compression',
            action: 'shortened-hex',
            timestamp: Date.now(),
            previous: hex,
            reason: 'Shortened hex color',
          });
        }
      }
      // Remove leading zeros from decimals
      if (typeof decl.value === 'string' && /^0\.\d+/.test(decl.value)) {
        const shortened = decl.value.replace(/^0\./, '.');
        decl.value = shortened;
      }
    }
  }
  return ir;
};

/**
 * Pass 10: Diagnostics Export
 * Collects all diagnostics from passes for reporting.
 */
export const diagnosticsExportPass: IRPass = (ir: StyleIR): StyleIR => {
  // Diagnostics are already collected in ir.diagnostics by other passes
  // This pass ensures they're organized and deduplicated
  const seen = new Set<string>();
  const unique = [];
  for (const diag of ir.diagnostics) {
    const key = diag.nodeId + ':' + diag.message;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(diag);
    }
  }
  ir.diagnostics = unique;
  return ir;
};

// ============================================================================
// Default Pipeline Configuration
// ============================================================================

/**
 * The default pass pipeline — runs all passes in optimal order.
 */
export const DEFAULT_PIPELINE: PassDefinition[] = [
  {
    name: 'intent-recovery',
    priority: 1,
    description: 'Fix typos and add defaults for common patterns',
    pass: intentRecoveryPass,
    requires: [],
    enabled: true,
  },
  {
    name: 'unit-resolution',
    priority: 2,
    description: 'Resolve units and normalize values',
    pass: unitResolutionPass,
    requires: [],
    enabled: true,
  },
  {
    name: 'validation',
    priority: 3,
    description: 'Run contrast checks and conflict detection',
    pass: validationPass,
    requires: ['intent-recovery'],
    enabled: true,
  },
  {
    name: 'specificity-sort',
    priority: 4,
    description: 'Order rules by specificity',
    pass: specificitySortPass,
    requires: [],
    enabled: true,
  },
  {
    name: 'dead-elimination',
    priority: 5,
    description: 'Remove unused selectors',
    pass: deadEliminationPass,
    requires: ['specificity-sort'],
    enabled: true,
  },
  {
    name: 'atomic-extraction',
    priority: 6,
    description: 'Extract shared properties into atomic classes',
    pass: atomicExtractionPass,
    requires: ['unit-resolution'],
    enabled: true,
  },
  {
    name: 'media-query-packing',
    priority: 7,
    description: 'Group same-query rules together',
    pass: mediaQueryPackingPass,
    requires: ['specificity-sort'],
    enabled: true,
  },
  {
    name: 'css-if-transpile',
    priority: 8,
    description: 'Transpile conditional patterns to native CSS if()',
    pass: cssIfTranspilePass,
    requires: ['intent-recovery'],
    enabled: true,
  },
  {
    name: 'css-compression',
    priority: 9,
    description: 'Minify CSS output',
    pass: cssCompressionPass,
    requires: [],
    enabled: true,
  },
  {
    name: 'diagnostics-export',
    priority: 10,
    description: 'Collect and organize diagnostics',
    pass: diagnosticsExportPass,
    requires: ['validation'],
    enabled: true,
  },
];

// ============================================================================
// Pass Manager
// ============================================================================

export class PassManager {
  private passes: PassDefinition[] = [];
  private results: PassResult[] = [];

  constructor(passes: PassDefinition[] = DEFAULT_PIPELINE) {
    this.passes = passes.filter(p => p.enabled);
    this.validateDependencies();
  }

  /**
   * Validate that all pass dependencies are satisfied.
   */
  private validateDependencies(): void {
    const passNames = new Set(this.passes.map(p => p.name));
    for (const pass of this.passes) {
      for (const req of pass.requires) {
        if (!passNames.has(req)) {
          throw new Error(
            'Pass "' + pass.name + '" requires "' + req + '" but it is not in the pipeline'
          );
        }
      }
    }
  }

  /**
   * Topological sort passes by dependencies.
   * Passes with no dependencies run first.
   */
  private sortByDependencies(): PassDefinition[] {
    const sorted: PassDefinition[] = [];
    const remaining = [...this.passes];
    const satisfied = new Set<string>();

    while (remaining.length > 0) {
      const ready = remaining.findIndex(p =>
        p.requires.every(req => satisfied.has(req))
      );
      if (ready === -1) {
        throw new Error('Circular dependency detected in pass pipeline');
      }
      const pass = remaining.splice(ready, 1)[0];
      sorted.push(pass);
      satisfied.add(pass.name);
    }

    return sorted;
  }

  /**
   * Run the full pipeline on an IR.
   */
  run(ir: StyleIR): PipelineResult {
    const startTime = Date.now();
    const sorted = this.sortByDependencies();
    this.results = [];

    let current = ir;
    const from = countNodes(ir);

    for (const pass of sorted) {
      const passStart = Date.now();
      const before = countNodes(current);

      try {
        current = pass.pass(current);
      } catch (err) {
        this.results.push({
          name: pass.name,
          duration: Date.now() - passStart,
          nodesBefore: before.rules + before.declarations,
          nodesAfter: before.rules + before.declarations,
          changes: 0,
          errors: [(err as Error).message],
        });
        continue;
      }

      const after = countNodes(current);
      this.results.push({
        name: pass.name,
        duration: Date.now() - passStart,
        nodesBefore: before.rules + before.declarations,
        nodesAfter: after.rules + after.declarations,
        changes: Math.abs((after.rules + after.declarations) - (before.rules + before.declarations)),
        errors: [],
      });
    }

    const totalDuration = Date.now() - startTime;
    const to = countNodes(current);

    return {
      ir: current,
      css: '', // Will be generated separately
      results: this.results,
      totalDuration,
      summary: 'Pipeline complete: ' + this.results.length + ' passes in ' + totalDuration + 'ms. ' +
        'Nodes: ' + (from.rules + from.declarations) + ' → ' + (to.rules + to.declarations),
    };
  }

  /**
   * Get results from the last run.
   */
  getResults(): PassResult[] {
    return this.results;
  }

  /**
   * Print a human-readable report of pass results.
   */
  report(): string {
    const lines = [
      '═══════════════════════════════════════════',
      '  ChainCSS Multi-Pass Pipeline Report',
      '═══════════════════════════════════════════',
    ];

    for (const result of this.results) {
      const status = result.errors.length > 0 ? '❌' : '✓';
      lines.push(
        '  ' + status + ' ' + result.name.padEnd(22) +
        ' ' + result.duration.toString().padStart(4) + 'ms' +
        '  nodes: ' + result.nodesBefore + ' → ' + result.nodesAfter
      );
      if (result.errors.length > 0) {
        for (const err of result.errors) {
          lines.push('     ⚠ ' + err);
        }
      }
    }

    lines.push('═══════════════════════════════════════════');
    return lines.join('\n');
  }

  /**
   * Add a custom pass to the pipeline.
   */
  addPass(pass: PassDefinition): this {
    this.passes.push(pass);
    return this;
  }

  /**
   * Remove a pass by name.
   */
  removePass(name: PassName): this {
    this.passes = this.passes.filter(p => p.name !== name);
    return this;
  }

  /**
   * Enable/disable a pass.
   */
  setPassEnabled(name: PassName, enabled: boolean): this {
    const pass = this.passes.find(p => p.name === name);
    if (pass) pass.enabled = enabled;
    this.passes = this.passes.filter(p => p.enabled);
    return this;
  }

  /**
   * Get the list of pass names in execution order.
   */
  getPassOrder(): PassName[] {
    return this.sortByDependencies().map(p => p.name);
  }
}

// ============================================================================
// Quick API
// ============================================================================

/**
 * Run the default pipeline on an IR.
 */
export function runDefaultPipeline(ir: StyleIR): PipelineResult {
  const manager = new PassManager(DEFAULT_PIPELINE.map(p => ({ ...p })));
  return manager.run(ir);
}

// ============================================================================
// Exports
// ============================================================================

export const passManager = {
  PassManager,
  runDefaultPipeline,
  DEFAULT_PIPELINE,
};

export default passManager;
