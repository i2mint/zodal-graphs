/**
 * Overlay producers — turn algorithm results into the canonical, renderer-agnostic
 * `GraphOverlays` shape (a set of `{nodeId/edgeId → role}` layers). Computed once here, drawn as
 * highlights on whatever renderer is active (React Flow, sigma, Cytoscape, …) — the #2
 * tool-deciding insight of the research: traversal and provenance are overlays, not per-renderer
 * features.
 *
 * Provenance is not a separate engine: the "downstream impacted / stale" set is forward
 * reachability from the changed nodes, and the "upstream sources" set is backward reachability —
 * both reuse the one primitive in `adjacency.ts`.
 */

import type { GraphCapabilities, GraphOverlays, HighlightRole, OverlayLayer } from '@zodal/graph-core';
import type { GraphIndex } from './adjacency.js';
import { reach, shortestPath, findCycle, connectedComponents } from './adjacency.js';

type RoleMap = Record<string, HighlightRole>;

/** Shortest-path highlight between two nodes (nodes + the edges along the path), or null. */
export function pathLayer(index: GraphIndex, source: string, target: string): OverlayLayer | null {
  const path = shortestPath(index, source, target);
  if (!path) return null;
  const nodes: RoleMap = {};
  const edges: RoleMap = {};
  for (const n of path) nodes[n] = 'path';
  for (let i = 0; i < path.length - 1; i++) {
    const edge = index.edgeBetween(path[i], path[i + 1]);
    if (edge) edges[edge] = 'path';
  }
  return { layer: 'path', nodes, edges };
}

/** Upstream reachable set (the node = `primary`, its ancestors = `ancestor`). */
export function ancestorsLayer(index: GraphIndex, node: string, layer = 'ancestors'): OverlayLayer {
  const nodes: RoleMap = { [node]: 'primary' };
  for (const n of reach(index, [node], 'backward')) if (n !== node) nodes[n] = 'ancestor';
  return { layer, nodes };
}

/** Downstream reachable set (the node = `primary`, its descendants = `descendant`). */
export function descendantsLayer(index: GraphIndex, node: string): OverlayLayer {
  const nodes: RoleMap = { [node]: 'primary' };
  for (const n of reach(index, [node], 'forward')) if (n !== node) nodes[n] = 'descendant';
  return { layer: 'descendants', nodes };
}

/** The stale / downstream-impacted set after the `changed` nodes change (changed = `primary`). */
export function staleLayer(index: GraphIndex, changed: string[]): OverlayLayer {
  const nodes: RoleMap = {};
  for (const c of changed) nodes[c] = 'primary';
  for (const n of reach(index, changed, 'forward')) if (!(n in nodes)) nodes[n] = 'stale';
  return { layer: 'stale', nodes };
}

/** Upstream provenance / sources of a node (backward reachability, labelled as a provenance layer). */
export function provenanceLayer(index: GraphIndex, node: string): OverlayLayer {
  return ancestorsLayer(index, node, 'provenance');
}

/** Highlight one detected cycle, or null if acyclic. */
export function cyclesLayer(index: GraphIndex): OverlayLayer | null {
  const cycle = findCycle(index);
  if (!cycle) return null;
  const nodes: RoleMap = {};
  const edges: RoleMap = {};
  for (const n of cycle) nodes[n] = 'path';
  for (let i = 0; i < cycle.length - 1; i++) {
    const edge = index.edgeBetween(cycle[i], cycle[i + 1]);
    if (edge) edges[edge] = 'path';
  }
  return { layer: 'cycles', nodes, edges };
}

/** Color nodes by weakly-connected component (`component:0`, `component:1`, …). */
export function componentsLayer(index: GraphIndex): OverlayLayer {
  const nodes: RoleMap = {};
  connectedComponents(index).forEach((component, i) => {
    for (const n of component) nodes[n] = `component:${i}`;
  });
  return { layer: 'components', nodes };
}

/** A declarative request for one or more overlay layers. */
export interface OverlayRequest {
  path?: { source: string; target: string };
  ancestorsOf?: string;
  descendantsOf?: string;
  stale?: string[];
  provenanceOf?: string;
  cycles?: boolean;
  components?: boolean;
}

/**
 * Compute the requested overlay layers, gated by declared capabilities. When `capabilities` is
 * given, a traversal layer is emitted only if its kind is in `capabilities.traversal`, and
 * provenance only if `capabilities.hasProvenance`. When omitted, everything requested is computed.
 */
export function computeOverlaysFromIndex(
  index: GraphIndex,
  request: OverlayRequest,
  capabilities?: GraphCapabilities,
): GraphOverlays {
  const allowKind = (kind: string): boolean =>
    !capabilities || (capabilities.traversal as readonly string[]).includes(kind);
  const allowProvenance = !capabilities || capabilities.hasProvenance;
  const layers: OverlayLayer[] = [];
  const push = (layer: OverlayLayer | null): void => {
    if (layer) layers.push(layer);
  };

  if (request.path && allowKind('path')) push(pathLayer(index, request.path.source, request.path.target));
  if (request.ancestorsOf && allowKind('ancestors')) push(ancestorsLayer(index, request.ancestorsOf));
  if (request.descendantsOf && allowKind('descendants')) push(descendantsLayer(index, request.descendantsOf));
  if (request.stale && allowKind('stale')) push(staleLayer(index, request.stale));
  if (request.provenanceOf && allowProvenance) push(provenanceLayer(index, request.provenanceOf));
  if (request.cycles && allowKind('cycles')) push(cyclesLayer(index));
  if (request.components && allowKind('components')) push(componentsLayer(index));

  return { highlights: layers };
}
