import crypto from "node:crypto";
import type { PersistentCache } from "../cache/content-addressable-cache.js";
import type { StyleIR, IRGraph } from "./ir/types.js";
import { buildIRGraph } from "./ir/graph-builder.js";
import {
  findDirtyRules,
  filterDirtyIR,
  type IncrementalChange,
} from "./incremental-compiler.js";
import type { Pipeline } from "./pipeline.js";
import type { PipelineResult } from "./pipeline-types.js";

export interface CompilerBridgeOptions {
  cache: PersistentCache;
  pipeline: Pipeline;
}

export async function compileWithGraphCache(
  source: string,
  previousIR: StyleIR,
  change: IncrementalChange,
  options: CompilerBridgeOptions,
): Promise<PipelineResult> {
  const { cache, pipeline } = options;

  // 1. Resolve the IR graph
  const graph: IRGraph = previousIR.graph || buildIRGraph(previousIR);

  // 2. Identify dirty rules using your graph-based dirty tracking
  const dirtyIds = findDirtyRules(graph, change);

  // 3. Construct a Compound Hash using Node's crypto (Source content + active dirty IDs)
  const rawKey = source + "::" + Array.from(dirtyIds).join(",");
  const compoundCacheKey = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex");

  // 4. If no rules are directly dirty for this node, check the persistent cache first
  const isDirectlyDirty = change.changedRuleIds.some((id) => dirtyIds.has(id));
  if (!isDirectlyDirty) {
    const cachedResult = await cache.getByHash(compoundCacheKey);
    if (cachedResult) {
      return cachedResult;
    }
  }

  // 5. Cache miss or dirty state: filter IR and execute pipeline
  const filteredIR = filterDirtyIR(previousIR, dirtyIds);
  const pipelineResult = pipeline.execute(filteredIR);

  // 6. Store computed result back into the persistent cache
  await cache.setByHash(compoundCacheKey, pipelineResult);

  return pipelineResult;
}
