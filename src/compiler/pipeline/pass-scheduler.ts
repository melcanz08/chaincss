// src/compiler/pipeline/pass-scheduler.ts
// Declarative pass scheduling with requires/produces/invalidates

import type { CompilerPass, PassPhase } from "./pipeline-types.js";

export interface PassDeclaration {
  /** Unique pass identifier */
  name: string;
  /** Which pipeline stage this pass belongs to */
  phase: PassPhase;
  /** Passes that must run before this one */
  requires: string[];
  /** What this pass produces (for dependency resolution) */
  produces: string[];
  /** What this pass invalidates (forces re-run of dependents) */
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

/**
 * Schedule passes based on their declared requirements.
 * Uses topological sort to determine execution order.
 */
export function schedulePasses(passes: PassDeclaration[]): ScheduleResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const passMap = new Map(passes.map((p) => [p.name, p]));

  // Validate: check that all requirements exist
  const allProduces = new Set<string>();
  for (const pass of passes) {
    for (const prod of pass.produces) {
      allProduces.add(prod);
    }
  }

  for (const pass of passes) {
    for (const req of pass.requires) {
      if (!allProduces.has(req)) {
        errors.push(
          `Pass "${pass.name}" requires "${req}" but no pass produces it`,
        );
      }
    }
  }

  // Topological sort by dependencies
  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();

  for (const pass of passes) {
    inDegree.set(pass.name, pass.requires.length);
    for (const req of pass.requires) {
      if (!dependents.has(req)) dependents.set(req, []);
      dependents.get(req)!.push(pass.name);
    }
  }

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
      const phaseOrder: Record<PassPhase, number> = {
        normalize: 0,
        validate: 1,
        analyze: 2,
        optimize: 3,
        lower: 4,
        emit: 5,
      };
      return phaseOrder[pa.phase] - phaseOrder[pb.phase];
    });

    const name = queue.shift()!;
    const pass = passMap.get(name);
    if (pass) ordered.push(pass);

    const deps = dependents.get(name) || [];
    for (const dep of deps) {
      const newDegree = (inDegree.get(dep) || 0) - 1;
      inDegree.set(dep, newDegree);
      if (newDegree === 0) queue.push(dep);
    }
  }

  // Check for cycles
  if (ordered.length < passes.length) {
    const missing = passes
      .filter((p) => !ordered.includes(p))
      .map((p) => p.name);
    errors.push(
      `Cycle detected or unresolved dependencies: ${missing.join(", ")}`,
    );
  }

  // Group passes that can run in parallel
  const parallelGroups = groupParallel(ordered, passMap);

  // Warnings for unused produces
  const consumedProduces = new Set<string>();
  for (const pass of passes) {
    for (const req of pass.requires) {
      consumedProduces.add(req);
    }
  }
  for (const prod of allProduces) {
    if (!consumedProduces.has(prod)) {
      warnings.push(`"${prod}" is produced but never consumed by any pass`);
    }
  }

  return { ordered, parallelGroups, errors, warnings };
}

/**
 * Group passes into parallel execution groups.
 * Passes in the same group have no dependencies on each other.
 */
function groupParallel(
  ordered: PassDeclaration[],
  passMap: Map<string, PassDeclaration>,
): PassDeclaration[][] {
  const groups: PassDeclaration[][] = [];
  const completed = new Set<string>();

  for (const pass of ordered) {
    // Check if this pass conflicts with any pass in the current group
    let placed = false;
    for (const group of groups) {
      const conflicts = group.some(
        (gp) =>
          pass.requires.includes(gp.name) ||
          gp.requires.includes(pass.name) ||
          sharesResource(pass, gp),
      );
      if (!conflicts) {
        group.push(pass);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push([pass]);
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
 * Find the optimal pass order for a given set of features.
 * Skips passes whose requirements aren't met or whose produces are already satisfied.
 */
export function optimizePassOrder(
  passes: PassDeclaration[],
  availableFeatures: Set<string>,
  targetFeatures: Set<string>,
): PassDeclaration[] {
  const { ordered, errors } = schedulePasses(passes);
  if (errors.length > 0) return ordered; // Return as-is if there are errors

  // Start with available features
  const satisfied = new Set(availableFeatures);
  const needed = new Set(targetFeatures);
  const result: PassDeclaration[] = [];

  for (const pass of ordered) {
    // Skip if all requirements aren't met
    const reqsMet = pass.requires.every((r) => satisfied.has(r));
    if (!reqsMet) continue;

    // Skip if this pass produces nothing we need
    const producesNeeded = pass.produces.some(
      (p) => needed.has(p) || !consumedByOthers(p, ordered),
    );
    if (!producesNeeded && pass.produces.length > 0) continue;

    result.push(pass);

    // Mark produces as satisfied
    for (const prod of pass.produces) {
      satisfied.add(prod);
      needed.delete(prod);
    }
  }

  return result;
}

function consumedByOthers(produce: string, passes: PassDeclaration[]): boolean {
  return passes.some((p) => p.requires.includes(produce));
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
  const { errors, warnings } = schedulePasses(passes);

  // Check for duplicate names
  const names = new Set<string>();
  for (const pass of passes) {
    if (names.has(pass.name)) {
      errors.push(`Duplicate pass name: "${pass.name}"`);
    }
    names.add(pass.name);
  }

  return { valid: errors.length === 0, errors, warnings };
}
