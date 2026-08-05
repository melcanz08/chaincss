// src/compiler/pipeline/unified-scheduler.ts
// Unified scheduler — one algorithm for both built-in passes and plugins

import type { ChainCSSPlugin } from "./plugin-api.js";
import type { PassDeclaration, ScheduleResult } from "./pass-scheduler.js";
import { schedulePasses } from "./pass-scheduler.js";

// ============================================================================
// Extended PassDeclaration with Priority
// ============================================================================

export interface ExtendedPassDeclaration extends PassDeclaration {
  /** Tiebreaker priority (lower numbers run earlier, default: 100) */
  priority?: number;
}

// ============================================================================
// Plugin → PassDeclaration conversion
// ============================================================================

/**
 * Convert a plugin to a PassDeclaration for unified scheduling.
 * Plugins declare their ordering via before/after/provides/consumes/priority.
 */
export function pluginToPassDeclaration(
  plugin: ChainCSSPlugin,
  phase: "normalize" | "validate" | "analyze" | "optimize" | "lower",
): ExtendedPassDeclaration | null {
  // Only convert if the plugin has a handler/hook for this phase
  if (!plugin[phase]) return null;

  const requires: string[] = [];
  const produces: string[] = plugin.provides ? [...plugin.provides] : [];
  const invalidates: string[] = [];

  // Helper to safely add unique requirements
  const addRequirement = (req: string) => {
    if (!requires.includes(req)) {
      requires.push(req);
    }
  };

  // after → these passes must run before this plugin
  if (plugin.after) {
    for (const afterName of plugin.after) {
      addRequirement(afterName);
    }
  }

  // dependencies → hard dependencies that must run before this plugin
  if (plugin.dependencies) {
    for (const dep of plugin.dependencies) {
      addRequirement(dep);
    }
  }

  // consumes → providers must run before this plugin
  if (plugin.consumes) {
    for (const consumed of plugin.consumes) {
      addRequirement(`provider:${consumed}`);
    }
  }

  return {
    name: plugin.name,
    phase,
    requires,
    produces,
    invalidates,
    cost: "cheap",
    priority: plugin.priority ?? 100,
  };
}

// ============================================================================
// Unified Scheduler
// ============================================================================

export interface UnifiedScheduleResult extends ScheduleResult {
  /** Plugins sorted in execution order (alongside built-in passes) */
  orderedPlugins: ChainCSSPlugin[];
  /** Resolved provider→consumer edges */
  capabilityEdges: Array<{
    provider: string;
    consumer: string;
    capability: string;
  }>;
}

/**
 * Schedule both built-in passes and plugins together for a specific phase.
 */
export function unifiedSchedule(
  builtInPasses: PassDeclaration[],
  plugins: ChainCSSPlugin[],
  phase: "normalize" | "validate" | "analyze" | "optimize" | "lower",
): UnifiedScheduleResult {
  // Deep clone built-in passes to prevent mutating shared definitions
  const clonedBuiltIns: ExtendedPassDeclaration[] = builtInPasses.map((p) => ({
    ...p,
    requires: [...p.requires],
    produces: [...p.produces],
    invalidates: [...(p.invalidates || [])],
  }));

  // Convert plugins active in this phase to pass declarations
  const pluginPasses: ExtendedPassDeclaration[] = [];
  const pluginMap = new Map<string, ChainCSSPlugin>();

  for (const plugin of plugins) {
    const pass = pluginToPassDeclaration(plugin, phase);
    if (pass) {
      // Name collision detection
      if (clonedBuiltIns.some((b) => b.name === pass.name)) {
        throw new Error(
          `Plugin name collision: "${pass.name}" conflicts with a built-in pass in phase "${phase}"`,
        );
      }
      pluginPasses.push(pass);
      pluginMap.set(plugin.name, plugin);
    }
  }

  // Unified lookup map for all passes in the current phase
  const currentPhasePassesMap = new Map<string, ExtendedPassDeclaration>();
  for (const pass of [...clonedBuiltIns, ...pluginPasses]) {
    currentPhasePassesMap.set(pass.name, pass);
  }

  // Resolve capability edges
  const capabilityEdges: UnifiedScheduleResult["capabilityEdges"] = [];
  const allProvides = new Map<string, string[]>(); // capability → provider pass names

  for (const pass of [...clonedBuiltIns, ...pluginPasses]) {
    for (const prod of pass.produces) {
      if (!allProvides.has(prod)) allProvides.set(prod, []);
      allProvides.get(prod)!.push(pass.name);
    }
  }

  // Replace "provider:capability" placeholders with actual provider names in this phase
  for (const pass of pluginPasses) {
    const resolvedRequires: string[] = [];
    for (const req of pass.requires) {
      if (req.startsWith("provider:")) {
        const capability = req.slice(9);
        const providers = allProvides.get(capability) || [];
        if (providers.length === 0) {
          // If capability isn't provided in this phase, retain constraint as missing requirement
          resolvedRequires.push(`missing-provider:${capability}`);
        } else {
          for (const provider of providers) {
            resolvedRequires.push(provider);
            capabilityEdges.push({ provider, consumer: pass.name, capability });
          }
        }
      } else {
        // Only enforce pass requirements if the pass exists in the current phase
        // (prevents cross-phase references from throwing false missing dependency errors)
        const isCurrentPhaseTarget = currentPhasePassesMap.has(req);
        const isCapability = allProvides.has(req);

        if (isCurrentPhaseTarget || isCapability) {
          resolvedRequires.push(req);
        }
      }
    }
    pass.requires = resolvedRequires;
  }

  // Handle "before" constraints: if A declares "before: [B]", B requires A
  for (const plugin of plugins) {
    if (plugin.before) {
      for (const beforeName of plugin.before) {
        const targetPass = currentPhasePassesMap.get(beforeName);
        if (targetPass) {
          if (!targetPass.requires.includes(plugin.name)) {
            targetPass.requires.push(plugin.name);
          }
        }
      }
    }
  }

  // Combine all active passes for this phase
  const allPasses = [...clonedBuiltIns, ...pluginPasses];

  // Run topological sort
  const result = schedulePasses(allPasses);

  // Extract plugin ordering from the result
  const orderedPlugins: ChainCSSPlugin[] = [];
  for (const pass of result.ordered) {
    const plugin = pluginMap.get(pass.name);
    if (plugin && !orderedPlugins.includes(plugin)) {
      orderedPlugins.push(plugin);
    }
  }

  return {
    ...result,
    orderedPlugins,
    capabilityEdges,
  };
}

// ============================================================================
// Ordering Precedence
// ============================================================================

/**
 * Ordering precedence for unified scheduling:
 *
 * 1. dependencies — hard requirements (plugin won't work without them)
 * 2. provides/consumes — capability-based ordering
 * 3. before/after — explicit ordering hints
 * 4. priority — tiebreaker (lower = earlier, default 100)
 */
export const ORDERING_PRECEDENCE = [
  "dependencies",
  "provides/consumes",
  "before/after",
  "priority",
] as const;