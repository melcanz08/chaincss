// src/compiler/pipeline/compiler-bridge.ts

import crypto from "node:crypto";
import type { PersistentCache } from "../cache/content-addressable-cache.js";
import type { StyleIR, IRGraph } from "./ir/types.js";
import { buildIRGraph } from "../incremental/graph-builder.js";
import {
  findDirtyRules,
  filterDirtyIR,
  mergeRecompiledIR,
  type IncrementalChange,
} from "../incremental/incremental-compiler.js";
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

  if (!previousIR.graph) {
    previousIR.graph = buildIRGraph(previousIR);
  }
  const graph: IRGraph = previousIR.graph;

  const dirtyIds = findDirtyRules(graph, change);

  const sortedDirtyIds = Array.from(dirtyIds).sort().join(",");
  const rawKey = `${source}::${sortedDirtyIds}`;
  const compoundCacheKey = crypto
    .createHash("sha256")
    .update(rawKey)
    .digest("hex");

  const cachedResult = await cache.getByHash(compoundCacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  const filteredIR = filterDirtyIR(previousIR, dirtyIds);
  const pipelineResult = await pipeline.process(filteredIR);

  // Merge dirty results back into full IR before returning/caching
  const fullIR = mergeRecompiledIR(previousIR, pipelineResult.ir, dirtyIds);
  fullIR.graph = buildIRGraph(fullIR);

  const fullResult: PipelineResult = {
    ...pipelineResult,
    ir: fullIR,
  };

  await cache.setByHash(compoundCacheKey, fullResult);

  return fullResult;
}