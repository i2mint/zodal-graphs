/**
 * @zodal/graph-compute — the renderer-agnostic traversal + provenance overlay engine.
 *
 * Compute graph-theory results (paths, reachable sets, cycles, components, topological order) and
 * provenance results (downstream-impacted / upstream-sources) ONCE on the canonical graph, and
 * emit a single `GraphOverlays` block of `{nodeId/edgeId → role}` that any renderer draws as
 * highlights. Build an engine for repeated queries on one graph, or use the one-shot helpers.
 *
 * Everything runs on the load-bearing reachability primitive (`reach`): provenance is just
 * point-reachability over the dependency edges, so there is no separate provenance engine.
 */

import type { CanonicalGraph, GraphCapabilities, OverlayLayer } from '@zodal/graph-core';
import { buildIndex, topologicalOrder, type GraphIndex, type Direction, type Walk } from './adjacency.js';
import {
  pathLayer,
  neighborhoodLayer,
  ancestorsLayer,
  descendantsLayer,
  staleLayer,
  provenanceLayer,
  cyclesLayer,
  componentsLayer,
  computeOverlaysFromIndex,
  type OverlayRequest,
  type OverlayResult,
} from './overlays.js';
import {
  degreeCentrality,
  pagerank,
  betweenness,
  community as communityOf,
  criticalPath as criticalPathOf,
  degreeOfInterest,
  type CentralityKind,
} from './metrics.js';

export * from './adjacency.js';
export * from './overlays.js';
export * from './filter.js';
export * from './metrics.js';
export * from './aggregate.js';

/** A reusable engine bound to one graph (the index is built once). */
export interface TraversalEngine {
  /** The underlying index (exposed for advanced use / further algorithms). */
  readonly index: GraphIndex;
  path(source: string, target: string): OverlayLayer | null;
  /** Bounded k-hop neighborhood/ego around `focus`, with per-hop distance-band roles. */
  neighborhood(focus: string[], opts: { radius: number; direction?: Direction }): OverlayLayer;
  ancestors(node: string): OverlayLayer;
  descendants(node: string): OverlayLayer;
  stale(changed: string[]): OverlayLayer;
  provenance(node: string): OverlayLayer;
  cycles(): OverlayLayer | null;
  components(): OverlayLayer;
  /** Centrality scores per node (degree / pagerank / betweenness) — for importance-driven styling. */
  centrality(kind?: CentralityKind): Map<string, number>;
  /** Community index per node (label propagation). */
  community(): Map<string, number>;
  /** Longest weighted DAG path (null if cyclic). */
  criticalPath(weightOf?: (edgeId: string) => number): Walk | null;
  /** Degree-of-interest score per node given a focus set (a-priori importance − distance). */
  doi(
    focus: string[],
    opts?: { apriori?: Map<string, number>; centralityWeight?: number; distanceDecay?: number },
  ): Map<string, number>;
  topologicalOrder(): string[] | null;
  overlays(request: OverlayRequest, capabilities?: GraphCapabilities): OverlayResult;
}

/** Build a {@link TraversalEngine} for a graph — preferred when issuing several queries. */
export function createTraversalEngine(graph: CanonicalGraph): TraversalEngine {
  const index = buildIndex(graph);
  return {
    index,
    path: (source, target) => pathLayer(index, source, target),
    neighborhood: (focus, opts) => neighborhoodLayer(index, focus, opts),
    ancestors: (node) => ancestorsLayer(index, node),
    descendants: (node) => descendantsLayer(index, node),
    stale: (changed) => staleLayer(index, changed),
    provenance: (node) => provenanceLayer(index, node),
    cycles: () => cyclesLayer(index),
    components: () => componentsLayer(index),
    centrality: (kind = 'degree') =>
      kind === 'pagerank' ? pagerank(index) : kind === 'betweenness' ? betweenness(index) : degreeCentrality(index),
    community: () => communityOf(index),
    criticalPath: (weightOf) => criticalPathOf(index, weightOf),
    doi: (focus, opts) => degreeOfInterest(index, focus, opts),
    topologicalOrder: () => topologicalOrder(index),
    overlays: (request, capabilities) => computeOverlaysFromIndex(index, request, capabilities),
  };
}

/** One-shot convenience: build the index and compute the requested overlays in one call. */
export function computeOverlays(
  graph: CanonicalGraph,
  request: OverlayRequest,
  capabilities?: GraphCapabilities,
): OverlayResult {
  return computeOverlaysFromIndex(buildIndex(graph), request, capabilities);
}
