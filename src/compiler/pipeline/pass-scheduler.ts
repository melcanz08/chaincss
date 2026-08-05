// src/compiler/pipeline/pass-scheduler.ts
// Declarative pass scheduling with requires/produces/invalidates

import type { PassPhase } from "./pipeline-types.js";

export interface PassDeclaration {
  /** Unique pass identifier */
  name: string;
  /** Which pipeline stage this pass belongs to */
  phase: PassPhase;
  /** Passes or resources that must be available before this pass runs */
  requires: string[];
  /** What this pass produces (for dependency resolution) */
  produces: string[];
  /** What this pass invalidates (forces re-run or sequencing) */
  invalidates: string[];
  /** Estimated cost (used for parallel scheduling) */
  cost: "cheap" | "moderate" | "expensive";
}

export interface ScheduleResult {
  /** Passes in execution order */
  ordered: PassDeclaration[];
  /** Passes that can run in parallel (no shared dependencies) */
  parallelGroups: PassDeclaration[][];
  /** Validation errors */
  errors: string[];
  /** Warnings (e.g., unused produces) */
  warnings: string[];
}

const PHASE_ORDER: Record<PassPhase, number> = {
  normalize: 0,
  validate: 1,
  analyze: 2,
  optimize: 3,
  lower: 4,
  emit: 5,
};

const COST_ORDER: Record<"cheap" | "moderate" | "expensive", number> = {
  cheap: 0,
  moderate: 1,
  expensive: 2,
};

/**
 * Schedule passes based on their declared requirements.
 * Uses topological sort to determine execution order.
 */
export function schedulePasses(passes: PassDeclaration[]): ScheduleResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const passMap = new Map(passes.map((p) => [p.name, p]));

  // Map resources and pass names to the passes that produce/provide them
  const resourceProducers = new Map<string, string[]>();

  for (const pass of passes) {
    // A pass name produces itself (for direct pass-to-pass dependencies)
    if (!resourceProducers.has(pass.name)) {
      resourceProducers.set(pass.name, []);
    }
    resourceProducers.get(pass.name)!.push(pass.name);

    for (const prod of pass.produces) {
      if (!resourceProducers.has(prod)) {
        resourceProducers.set(prod, []);
      }
      resourceProducers.get(prod)!.push(pass.name);
    }
  }

  // Validate: check that all requirements can be satisfied
  for (const pass of passes) {
    for (const req of pass.requires) {
      if (!resourceProducers.has(req)) {
        errors.push(
          `Pass "${pass.name}" requires "${req}" but no pass produces it`,
        );
      }
    }
  }

  if (errors.length > 0) {
    return { ordered: [], parallelGroups: [], errors, warnings };
  }

  // Build dependency graph (Pass -> Pass)
  const passDependencies = new Map<string, Set<string>>();
  const passDependents = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();

  for (const pass of passes) {
    passDependencies.set(pass.name, new Set());
    passDependents.set(pass.name, new Set());
  }

  for (const pass of passes) {
    const deps = passDependencies.get(pass.name)!;

    // Prerequisite dependencies from 'requires'
    for (const req of pass.requires) {
      const producers = resourceProducers.get(req) || [];
      for (const producer of producers) {
        if (producer !== pass.name) {
          deps.add(producer);
        }
      }
    }

    // Invalidation sequencing: passes invalidating a resource must run before
    // passes that consume it
    for (const inv of pass.invalidates) {
      const consumers = passes.filter(
        (p) => p.name !== pass.name && p.requires.includes(inv),
      );
      for (const consumer of consumers) {
        passDependents.get(pass.name)!.add(consumer.name);
      }
    }
  }

  // Populate reverse dependent links and calculate initial in-degrees
  for (const [passName, deps] of passDependencies) {
    inDegree.set(passName, deps.size);
    for (const dep of deps) {
      passDependents.get(dep)!.add(passName);
    }
  }

  // Topological sort (Kahn's Algorithm)
  const queue: string[] = [];
  const ordered: PassDeclaration[] = [];

  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  while (queue.length > 0) {
    // Sort queue by phase priority, then by cost
    queue.sort((a, b) => {
      const pa = passMap.get(a)!;
      const pb = passMap.get(b)!;
      const phaseDiff = PHASE_ORDER[pa.phase] - PHASE_ORDER[pb.phase];
      if (phaseDiff !== 0) return phaseDiff;
      return COST_ORDER[pa.cost] - COST_ORDER[pb.cost];
    });

    const name = queue.shift()!;
    const pass = passMap.get(name);
    if (pass) ordered.push(pass);

    const dependents = passDependents.get(name) || new Set();
    for (const dep of dependents) {
      const currentDegree = inDegree.get(dep) || 0;
      const newDegree = currentDegree - 1;
      inDegree.set(dep, newDegree);
      if (newDegree === 0) {
        queue.push(dep);
      }
    }
  }

  // Check for cycles
  if (ordered.length < passes.length) {
    const missing = passes
      .filter((p) => !ordered.some((op) => op.name === p.name))
      .map((p) => p.name);
    errors.push(
      `Cycle detected or unresolved dependencies involving passes: ${missing.join(", ")}`,
    );
  }

  // Group passes that can run in parallel
  const parallelGroups = groupParallel(ordered, passDependencies);

  // Warnings for unused produces
  const consumedProduces = new Set<string>();
  for (const pass of passes) {
    for (const req of pass.requires) {
      consumedProduces.add(req);
    }
  }

  for (const [resource] of resourceProducers) {
    const isPassName = passes.some((p) => p.name === resource);
    if (!isPassName && !consumedProduces.has(resource)) {
      warnings.push(`"${resource}" is produced but never consumed by any pass`);
    }
  }

  return { ordered, parallelGroups, errors, warnings };
}

/**
 * Group passes into parallel execution groups.
 * Ensures no pass in a group depends on or conflicts with another in the same group.
 */
function groupParallel(
  ordered: PassDeclaration[],
  passDependencies: Map<string, Set<string>>,
): PassDeclaration[][] {
  const groups: PassDeclaration[][] = [];
  const passToGroupIndex = new Map<string, number>();

  for (const pass of ordered) {
    const deps = passDependencies.get(pass.name) || new Set();

    // Pass must be placed in a group AFTER all its dependencies
    let minGroupIndex = 0;
    for (const dep of deps) {
      if (passToGroupIndex.has(dep)) {
        minGroupIndex = Math.max(minGroupIndex, passToGroupIndex.get(dep)! + 1);
      }
    }

    let placed = false;
    for (let i = minGroupIndex; i < groups.length; i++) {
      const group = groups[i];
      const hasConflict = group.some((gp) => sharesResource(pass, gp));
      if (!hasConflict) {
        group.push(pass);
        passToGroupIndex.set(pass.name, i);
        placed = true;
        break;
      }
    }

    if (!placed) {
      groups.push([pass]);
      passToGroupIndex.set(pass.name, groups.length - 1);
    }
  }

  return groups;
}

/** Check if two passes share a resource (same produces or invalidates) */
function sharesResource(a: PassDeclaration, b: PassDeclaration): boolean {
  const aResources = new Set([...a.produces, ...a.invalidates]);
  const bResources = new Set([...b.produces, ...b.invalidates]);
  for (const r of aResources) {
    if (bResources.has(r)) return true;
  }
  return false;
}

/**
 * Find the optimal pass order for a given set of target features.
 * Performs backward dependency tracing to prune passes that do not contribute to target features.
 */
export function optimizePassOrder(
  passes: PassDeclaration[],
  availableFeatures: Set<string>,
  targetFeatures: Set<string>,
): PassDeclaration[] {
  const { ordered, errors } = schedulePasses(passes);
  if (errors.length > 0) return ordered;

  const neededResources = new Set<string>(targetFeatures);
  const neededPassNames = new Set<string>();

  // Backward sweep through topologically ordered passes
  for (let i = ordered.length - 1; i >= 0; i--) {
    const pass = ordered[i];

    const producesNeeded = pass.produces.some((p) => neededResources.has(p));
    const isRequiredByName = neededResources.has(pass.name);
    const isExplicitTarget = targetFeatures.has(pass.name);

    if (producesNeeded || isRequiredByName || isExplicitTarget) {
      neededPassNames.add(pass.name);

      // Add prerequisite requirements to needed resources (unless already available)
      for (const req of pass.requires) {
        if (!availableFeatures.has(req)) {
          neededResources.add(req);
        }
      }
    }
  }

  return ordered.filter((p) => neededPassNames.has(p.name));
}

/**
 * Validate a set of passes for correctness.
 * Checks: no missing requirements, no cycles, no duplicate names.
 */
export function validatePasses(passes: PassDeclaration[]): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];

  // Check for duplicate names
  const names = new Set<string>();
  for (const pass of passes) {
    if (names.has(pass.name)) {
      errors.push(`Duplicate pass name: "${pass.name}"`);
    }
    names.add(pass.name);
  }

  const scheduleRes = schedulePasses(passes);
  errors.push(...scheduleRes.errors);

  return { valid: errors.length === 0, errors, warnings: scheduleRes.warnings };
}