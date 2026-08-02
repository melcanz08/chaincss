// ============================================================================
// FILE: src/compiler/pipeline/ir/graph-builder.ts
// Builds a dependency graph from the StyleIR
// ============================================================================

import type {
  StyleIR,
  IRRule,
  IRNodeId,
  IRGraph,
  IRGraphEdge,
  IRDeclaration,
  IRAtRule,
} from "./types.js";

// Helper to safely coerce arrays or record objects into arrays
function ensureArray<T>(item: T[] | Record<string, T> | undefined | null): T[] {
  if (!item) return [];
  if (Array.isArray(item)) return item;
  return Object.values(item);
}

// Safe helper to get a node whether graph.nodes is a Map or a plain object
function getNode(graph: IRGraph, id: IRNodeId): IRRule | undefined {
  if (!graph?.nodes) return undefined;
  return graph.nodes instanceof Map
    ? graph.nodes.get(id)
    : (graph.nodes as Record<string, IRRule>)[id];
}

// Safe helper to get all node entries [id, rule] regardless of storage type
function getNodeEntries(graph: IRGraph): Array<[IRNodeId, IRRule]> {
  if (!graph?.nodes) return [];
  if (graph.nodes instanceof Map) {
    return Array.from(graph.nodes.entries());
  }
  return Object.entries(graph.nodes as Record<string, IRRule>);
}

// Safe helper to get all rule values regardless of storage type
function getNodeValues(graph: IRGraph): IRRule[] {
  if (!graph?.nodes) return [];
  if (graph.nodes instanceof Map) {
    return Array.from(graph.nodes.values());
  }
  return Object.values(graph.nodes as Record<string, IRRule>);
}

// ============================================================================
// Main Graph Builder
// ============================================================================

export function buildIRGraph(ir: StyleIR): IRGraph {
  const nodes = new Map<IRNodeId, IRRule>();
  const edges: IRGraphEdge[] = [];

  // ==========================================================================
  // Phase 1: Collect all nodes
  // ==========================================================================
  const allNodes: IRRule[] = [];

  function collectRules(
    rulesInput: IRRule[] | Record<string, IRRule> | undefined | null,
    parentId?: IRNodeId,
    containerAtRule?: IRAtRule,
  ) {
    const rules = ensureArray(rulesInput);
    for (const rule of rules) {
      if (!rule || typeof rule !== "object") continue;
      if (rule.isDead) continue;
      allNodes.push(rule);
      nodes.set(rule.id, rule);

      // Parent relationship (extends)
      if (parentId) {
        edges.push({ from: parentId, to: rule.id, type: "extends" });
        rule.meta.dependencies = rule.meta.dependencies || [];
        if (!rule.meta.dependencies.includes(parentId)) {
          rule.meta.dependencies.push(parentId);
        }
        const parentNode = nodes.get(parentId);
        if (parentNode) {
          parentNode.meta.dependents = parentNode.meta.dependents || [];
          if (!parentNode.meta.dependents.includes(rule.id)) {
            parentNode.meta.dependents.push(rule.id);
          }
        }
      }

      // Media/container/supports/layer containment edges
      if (containerAtRule) {
        const containerId = `atrule-${containerAtRule.id}`;
        edges.push({
          from: containerId,
          to: rule.id,
          type: "contains",
          metadata: {
            atRuleType: containerAtRule.type,
            query: containerAtRule.query,
            name: containerAtRule.name,
          },
        });
      }

      // Nested rules
      const nestedRules = ensureArray(rule.nestedRules);
      if (nestedRules.length > 0) {
        collectRules(nestedRules, rule.id);
      }

      // At-rule nested rules → add containment edges
      const atRules = ensureArray(rule.atRules);
      if (atRules.length > 0) {
        for (const atRule of atRules || []) {
          if (!atRule || typeof atRule !== "object") continue;
          const atRuleId = `atrule-${atRule.id}`;
          const virtualRule: IRRule = {
            id: atRuleId,
            selector:
              `@${atRule.type} ${atRule.query || atRule.name || ""}`.trim(),
            declarations: ensureArray(atRule.declarations),
            pseudoClasses: [],
            atRules: [],
            nestedRules: ensureArray(atRule.nestedRules),
            conditions: [],
            meta: {
              dependencies: [rule.id],
              dependents: [],
            },
            isDead: false,
            specificity: 0,
            hash: "",
            source: atRule.source,
            history: [...(atRule.history || [])],
          };
          nodes.set(atRuleId, virtualRule);

          // Rule → at-rule containment edge
          edges.push({
            from: rule.id,
            to: atRuleId,
            type: "contains",
            metadata: {
              atRuleType: atRule.type,
              query: atRule.query,
              name: atRule.name,
            },
          });

          // Update dependency tracking
          rule.meta.dependents = rule.meta.dependents || [];
          if (!rule.meta.dependents.includes(atRuleId)) {
            rule.meta.dependents.push(atRuleId);
          }

          // Collect nested rules inside the at-rule
          const atNested = ensureArray(atRule.nestedRules);
          if (atNested.length > 0) {
            collectRules(atNested, rule.id, atRule);
          }

          // Keyframe frames → parent keyframes at-rule edge
          const keyframes = ensureArray(atRule.keyframes);
          if (atRule.type === "keyframes" && keyframes.length > 0) {
            for (const frame of keyframes) {
              if (!frame || typeof frame !== "object") continue;
              const frameId = frame.id;
              const frameRule: IRRule = {
                id: frameId,
                selector: frame.keyText,
                declarations: ensureArray(frame.declarations),
                pseudoClasses: [],
                atRules: [],
                nestedRules: [],
                conditions: [],
                meta: {
                  dependencies: [atRuleId],
                  dependents: [],
                },
                isDead: false,
                specificity: 0,
                hash: "",
                source: frame.source,
                history: [],
              };
              nodes.set(frameId, frameRule);

              edges.push({
                from: atRuleId,
                to: frameId,
                type: "contains",
                metadata: { atRuleType: "keyframes", frameKey: frame.keyText },
              });
            }
          }
        }
      }
    }
  }

  collectRules(ir.rules);

  // ==========================================================================
  // Phase 2: Build edges between nodes (Optimized via Inverted Indexing)
  // ==========================================================================
  const nodeArray = Array.from(nodes.values());

  // Pre-extract selector parts and token references once per node
  const nodeData = nodeArray.map((rule) => {
    const selectorParts = new Set(
      (rule.selector || "").split(/[\s>+~,]+/).filter(Boolean),
    );
    const tokenRefs = extractTokenReferences(rule);
    return { rule, selectorParts, tokenRefs };
  });

  // 1. Build Inverted Index for Selector Overlaps (with hot-spot filtering)
  const selectorIndex = new Map<string, IRRule[]>();
  for (const data of nodeData) {
    for (const part of data.selectorParts) {
      let list = selectorIndex.get(part);
      if (!list) {
        list = [];
        selectorIndex.set(part, list);
      }
      list.push(data.rule);
    }
  }

  const MAX_BUCKET_SIZE = 100; // Ignore overly generic selector parts / hot spots

  // Check overlap only across candidate nodes sharing at least one token part
  const checkedPairs = new Set<string>();
  for (const dataA of nodeData) {
    const candidates = new Set<IRRule>();
    for (const part of dataA.selectorParts) {
      const matches = selectorIndex.get(part);
      if (matches && matches.length <= MAX_BUCKET_SIZE) {
        for (const m of matches) {
          if (m.id !== dataA.rule.id) candidates.add(m);
        }
      }
    }

    for (const ruleB of candidates) {
      const pairKey =
        dataA.rule.id < ruleB.id
          ? `${dataA.rule.id}:${ruleB.id}`
          : `${ruleB.id}:${dataA.rule.id}`;
      if (checkedPairs.has(pairKey)) continue;
      checkedPairs.add(pairKey);

      if (selectorsOverlap(dataA.rule.selector, ruleB.selector)) {
        if (dataA.rule.specificity <= ruleB.specificity) {
          addEdge(edges, nodes, dataA.rule, ruleB, "overrides");
        }
        if (ruleB.specificity <= dataA.rule.specificity) {
          addEdge(edges, nodes, ruleB, dataA.rule, "overrides");
        }
      }
    }
  }

  // 2. Build Inverted Index for Token References (with hot-spot capping)
  const tokenIndex = new Map<string, IRRule[]>();
  for (const data of nodeData) {
    for (const token of data.tokenRefs) {
      let list = tokenIndex.get(token);
      if (!list) {
        list = [];
        tokenIndex.set(token, list);
      }
      list.push(data.rule);
    }
  }

  for (const [, rulesSharingToken] of tokenIndex) {
    if (rulesSharingToken.length < 2 || rulesSharingToken.length > 75) continue; // Skip global tokens referenced everywhere to prevent combinatorial blowup
    for (let i = 0; i < rulesSharingToken.length; i++) {
      for (let j = i + 1; j < rulesSharingToken.length; j++) {
        const ra = rulesSharingToken[i];
        const rb = rulesSharingToken[j];
        addEdge(edges, nodes, rb, ra, "references");
        addEdge(edges, nodes, ra, rb, "references");
      }
    }
  }

  // Phase 2b: Animation → keyframe edges
  for (let i = 0; i < nodeArray.length; i++) {
    const animNames = extractAnimationNames(nodeArray[i]);
    if (animNames.size > 0) {
      for (const other of nodeArray) {
        if (other.id === nodeArray[i].id) continue;
        if (other.id.startsWith("atrule-")) {
          const atRule = findAtRuleById(ir, other.id.replace("atrule-", ""));
          if (atRule && atRule.type === "keyframes" && atRule.name) {
            if (animNames.has(atRule.name)) {
              addEdge(edges, nodes, nodeArray[i], other, "animates");
            }
          }
        }
      }
    }
  }

  // Phase 2c: Token derivation edges
  detectTokenDerivationEdges(ir, edges, nodes);

  // ==========================================================================
  // Phase 3: Identify root and leaf nodes
  // ==========================================================================
  const rootNodes = nodeArray
    .filter((n) => !n.meta.dependencies || n.meta.dependencies.length === 0)
    .map((n) => n.id);

  const leafNodes = nodeArray
    .filter((n) => !n.meta.dependents || n.meta.dependents.length === 0)
    .map((n) => n.id);

  return { nodes, edges, rootNodes, leafNodes };
}

// ============================================================================
// Edge Helpers
// ============================================================================

function addEdge(
  edges: IRGraphEdge[],
  nodes: Map<IRNodeId, IRRule>,
  from: IRRule,
  to: IRRule,
  type: IRGraphEdge["type"],
  metadata?: Record<string, unknown>,
) {
  const exists = edges.some(
    (e) => e.from === from.id && e.to === to.id && e.type === type,
  );
  if (exists) return;

  edges.push({ from: from.id, to: to.id, type, metadata });

  from.meta.dependents = from.meta.dependents || [];
  if (!from.meta.dependents.includes(to.id)) {
    from.meta.dependents.push(to.id);
  }

  to.meta.dependencies = to.meta.dependencies || [];
  if (!to.meta.dependencies.includes(from.id)) {
    to.meta.dependencies.push(from.id);
  }
}

// ============================================================================
// Selector Overlap Detection
// ============================================================================

function selectorsOverlap(a: string, b: string): boolean {
  const partsA = (a || "").split(/[\s>+~,]+/).filter(Boolean);
  const partsB = (b || "").split(/[\s>+~,]+/).filter(Boolean);

  for (const pa of partsA) {
    for (const pb of partsB) {
      if (pa === pb) return true;
      if (pa.startsWith(".") && pb.startsWith(".") && pa === pb) return true;
    }
  }
  return false;
}

// ============================================================================
// Token Reference Detection
// ============================================================================

function extractTokenReferences(rule: IRRule): Set<string> {
  const tokens = new Set<string>();

  function scanDeclarations(
    declsInput:
      IRDeclaration[] | Record<string, IRDeclaration> | undefined | null,
  ) {
    const decls = ensureArray(declsInput);
    for (const decl of decls) {
      if (!decl) continue;
      const val = String(decl.value ?? "");
      const matches = val.matchAll(/\$([a-zA-Z0-9_.-]+)/g);
      for (const match of matches) {
        tokens.add(match[1]);
      }
    }
  }

  scanDeclarations(rule.declarations);
  for (const pc of ensureArray(rule.pseudoClasses)) {
    scanDeclarations(pc?.declarations);
  }
  for (const atRule of ensureArray(rule.atRules)) {
    scanDeclarations(atRule?.declarations);
  }

  return tokens;
}

// ============================================================================
// Animation → Keyframe Edge Detection
// ============================================================================

function extractAnimationNames(rule: IRRule): Set<string> {
  const names = new Set<string>();

  function scanDeclarations(
    declsInput:
      IRDeclaration[] | Record<string, IRDeclaration> | undefined | null,
  ) {
    const decls = ensureArray(declsInput);
    for (const decl of decls) {
      if (!decl) continue;
      if (decl.property === "animation" || decl.property === "animation-name") {
        const val = String(decl.value ?? "");
        const parts = val.split(",");
        for (const part of parts) {
          const name = part.trim().split(/\s+/)[0];
          if (name && !["none", "inherit", "initial", "unset"].includes(name)) {
            names.add(name);
          }
        }
      }
    }
  }

  scanDeclarations(rule.declarations);
  for (const pc of ensureArray(rule.pseudoClasses)) {
    scanDeclarations(pc?.declarations);
  }

  return names;
}

function findAtRuleById(ir: StyleIR, id: string): IRAtRule | null {
  function search(
    rulesInput: IRRule[] | Record<string, IRRule> | undefined | null,
  ): IRAtRule | null {
    const rules = ensureArray(rulesInput);
    for (const rule of rules) {
      if (!rule || typeof rule !== "object") continue;
      const atRules = ensureArray(rule.atRules);
      if (atRules.length > 0) {
        for (const atRule of atRules || []) {
          if (!atRule) continue;
          if (atRule.id === id) return atRule;
          const nested = ensureArray(atRule.nestedRules);
          if (nested.length > 0) {
            const found = search(nested);
            if (found) return found;
          }
        }
      }
      const nestedRules = ensureArray(rule.nestedRules);
      if (nestedRules.length > 0) {
        const found = search(nestedRules);
        if (found) return found;
      }
    }
    return null;
  }
  return search(ir?.rules);
}

// ============================================================================
// Token Derivation Edge Detection
// ============================================================================

function detectTokenDerivationEdges(
  ir: StyleIR,
  edges: IRGraphEdge[],
  nodes: Map<IRNodeId, IRRule>,
) {
  const tokenDefs = new Map<string, IRNodeId>();
  const rules = ensureArray(ir?.rules);

  for (const rule of rules) {
    if (!rule || typeof rule !== "object" || rule.isDead) continue;
    const semantic = rule.passMeta?.analysis?.semantic;
    if (semantic?.tokens) {
      const tokens = ensureArray(semantic.tokens as any);
      for (const token of tokens) {
        if (typeof token === "string") {
          tokenDefs.set(token, rule.id);
        }
      }
    }
    const oldTokens = rule.meta?._semantic as string[] | undefined;
    if (oldTokens) {
      for (const token of ensureArray(oldTokens)) {
        if (typeof token === "string" && !tokenDefs.has(token)) {
          tokenDefs.set(token, rule.id);
        }
      }
    }
  }

  const irMeta = ir?.meta as any;
  const tokenRelationships = ensureArray(
    irMeta?._tokenRelationships || irMeta?.tokenRelationships,
  );

  for (const rawRel of tokenRelationships) {
    const rel = rawRel as {
      type?: string;
      source?: string;
      target?: string;
      method?: string;
    };
    if (rel && rel.type === "derived" && rel.source && rel.target) {
      const sourceRuleId = tokenDefs.get(rel.source);
      const targetRuleId = tokenDefs.get(rel.target);

      if (sourceRuleId && targetRuleId) {
        const sourceRule = nodes.get(sourceRuleId);
        const targetRule = nodes.get(targetRuleId);
        if (sourceRule && targetRule) {
          addEdge(edges, nodes, sourceRule, targetRule, "derives", {
            method: rel.method,
            source: rel.source,
            target: rel.target,
          });
        }
      }
    }
  }
}

// ============================================================================
// Graph Traversal
// ============================================================================

export function traverseGraph(
  graph: IRGraph,
  startNodes: IRNodeId[],
  visitor: (node: IRRule, depth: number) => void,
) {
  const visited = new Set<IRNodeId>();
  const queue: Array<{ id: IRNodeId; depth: number }> = ensureArray(
    startNodes,
  ).map((id) => ({ id, depth: 0 }));

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = getNode(graph, id);
    if (node) {
      visitor(node, depth);
      const dependents = ensureArray(node.meta?.dependents);
      for (const depId of dependents) {
        if (!visited.has(depId)) {
          queue.push({ id: depId, depth: depth + 1 });
        }
      }
    }
  }
}

export function findAffectedNodes(
  graph: IRGraph,
  changedNodeId: IRNodeId,
): IRNodeId[] {
  const affected: IRNodeId[] = [];
  const visited = new Set<IRNodeId>();
  const queue = [changedNodeId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = getNode(graph, id);
    if (node) {
      affected.push(id);
      const dependents = ensureArray(node.meta?.dependents);
      for (const depId of dependents) {
        if (!visited.has(depId)) queue.push(depId);
      }
    }
  }

  return affected;
}

// ============================================================================
// Graph Statistics
// ============================================================================

export function getGraphStats(graph: IRGraph) {
  const allNodes = getNodeValues(graph);
  const maxDepth = findMaxDepth(graph);

  const edgeTypeCounts: Record<string, number> = {};
  for (const edge of ensureArray(graph?.edges)) {
    if (edge?.type) {
      edgeTypeCounts[edge.type] = (edgeTypeCounts[edge.type] || 0) + 1;
    }
  }

  return {
    totalNodes: allNodes.length,
    totalEdges: ensureArray(graph?.edges).length,
    rootNodes: ensureArray(graph?.rootNodes).length,
    leafNodes: ensureArray(graph?.leafNodes).length,
    maxDepth,
    edgeTypes: edgeTypeCounts,
    averageDependencies:
      allNodes.reduce(
        (sum, n) => sum + ensureArray(n.meta?.dependencies).length,
        0,
      ) / (allNodes.length || 1),
    averageDependents:
      allNodes.reduce(
        (sum, n) => sum + ensureArray(n.meta?.dependents).length,
        0,
      ) / (allNodes.length || 1),
  };
}

function findMaxDepth(graph: IRGraph): number {
  let maxDepth = 0;
  const depths = new Map<IRNodeId, number>();

  const getTargetNode = (id: IRNodeId) => getNode(graph, id);

  function getDepth(id: IRNodeId): number {
    if (depths.has(id)) return depths.get(id)!;
    const node = getTargetNode(id);
    const deps = ensureArray(node?.meta?.dependencies);
    if (deps.length === 0) {
      depths.set(id, 0);
      return 0;
    }
    const max = Math.max(...deps.map((d) => getDepth(d as IRNodeId)));
    const depth = max + 1;
    depths.set(id, depth);
    return depth;
  }

  if (graph?.nodes) {
    const nodeKeys =
      graph.nodes instanceof Map
        ? Array.from(graph.nodes.keys())
        : Object.keys(graph.nodes);

    for (const id of nodeKeys) {
      maxDepth = Math.max(maxDepth, getDepth(id));
    }
  }
  return maxDepth;
}

// ============================================================================
// JSON Export for Visualization
// ============================================================================

export interface GraphExportNode {
  id: string;
  selector: string;
  type: "rule" | "atrule" | "keyframe";
  isDead: boolean;
  specificity: number;
  dependencyCount: number;
  dependentCount: number;
  atRuleType?: string;
  atRuleQuery?: string;
}

export interface GraphExportEdge {
  from: string;
  to: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export interface GraphExport {
  version: string;
  generatedAt: string;
  stats: ReturnType<typeof getGraphStats>;
  nodes: GraphExportNode[];
  edges: GraphExportEdge[];
  rootNodes: string[];
  leafNodes: string[];
}

export function exportGraphAsJSON(graph: IRGraph, ir: StyleIR): GraphExport {
  const nodes: GraphExportNode[] = [];
  const edges: GraphExportEdge[] = [];

  if (graph?.nodes) {
    for (const [id, rule] of getNodeEntries(graph)) {
      if (!rule) continue;
      const isAtRule = id.startsWith("atrule-");
      nodes.push({
        id,
        selector: rule.selector,
        type: isAtRule ? "atrule" : "rule",
        isDead: rule.isDead,
        specificity: rule.specificity,
        dependencyCount: ensureArray(rule.meta?.dependencies).length,
        dependentCount: ensureArray(rule.meta?.dependents).length,
        atRuleType: isAtRule
          ? (ensureArray(graph.edges).find((e) => e.to === id)?.metadata
              ?.atRuleType as string)
          : undefined,
        atRuleQuery: isAtRule
          ? (ensureArray(graph.edges).find((e) => e.to === id)?.metadata
              ?.query as string)
          : undefined,
      });
    }
  }

  for (const edge of ensureArray(graph?.edges)) {
    if (!edge) continue;
    edges.push({
      from: edge.from,
      to: edge.to,
      type: edge.type,
      metadata: edge.metadata,
    });
  }

  return {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    stats: getGraphStats(graph),
    nodes,
    edges,
    rootNodes: ensureArray(graph?.rootNodes),
    leafNodes: ensureArray(graph?.leafNodes),
  };
}
