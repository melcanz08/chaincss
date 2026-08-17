// ============================================================================
// FILE: src/compiler/incremental/graph-builder.ts
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
} from "../pipeline/ir/types.js";

import { ensureRuleMeta } from "../pipeline/ir/utils.js";

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

function normalizeTokenName(name: string): string {
  return (name || "").trim().replace(/^\$/, "").trim();
}

function getOrCreateTokenNode(
  nodes: Map<IRNodeId, IRRule>,
  rawTokenName: string,
): IRRule {
  const tokenName = normalizeTokenName(rawTokenName);
  const tokenId = `token-${tokenName}`;
  let tokenNode = nodes.get(tokenId);

  if (!tokenNode) {
    tokenNode = {
      id: tokenId,
      selector: `$${tokenName}`,
      declarations: [],
      pseudoClasses: [],
      atRules: [],
      nestedRules: [],
      conditions: [],
      meta: {
        dependencies: [],
        dependents: [],
        _isSyntheticToken: true,
        _tokenName: tokenName,
      },
      isDead: false,
      specificity: 0,
      hash: "",
      source: { file: "__synthetic__", line: 0, column: 0 },
      history: [],
    };
    nodes.set(tokenId, tokenNode);
  }

  return tokenNode;
}

// ============================================================================
// Main Graph Builder
// ============================================================================

export function buildIRGraph(ir: StyleIR): IRGraph {
  const edgeSet = new Set<string>();
  const nodes = new Map<IRNodeId, IRRule>();
  const edges: IRGraphEdge[] = [];

  function addEdge(
    edges: IRGraphEdge[],
    _nodes: Map<IRNodeId, IRRule>,
    from: IRRule,
    to: IRRule,
    type: IRGraphEdge["type"],
    metadata?: Record<string, unknown>,
  ) {
    const key = `${from.id}:${to.id}:${type}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);

    edges.push({ from: from.id, to: to.id, type, metadata });

    const fromMeta = ensureRuleMeta(from);
    fromMeta.dependents ??= [];
    if (!fromMeta.dependents.includes(to.id)) {
      fromMeta.dependents.push(to.id);
    }

    const toMeta = ensureRuleMeta(to);
    toMeta.dependencies ??= [];
    if (!toMeta.dependencies.includes(from.id)) {
      toMeta.dependencies.push(from.id);
    }
  }

  function collectRules(
    rulesInput: IRRule[] | Record<string, IRRule> | undefined | null,
    parentId?: IRNodeId,
    containerAtRule?: IRAtRule,
  ) {
    const rules = ensureArray(rulesInput);
    for (const rule of rules) {
      if (!rule || typeof rule !== "object") continue;
      if (rule.isDead) continue;
      nodes.set(rule.id, rule);

      if (parentId) {
        const parentNode = nodes.get(parentId);
        if (parentNode) {
          addEdge(edges, nodes, parentNode, rule, "extends");
        }
      }

      if (containerAtRule) {
        const containerId = `atrule-${containerAtRule.id}`;
        const containerNode = nodes.get(containerId);
        if (containerNode) {
          addEdge(edges, nodes, containerNode, rule, "contains", {
            atRuleType: containerAtRule.type,
            query: containerAtRule.query,
            name: containerAtRule.name,
          });
        }
      }

      const nestedRules = ensureArray(rule.nestedRules);
      if (nestedRules.length > 0) {
        collectRules(nestedRules, rule.id);
      }

      const atRules = ensureArray(rule.atRules);
      if (atRules.length > 0) {
        for (const atRule of atRules) {
          if (!atRule || typeof atRule !== "object") continue;
          const atRuleId = `atrule-${atRule.id}`;
          const virtualRule: IRRule = {
            id: atRuleId,
            selector: `@${atRule.type} ${atRule.query || atRule.name || ""}`.trim(),
            declarations: ensureArray(atRule.declarations),
            pseudoClasses: [],
            atRules: [],
            nestedRules: ensureArray(atRule.nestedRules),
            conditions: [],
            meta: {
              dependencies: [rule.id],
              dependents: [],
              _atRuleType: atRule.type,
              _atRuleName: atRule.name,
              _atRuleQuery: atRule.query,
            },
            isDead: false,
            specificity: 0,
            hash: "",
            source: atRule.source,
            history: [...(atRule.history || [])],
          };
          nodes.set(atRuleId, virtualRule);

          addEdge(edges, nodes, rule, virtualRule, "contains", {
            atRuleType: atRule.type,
            query: atRule.query,
            name: atRule.name,
          });

          const atNested = ensureArray(atRule.nestedRules);
          if (atNested.length > 0) {
            collectRules(atNested, rule.id, atRule);
          }

          const keyframes = ensureArray(atRule.keyframes);
          if (atRule.type === "keyframes" && keyframes.length > 0) {
            for (let idx = 0; idx < keyframes.length; idx++) {
              const frame = keyframes[idx];
              if (!frame || typeof frame !== "object") continue;
              const frameId = frame.id || `${atRuleId}-frame-${frame.keyText || idx}`;
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

              addEdge(edges, nodes, virtualRule, frameRule, "contains", {
                atRuleType: "keyframes",
                frameKey: frame.keyText,
              });
            }
          }
        }
      }
    }
  }

  collectRules(ir.rules);

  // Selector overlap detection
  const regularRules = Array.from(nodes.values()).filter(
    (r) => !r.id.startsWith("atrule-") && !r.id.startsWith("token-"),
  );

  const regularNodeData = regularRules.map((rule) => ({
    rule,
    selectorParts: extractSelectorTokens(rule.selector),
  }));

  const selectorIndex = new Map<string, IRRule[]>();
  for (const data of regularNodeData) {
    for (const part of data.selectorParts) {
      let list = selectorIndex.get(part);
      if (!list) {
        list = [];
        selectorIndex.set(part, list);
      }
      list.push(data.rule);
    }
  }

  const MAX_BUCKET_SIZE = 100;
  const checkedPairs = new Set<string>();

  for (const dataA of regularNodeData) {
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

  // Token reference detection
  const allCurrentNodes = Array.from(nodes.values());
  const tokenIndex = new Map<string, IRRule[]>();

  for (const rule of allCurrentNodes) {
    const tokenRefs = extractTokenReferences(rule);
    for (const token of tokenRefs) {
      let list = tokenIndex.get(token);
      if (!list) {
        list = [];
        tokenIndex.set(token, list);
      }
      list.push(rule);
    }
  }

  for (const [tokenName, consumerRules] of tokenIndex) {
    const tokenNode = getOrCreateTokenNode(nodes, tokenName);
    for (const consumerRule of consumerRules) {
      addEdge(edges, nodes, tokenNode, consumerRule, "references");
    }
  }

  // Animation dependency detection
  const fullNodeArray = Array.from(nodes.values());
  for (let i = 0; i < fullNodeArray.length; i++) {
    const animNames = extractAnimationNames(fullNodeArray[i]);
    if (animNames.size > 0) {
      for (const other of fullNodeArray) {
        if (other.id === fullNodeArray[i].id) continue;
        if (other.id.startsWith("atrule-")) {
          const atRuleType = (other.meta as any)?._atRuleType;
          const atRuleName = (other.meta as any)?._atRuleName;
          if (atRuleType === "keyframes" && atRuleName && animNames.has(atRuleName)) {
            addEdge(edges, nodes, other, fullNodeArray[i], "animates");
          }
        }
      }
    }
  }

  detectTokenDerivationEdges(ir, edges, nodes, addEdge);

  const finalNodes = Array.from(nodes.values());

  const rootNodes = finalNodes
    .filter((n) => !n.meta?.dependencies || n.meta.dependencies.length === 0)
    .map((n) => n.id);

  const leafNodes = finalNodes
    .filter((n) => !n.meta?.dependents || n.meta.dependents.length === 0)
    .map((n) => n.id);

  return { nodes, edges, rootNodes, leafNodes };
}

// ============================================================================
// Selector Overlap Detection
// ============================================================================

function extractSelectorTokens(selector: string): Set<string> {
  const tokens = new Set<string>();
  const compounds = (selector || "").split(/[\s>+~,]+/).filter(Boolean);
  for (const compound of compounds) {
    const matches = compound.match(/([.#:]?[a-zA-Z_][a-zA-Z0-9_-]*)/g) || [];
    for (const m of matches) {
      if (m.startsWith(":")) continue;
      tokens.add(m);
    }
  }
  return tokens;
}

function selectorsOverlap(a: string, b: string): boolean {
  const tokensA = extractSelectorTokens(a);
  const tokensB = extractSelectorTokens(b);

  for (const ta of tokensA) {
    if (tokensB.has(ta)) return true;
  }
  return false;
}

// ============================================================================
// Token Reference Detection
// ============================================================================

function extractTokenReferences(rule: IRRule): Set<string> {
  const tokens = new Set<string>();

  function scanDeclarations(
    declsInput: IRDeclaration[] | Record<string, IRDeclaration> | undefined | null,
  ) {
    const decls = ensureArray(declsInput);
    for (const decl of decls) {
      if (!decl) continue;
      const val = String(decl.value ?? "");
      const matches = val.matchAll(/\$([a-zA-Z0-9_.-]+)/g);
      for (const match of matches) {
        const cleanToken = normalizeTokenName(match[1]);
        if (cleanToken) tokens.add(cleanToken);
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

const ANIMATION_KEYWORDS = new Set([
  "none", "inherit", "initial", "unset", "revert",
  "infinite", "linear", "ease", "ease-in", "ease-out", "ease-in-out",
  "step-start", "step-end", "normal", "reverse",
  "alternate", "alternate-reverse", "forwards", "backwards",
  "both", "running", "paused",
]);

function isTimingOrNumericToken(part: string): boolean {
  return (
    /^\d+(\.\d+)?(s|ms)?$/i.test(part) ||
    /^(cubic-bezier|steps)\(.*\)$/i.test(part)
  );
}

function extractAnimationNames(rule: IRRule): Set<string> {
  const names = new Set<string>();

  function scanDeclarations(
    declsInput: IRDeclaration[] | Record<string, IRDeclaration> | undefined | null,
  ) {
    const decls = ensureArray(declsInput);
    for (const decl of decls) {
      if (!decl) continue;
      if (decl.property === "animation" || decl.property === "animation-name") {
        const val = String(decl.value ?? "");
        const commaParts = val.split(",");
        for (const commaPart of commaParts) {
          const parts = commaPart.trim().split(/\s+/);
          for (const token of parts) {
            const cleanToken = token.trim();
            if (!cleanToken) continue;
            if (ANIMATION_KEYWORDS.has(cleanToken.toLowerCase())) continue;
            if (isTimingOrNumericToken(cleanToken)) continue;
            names.add(cleanToken);
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

// ============================================================================
// Token Derivation Edge Detection
// ============================================================================

function detectTokenDerivationEdges(
  ir: StyleIR,
  edges: IRGraphEdge[],
  nodes: Map<IRNodeId, IRRule>,
  addEdgeFn: (
    edges: IRGraphEdge[],
    nodes: Map<IRNodeId, IRRule>,
    from: IRRule,
    to: IRRule,
    type: IRGraphEdge["type"],
    metadata?: Record<string, unknown>,
  ) => void,
) {
  const tokenDefs = new Map<string, IRNodeId>();
  const rules = ensureArray(ir?.rules);

  for (const rule of rules) {
    if (!rule || typeof rule !== "object" || rule.isDead) continue;

    const semantic = rule.passMeta?.analysis?.semantic;
    const tokens = [
      ...ensureArray(semantic?.tokens as any),
      ...ensureArray((rule.meta as any)?._semantic as any),
    ];

    for (const token of tokens) {
      if (typeof token === "string") {
        const cleanToken = normalizeTokenName(token);
        if (!cleanToken) continue;

        tokenDefs.set(cleanToken, rule.id);
        const tokenNode = getOrCreateTokenNode(nodes, cleanToken);
        addEdgeFn(edges, nodes, rule, tokenNode, "defines");
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
      const cleanSource = normalizeTokenName(rel.source);
      const cleanTarget = normalizeTokenName(rel.target);

      if (cleanSource && cleanTarget) {
        const sourceTokenNode = getOrCreateTokenNode(nodes, cleanSource);
        const targetTokenNode = getOrCreateTokenNode(nodes, cleanTarget);

        addEdgeFn(edges, nodes, sourceTokenNode, targetTokenNode, "derives", {
          method: rel.method,
          source: cleanSource,
          target: cleanTarget,
        });
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
  const queue: Array<{ id: IRNodeId; depth: number }> = ensureArray(startNodes).map((id) => ({
    id,
    depth: 0,
  }));

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

export interface InvalidationOptions {
  includeTokenNodes?: boolean;
  maxDepth?: number;
}

function resolveNodeId(graph: IRGraph, target: string): IRNodeId | undefined {
  if (getNode(graph, target)) return target;

  const cleanToken = normalizeTokenName(target);
  const tokenId = `token-${cleanToken}`;
  if (getNode(graph, tokenId)) return tokenId;

  return undefined;
}

export function findAffectedNodes(
  graph: IRGraph,
  startIdOrToken: IRNodeId | string,
  options: InvalidationOptions = {},
): IRNodeId[] {
  const { includeTokenNodes = false, maxDepth = Infinity } = options;
  const startId = resolveNodeId(graph, startIdOrToken);

  if (!startId) return [];

  const affected: IRNodeId[] = [];
  const visited = new Set<IRNodeId>();
  const queue: Array<{ id: IRNodeId; depth: number }> = [{ id: startId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);

    const node = getNode(graph, id);
    if (!node) continue;

    const isTokenNode = id.startsWith("token-") || Boolean((node.meta as any)?._isSyntheticToken);

    if (!isTokenNode || includeTokenNodes) {
      affected.push(id);
    }

    if (depth >= maxDepth) continue;

    const dependents = ensureArray(node.meta?.dependents);
    for (const depId of dependents) {
      if (!visited.has(depId)) {
        queue.push({ id: depId, depth: depth + 1 });
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
      allNodes.reduce((sum, n) => sum + ensureArray(n.meta?.dependencies).length, 0) /
      (allNodes.length || 1),
    averageDependents:
      allNodes.reduce((sum, n) => sum + ensureArray(n.meta?.dependents).length, 0) /
      (allNodes.length || 1),
  };
}

function findMaxDepth(graph: IRGraph): number {
  let maxDepth = 0;
  const depths = new Map<IRNodeId, number>();

  if (!graph?.nodes) return 0;

  const nodeKeys =
    graph.nodes instanceof Map
      ? Array.from(graph.nodes.keys())
      : Object.keys(graph.nodes);

  for (const startId of nodeKeys) {
    if (depths.has(startId)) continue;

    const visited = new Set<IRNodeId>();
    const stack: Array<{ id: IRNodeId; depth: number }> = [{ id: startId, depth: 0 }];

    while (stack.length > 0) {
      const { id, depth } = stack.pop()!;
      if (visited.has(id)) continue;
      visited.add(id);

      maxDepth = Math.max(maxDepth, depth);
      depths.set(id, depth);

      const node = getNode(graph, id);
      const deps = ensureArray(node?.meta?.dependencies);

      for (const dep of deps as IRNodeId[]) {
        if (!visited.has(dep)) {
          stack.push({ id: dep, depth: depth + 1 });
        }
      }
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
  type: "rule" | "atrule" | "keyframe" | "token";
  isDead: boolean;
  specificity: number;
  dependencyCount: number;
  dependentCount: number;
  atRuleType?: string;
  atRuleQuery?: string;
  tokenName?: string;
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

export function exportGraphAsJSON(graph: IRGraph, _ir?: StyleIR): GraphExport {
  const nodes: GraphExportNode[] = [];
  const edges: GraphExportEdge[] = [];

  if (graph?.nodes) {
    for (const [id, rule] of getNodeEntries(graph)) {
      if (!rule) continue;
      const isAtRule = id.startsWith("atrule-");
      const isToken = id.startsWith("token-");
      const ruleMeta = rule.meta as Record<string, any> | undefined;

      nodes.push({
        id,
        selector: rule.selector,
        type: isToken ? "token" : isAtRule ? "atrule" : "rule",
        isDead: Boolean(rule.isDead),
        specificity: rule.specificity ?? 0,
        dependencyCount: ensureArray(rule.meta?.dependencies).length,
        dependentCount: ensureArray(rule.meta?.dependents).length,
        atRuleType: isAtRule ? ruleMeta?._atRuleType : undefined,
        atRuleQuery: isAtRule ? ruleMeta?._atRuleQuery : undefined,
        tokenName: isToken ? ruleMeta?._tokenName : undefined,
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