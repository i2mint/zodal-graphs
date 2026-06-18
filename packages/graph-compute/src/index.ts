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

import type { CanonicalGraph, GraphCapabilities, GraphOverlays, OverlayLayer } from '@zodal/graph-core';
import { buildIndex, topologicalOrder, type GraphIndex } from './adjacency.js';
import {
  pathLayer,
  ancestorsLayer,
  descendantsLayer,
  staleLayer,
  provenanceLayer,
  cyclesLayer,
  componentsLayer,
  computeOverlaysFromIndex,
  type OverlayRequest,
} from './overlays.js';

export * from './adjacency.js';
export * from './overlays.js';

/** A reusable engine bound to one graph (the index is built once). */
export interface TraversalEngine {
  /** The underlying index (exposed for advanced use / further algorithms). */
  readonly index: GraphIndex;
  path(source: string, target: string): OverlayLayer | null;
  ancestors(node: string): OverlayLayer;
  descendants(node: string): OverlayLayer;
  stale(changed: string[]): OverlayLayer;
  provenance(node: string): OverlayLayer;
  cycles(): OverlayLayer | null;
  components(): OverlayLayer;
  topologicalOrder(): string[] | null;
  overlays(request: OverlayRequest, capabilities?: GraphCapabilities): GraphOverlays;
}

/** Build a {@link TraversalEngine} for a graph — preferred when issuing several queries. */
export function createTraversalEngine(graph: CanonicalGraph): TraversalEngine {
  const index = buildIndex(graph);
  return {
    index,
    path: (source, target) => pathLayer(index, source, target),
    ancestors: (node) => ancestorsLayer(index, node),
    descendants: (node) => descendantsLayer(index, node),
    stale: (changed) => staleLayer(index, changed),
    provenance: (node) => provenanceLayer(index, node),
    cycles: () => cyclesLayer(index),
    components: () => componentsLayer(index),
    topologicalOrder: () => topologicalOrder(index),
    overlays: (request, capabilities) => computeOverlaysFromIndex(index, request, capabilities),
  };
}

/** One-shot convenience: build the index and compute the requested overlays in one call. */
export function computeOverlays(
  graph: CanonicalGraph,
  request: OverlayRequest,
  capabilities?: GraphCapabilities,
): GraphOverlays {
  return computeOverlaysFromIndex(buildIndex(graph), request, capabilities);
}
