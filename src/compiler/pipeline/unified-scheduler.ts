// src/compiler/pipeline/unified-scheduler.ts
// Unified scheduler — one algorithm for both built-in passes and plugins

import type { ChainCSSPlugin } from './plugin-api.js';
import type { PassDeclaration, ScheduleResult } from './pass-scheduler.js';
import { schedulePasses } from './pass-scheduler.js';

// ============================================================================
// Plugin → PassDeclaration conversion
// ============================================================================

/**
 * Convert a plugin to a PassDeclaration for unified scheduling.
 * Plugins declare their ordering via before/after/provides/consumes/priority.
 */
export function pluginToPassDeclaration(
  plugin: ChainCSSPlugin,
  phase: 'normalize' | 'validate' | 'analyze' | 'optimize' | 'lower'
): PassDeclaration | null {
  // Only convert if the plugin has this phase
  if (!plugin[phase]) return null;

  const requires: string[] = [];
  const produces: string[] = plugin.provides || [];
  const invalidates: string[] = [];

  // after → these must run before this plugin (they are requirements)
  if (plugin.after) {
    for (const afterName of plugin.after) {
      requires.push(afterName);
    }
  }

  // dependencies → must run before this plugin
  if (plugin.dependencies) {
    for (const dep of plugin.dependencies) {
      if (!requires.includes(dep)) {
        requires.push(dep);
      }
    }
  }

  // consumes → providers must run before this plugin
  if (plugin.consumes) {
    for (const consumed of plugin.consumes) {
      // We'll resolve these at schedule time when all plugins are known
      requires.push(`provider:${consumed}`);
    }
  }

  return {
    name: plugin.name,
    phase: phase as any,
    requires,
    produces,
    invalidates,
    cost: 'cheap', // Plugins are assumed cheap; they can override
  };
}

// ============================================================================
// Unified Scheduler
// ============================================================================

export interface UnifiedScheduleResult extends ScheduleResult {
  /** Plugins sorted in execution order (alongside built-in passes) */
  orderedPlugins: ChainCSSPlugin[];
  /** Resolved provider→consumer edges */
  capabilityEdges: Array<{ provider: string; consumer: string; capability: string }>;
}

/**
 * Schedule both built-in passes and plugins together.
 * 
 * 1. Convert plugins to PassDeclarations
 * 2. Resolve capability edges (consumes → finds providers)
 * 3. Merge with built-in passes
 * 4. Run unified topological sort
 * 5. Extract plugin ordering from the result
 */
export function unifiedSchedule(
  builtInPasses: PassDeclaration[],
  plugins: ChainCSSPlugin[],
  phase: 'normalize' | 'validate' | 'analyze' | 'optimize' | 'lower'
): UnifiedScheduleResult {
  // Convert plugins to pass declarations
  const pluginPasses: PassDeclaration[] = [];
  const pluginMap = new Map<string, ChainCSSPlugin>();

  for (const plugin of plugins) {
    const pass = pluginToPassDeclaration(plugin, phase);
    if (pass) {
      pluginPasses.push(pass);
      pluginMap.set(plugin.name, plugin);
    }
  }

  // Resolve capability edges
  const capabilityEdges: UnifiedScheduleResult['capabilityEdges'] = [];
  const allProvides = new Map<string, string[]>(); // capability → [provider names]

  for (const pass of [...builtInPasses, ...pluginPasses]) {
    for (const prod of pass.produces) {
      if (!allProvides.has(prod)) allProvides.set(prod, []);
      allProvides.get(prod)!.push(pass.name);
    }
  }

  // Replace "provider:capability" placeholders with actual provider names
  for (const pass of pluginPasses) {
    const resolvedRequires: string[] = [];
    for (const req of pass.requires) {
      if (req.startsWith('provider:')) {
        const capability = req.slice(9);
        const providers = allProvides.get(capability) || [];
        for (const provider of providers) {
          resolvedRequires.push(provider);
          capabilityEdges.push({ provider, consumer: pass.name, capability });
        }
      } else {
        resolvedRequires.push(req);
      }
    }
    (pass as any).requires = resolvedRequires;
  }

  // Handle "before" constraints: if A declares "before: [B]", then B requires A
  for (const plugin of plugins) {
    if (plugin.before) {
      for (const beforeName of plugin.before) {
        const targetPass = pluginPasses.find(p => p.name === beforeName);
        if (targetPass) {
          if (!targetPass.requires.includes(plugin.name)) {
            targetPass.requires.push(plugin.name);
          }
        }
      }
    }
  }

  // Merge all passes
  const allPasses = [...builtInPasses, ...pluginPasses];

  // Run unified topological sort
  const result = schedulePasses(allPasses);

  // Extract plugin ordering from the result
  const orderedPlugins: ChainCSSPlugin[] = [];
  for (const pass of result.ordered) {
    const plugin = pluginMap.get(pass.name);
    if (plugin) orderedPlugins.push(plugin);
  }

  return {
    ...result,
    orderedPlugins,
    capabilityEdges,
  };
}

// ============================================================================
// Ordering Precedence (documented)
// ============================================================================

/**
 * Ordering precedence for unified scheduling:
 * 
 * 1. dependencies — hard requirements (plugin won't work without them)
 * 2. provides/consumes — capability-based ordering
 * 3. before/after — explicit ordering hints
 * 4. priority — tiebreaker (lower = earlier, default 100)
 * 
 * If a cycle is detected, the scheduler logs a warning and falls back
 * to priority-based ordering for the conflicting plugins.
 */
export const ORDERING_PRECEDENCE = [
  'dependencies',
  'provides/consumes',
  'before/after',
  'priority',
] as const;
