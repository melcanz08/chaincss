// ============================================================================
// FILE: src/compiler/incremental/ir-updater.ts (FINAL)
// ============================================================================

import type { StyleIR, IRRule, IRNodeId } from "../pipeline/ir/types.js";

// ============================================================================
// Types
// ============================================================================

export interface IRUpdaterOptions {
  parseFile: (filePath: string, source: string) => Promise<StyleIR> | StyleIR;
  generateRuleId: (filePath: string, stableName: string) => IRNodeId;
}

export interface FlattenedRule {
  rule: IRRule;
  path: string[];
  stableName: string;
}

export interface RuleDiff {
  added: FlattenedRule[];
  removed: FlattenedRule[];
  changed: FlattenedRule[];
  unchanged: FlattenedRule[];
}

export interface FileUpdateResult {
  ir: StyleIR;
  addedRuleIds: IRNodeId[];
  removedRuleIds: IRNodeId[];
  changedRuleIds: IRNodeId[];
}

// ============================================================================
// Main Class
// ============================================================================

export class IRUpdater {
  private parseFile: (filePath: string, source: string) => Promise<StyleIR> | StyleIR;
  private generateRuleId: (filePath: string, stableName: string) => IRNodeId;
  private fileToRules: Map<string, Map<string, FlattenedRule>>;
  private ruleToFile: Map<IRNodeId, string>;
  private ruleCache: Map<IRNodeId, IRRule>;

  constructor(options: IRUpdaterOptions) {
    this.parseFile = options.parseFile;
    this.generateRuleId = options.generateRuleId;
    this.fileToRules = new Map();
    this.ruleToFile = new Map();
    this.ruleCache = new Map();
  }

  // ==========================================================================
  // Public API - Indexing
  // ==========================================================================

  indexIR(ir: StyleIR): void {
    this.fileToRules.clear();
    this.ruleToFile.clear();
    this.ruleCache.clear();

    for (const rule of ir.rules) {
      const filePath = rule.source?.file;
      if (filePath) {
        const flattened = this.flattenRules([rule]);
        for (const fr of flattened) {
          this.indexFlattenedRule(fr, filePath);
        }
      }
    }
  }

  getFlattenedRulesForFile(filePath: string): FlattenedRule[] {
    const ruleMap = this.fileToRules.get(filePath);
    if (!ruleMap) return [];
    return Array.from(ruleMap.values());
  }

  getRulesForFile(filePath: string): IRRule[] {
    const ruleMap = this.fileToRules.get(filePath);
    if (!ruleMap) return [];
    return Array.from(ruleMap.values()).map(fr => fr.rule);
  }

  getRuleIdsForFile(filePath: string): IRNodeId[] {
    const ruleMap = this.fileToRules.get(filePath);
    if (!ruleMap) return [];
    return Array.from(ruleMap.keys());
  }

  getFileForRule(ruleId: IRNodeId): string | undefined {
    return this.ruleToFile.get(ruleId);
  }

  getRuleById(ruleId: IRNodeId): IRRule | undefined {
    return this.ruleCache.get(ruleId);
  }

  getFileCount(): number {
    return this.fileToRules.size;
  }

  getRuleCount(): number {
    return this.ruleCache.size;
  }

  // ==========================================================================
  // Public API - File Operations
  // ==========================================================================

  async updateFile(
    currentIR: StyleIR,
    change: { filePath: string; source: string }
  ): Promise<FileUpdateResult> {
    const { filePath, source } = change;

    // 1. Parse the new file
    const newFileIR = await this.parseFile(filePath, source);

    // 2. Get old flattened rules
    const oldFlattened = this.getFlattenedRulesForFile(filePath);

    // 3. Flatten new rules (no mutation)
    const newFlattened = this.flattenRules(newFileIR.rules);

    // 4. Normalize IDs (creates new rule objects with stable IDs)
    const normalizedFlattened = this.normalizeStableIds(
      oldFlattened,
      newFlattened,
      filePath
    );

    // 5. Diff old and new
    const diff = this.diffFlattenedRules(oldFlattened, normalizedFlattened);

    // 6. Apply changes immutably (NO graph rebuild here)
    const updatedIR = this.applyDiff(currentIR, diff);

    // 7. Re-index
    this.indexIR(updatedIR);

    return {
      ir: updatedIR,
      addedRuleIds: diff.added.map(fr => fr.rule.id),
      removedRuleIds: diff.removed.map(fr => fr.rule.id),
      changedRuleIds: diff.changed.map(fr => fr.rule.id),
    };
  }

  removeFile(currentIR: StyleIR, filePath: string): FileUpdateResult {
    const flattenedRules = this.getFlattenedRulesForFile(filePath);
    const removedIds = new Set(flattenedRules.map(fr => fr.rule.id));

    const updatedIR = this.deepCloneIR(currentIR);
    updatedIR.rules = this.removeRulesRecursive(updatedIR.rules, removedIds);
    this.indexIR(updatedIR);

    return {
      ir: updatedIR,
      addedRuleIds: [],
      removedRuleIds: Array.from(removedIds),
      changedRuleIds: [],
    };
  }

  async addFile(
    currentIR: StyleIR,
    change: { filePath: string; source: string }
  ): Promise<FileUpdateResult> {
    const { filePath, source } = change;

    // 1. Parse
    const newFileIR = await this.parseFile(filePath, source);

    // 2. Flatten
    const newFlattened = this.flattenRules(newFileIR.rules);

    // 3. Assign new IDs
    const normalizedFlattened = this.assignNewIds(newFlattened, filePath);

    // 4. Extract top-level rules
    const newTopLevelRules = this.extractTopLevelRules(normalizedFlattened);

    // 5. Add to IR
    const updatedIR = this.deepCloneIR(currentIR);
    updatedIR.rules = [...updatedIR.rules, ...newTopLevelRules];
    this.indexIR(updatedIR);

    return {
      ir: updatedIR,
      addedRuleIds: normalizedFlattened.map(fr => fr.rule.id),
      removedRuleIds: [],
      changedRuleIds: [],
    };
  }

  // ==========================================================================
  // Private Methods - Flattening
  // ==========================================================================

  private flattenRules(rules: IRRule[]): FlattenedRule[] {
    const result: FlattenedRule[] = [];

    const flatten = (rule: IRRule, parentPath: string[]): void => {
      const stableName = this.deriveStableName(rule);
      const currentPath = [...parentPath, stableName];

      result.push({
        rule,
        path: currentPath,
        stableName,
      });

      if (rule.nestedRules && rule.nestedRules.length > 0) {
        for (const nested of rule.nestedRules) {
          flatten(nested, currentPath);
        }
      }
    };

    for (const rule of rules) {
      flatten(rule, []);
    }

    return result;
  }

  /**
   * Derive stable name from STRUCTURE only (not from mutable content).
   * Uses selector or positional identity within parent.
   */
  private deriveStableName(rule: IRRule): string {
    // Primary: use selector (this is stable across content changes)
    if (rule.selector && rule.selector !== "anonymous") {
      return rule.selector;
    }

    // Secondary: use a structural marker that doesn't depend on values
    // This should be provided by the parser/compiler if possible
    return "anonymous";
  }

  private normalizeStableIds(
    oldFlattened: FlattenedRule[],
    newFlattened: FlattenedRule[],
    filePath: string
  ): FlattenedRule[] {
    const oldByPath = new Map<string, FlattenedRule>();

    for (const fr of oldFlattened) {
      const pathKey = this.getPathKey(fr.path);
      oldByPath.set(pathKey, fr);
    }

    return newFlattened.map(fr => {
      const pathKey = this.getPathKey(fr.path);
      const oldRule = oldByPath.get(pathKey);

      if (oldRule) {
        // Same position - reuse ID
        return {
          ...fr,
          rule: {
            ...fr.rule,
            id: oldRule.rule.id,
          },
        };
      } else {
        // New rule - generate ID
        return {
          ...fr,
          rule: {
            ...fr.rule,
            id: this.generateRuleId(filePath, fr.stableName),
          },
        };
      }
    });
  }

  private assignNewIds(
    newFlattened: FlattenedRule[],
    filePath: string
  ): FlattenedRule[] {
    return newFlattened.map(fr => ({
      ...fr,
      rule: {
        ...fr.rule,
        id: this.generateRuleId(filePath, fr.stableName),
      },
    }));
  }

  private getPathKey(path: string[]): string {
    return path.join(" > ");
  }

  // ==========================================================================
  // Private Methods - Indexing
  // ==========================================================================

  private indexFlattenedRule(fr: FlattenedRule, filePath: string): void {
    this.ruleCache.set(fr.rule.id, fr.rule);

    if (!this.fileToRules.has(filePath)) {
      this.fileToRules.set(filePath, new Map());
    }
    this.fileToRules.get(filePath)!.set(fr.rule.id, fr);
    this.ruleToFile.set(fr.rule.id, filePath);
  }

  // ==========================================================================
  // Private Methods - Diffing
  // ==========================================================================

  private diffFlattenedRules(
    oldFlattened: FlattenedRule[],
    newFlattened: FlattenedRule[]
  ): RuleDiff {
    const oldById = new Map(oldFlattened.map(fr => [fr.rule.id, fr]));
    const newById = new Map(newFlattened.map(fr => [fr.rule.id, fr]));

    const added: FlattenedRule[] = [];
    const removed: FlattenedRule[] = [];
    const changed: FlattenedRule[] = [];
    const unchanged: FlattenedRule[] = [];

    for (const [id, oldFr] of oldById) {
      if (!newById.has(id)) {
        removed.push(oldFr);
      } else {
        const newFr = newById.get(id)!;
        if (this.rulesEqual(oldFr.rule, newFr.rule)) {
          unchanged.push(newFr);
        } else {
          changed.push(newFr);
        }
      }
    }

    for (const [id, newFr] of newById) {
      if (!oldById.has(id)) {
        added.push(newFr);
      }
    }

    return { added, removed, changed, unchanged };
  }

  private rulesEqual(a: IRRule, b: IRRule): boolean {
    // Compare declarations and selector (not metadata)
    const aDecls = JSON.stringify(a.declarations || []);
    const bDecls = JSON.stringify(b.declarations || []);
    const aSelector = a.selector || "";
    const bSelector = b.selector || "";
    
    return aDecls === bDecls && aSelector === bSelector;
  }

  // ==========================================================================
  // Private Methods - Immutable Updates
  // ==========================================================================

  private deepCloneIR(ir: StyleIR): StyleIR {
    return JSON.parse(JSON.stringify(ir));
  }

  /**
   * Apply diff to IR - removes changed/removed rules, adds new ones.
   * Does NOT rebuild graph (Layer 1 responsibility).
   */
  private applyDiff(ir: StyleIR, diff: RuleDiff): StyleIR {
    let result = this.deepCloneIR(ir);

    const removedIds = new Set(diff.removed.map(fr => fr.rule.id));
    const changedMap = new Map(diff.changed.map(fr => [fr.rule.id, fr.rule]));

    // Remove and update existing rules
    result.rules = this.updateRulesRecursive(result.rules, removedIds, changedMap);

    // Add new top-level rules
    for (const addedFr of diff.added) {
      if (addedFr.path.length <= 1) {
        result.rules.push(addedFr.rule);
      } else {
        // Nested addition - find parent by path
        this.insertNestedRuleByPath(result.rules, addedFr.path, addedFr.rule);
      }
    }

    return result;
  }

  /**
   * Insert a nested rule using full path information
   */
  private insertNestedRuleByPath(
    rules: IRRule[],
    path: string[],
    newRule: IRRule
  ): boolean {
    if (path.length === 0) return false;

    const targetStableName = path[0];
    const remainingPath = path.slice(1);

    for (const rule of rules) {
      const ruleStableName = this.deriveStableName(rule);

      if (ruleStableName === targetStableName) {
        if (remainingPath.length === 0) {
          // Found the parent - insert here
          if (!rule.nestedRules) {
            rule.nestedRules = [];
          }
          rule.nestedRules.push(newRule);
          return true;
        } else {
          // Continue searching in nested rules
          if (rule.nestedRules && rule.nestedRules.length > 0) {
            if (this.insertNestedRuleByPath(rule.nestedRules, remainingPath, newRule)) {
              return true;
            }
          }
        }
      }
    }

    return false;
  }

  /**
   * Extract top-level rules from flattened list
   */
  private extractTopLevelRules(flattened: FlattenedRule[]): IRRule[] {
    const topLevel = flattened
      .filter(fr => fr.path.length <= 1)
      .map(fr => fr.rule);

    // Build nested structure for non-top-level rules
    const nestedRules = flattened.filter(fr => fr.path.length > 1);
    
    for (const nestedFr of nestedRules) {
      this.insertNestedRuleByPath(topLevel, nestedFr.path.slice(1), nestedFr.rule);
    }

    return topLevel;
  }

  private updateRulesRecursive(
    rules: IRRule[],
    removedIds: Set<IRNodeId>,
    changedMap: Map<IRNodeId, IRRule>
  ): IRRule[] {
    const result: IRRule[] = [];

    for (const rule of rules) {
      if (removedIds.has(rule.id)) continue;

      if (changedMap.has(rule.id)) {
        const newRule = changedMap.get(rule.id)!;
        result.push({
          ...newRule,
          _dirty: true,
          meta: {
            ...newRule.meta,
            dependencies: [],
            dependents: [],
          },
        });
        continue;
      }

      if (rule.nestedRules && rule.nestedRules.length > 0) {
        rule.nestedRules = this.updateRulesRecursive(
          rule.nestedRules,
          removedIds,
          changedMap
        );
      }

      result.push(rule);
    }

    return result;
  }

  private removeRulesRecursive(
    rules: IRRule[],
    removedIds: Set<IRNodeId>
  ): IRRule[] {
    const result: IRRule[] = [];

    for (const rule of rules) {
      if (removedIds.has(rule.id)) continue;

      if (rule.nestedRules && rule.nestedRules.length > 0) {
        rule.nestedRules = this.removeRulesRecursive(rule.nestedRules, removedIds);
      }

      result.push(rule);
    }

    return result;
  }
}

export default IRUpdater;