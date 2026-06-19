/**
 * Overlay producers — turn algorithm results into the canonical, renderer-agnostic
 * `GraphOverlays` shape (a set of `{nodeId/edgeId → role}` layers). Computed once here, drawn as
 * highlights on whatever renderer is active — the #2 tool-deciding insight of the research:
 * traversal and provenance are overlays, not per-renderer features.
 *
 * Provenance is not a separate engine: the "downstream impacted / stale" set is forward
 * reachability from the changed nodes, the "upstream sources" set is backward reachability — both
 * reuse the one primitive in `adjacency.ts`. Per research §4.4 the provenance/sources overlay
 * reuses the `'ancestors'` layer name (it is ancestors over the dependency edges), so a renderer
 * switching on the declared `TraversalKind` vocabulary handles it without a new case.
 */

import type {
  GraphCapabilities,
  GraphOverlays,
  HighlightRole,
  OverlayLayer,
  TraversalKind,
} from '@zodal/graph-core';
import type { GraphIndex } from './adjacency.js';
import { reach, shortestPath, findCycle, connectedComponents, neighborhood, type Direction } from './adjacency.js';
import {
  community,
  criticalPath,
  degreeCentrality,
  pagerank,
  betweenness,
  type CentralityKind,
} from './metrics.js';

type RoleMap = Record<string, HighlightRole>;

const centralityScores = (index: GraphIndex, kind: CentralityKind): Map<string, number> =>
  kind === 'pagerank' ? pagerank(index) : kind === 'betweenness' ? betweenness(index) : degreeCentrality(index);

/** Colour nodes by community (`community:0`, `community:1`, …) via label propagation. */
export function communityLayer(index: GraphIndex): OverlayLayer {
  const nodes: RoleMap = {};
  for (const [n, c] of community(index)) nodes[n] = `community:${c}`;
  return { layer: 'community', nodes };
}

/** Highlight the longest (most-weighted) DAG path (nodes + edges = `path`), or null if cyclic. */
export function criticalPathLayer(
  index: GraphIndex,
  weightOf?: (edgeId: string) => number,
): OverlayLayer | null {
  const walk = criticalPath(index, weightOf);
  if (!walk) return null;
  const nodes: RoleMap = {};
  const edges: RoleMap = {};
  for (const n of walk.nodes) nodes[n] = 'path';
  for (const e of walk.edges) edges[e] = 'path';
  return { layer: 'critical-path', nodes, edges };
}

/** Highlight the most-central nodes: the top `topFraction` by `kind` centrality become `primary`. */
export function centralityLayer(
  index: GraphIndex,
  { kind = 'pagerank', topFraction = 0.1 }: { kind?: CentralityKind; topFraction?: number } = {},
): OverlayLayer {
  const scores = [...centralityScores(index, kind)].sort((a, b) => b[1] - a[1]);
  const cut = Math.max(1, Math.round(scores.length * topFraction));
  const nodes: RoleMap = {};
  scores.slice(0, cut).forEach(([n]) => (nodes[n] = 'primary'));
  return { layer: `centrality:${kind}`, nodes };
}

/**
 * Bounded k-hop neighborhood highlight: focus = `primary`, each hop ring = `hop-1`/`hop-2`/…
 * (open-ended `HighlightRole` strings — a renderer styles them as concentric distance bands), and
 * edges induced within the neighborhood = `related`. Drives leveled focus on a target node.
 */
export function neighborhoodLayer(
  index: GraphIndex,
  focus: string[],
  opts: { radius: number; direction?: Direction },
): OverlayLayer {
  const dist = neighborhood(index, focus, opts);
  const nodes: RoleMap = {};
  for (const [node, d] of dist) nodes[node] = d === 0 ? 'primary' : `hop-${d}`;
  const edges: RoleMap = {};
  for (const node of dist.keys()) {
    for (const { to, edge } of index.outgoing.get(node) ?? []) {
      if (dist.has(to)) edges[edge] = 'related';
    }
  }
  return { layer: 'neighborhood', nodes, edges };
}

/** Shortest-path highlight between two nodes (path nodes + the exact edges traversed), or null. */
export function pathLayer(index: GraphIndex, source: string, target: string): OverlayLayer | null {
  const walk = shortestPath(index, source, target);
  if (!walk) return null;
  const nodes: RoleMap = {};
  const edges: RoleMap = {};
  for (const n of walk.nodes) nodes[n] = 'path';
  for (const e of walk.edges) edges[e] = 'path';
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

/** Upstream provenance / sources of a node — backward reachability, reusing the `ancestors` layer. */
export function provenanceLayer(index: GraphIndex, node: string): OverlayLayer {
  return ancestorsLayer(index, node, 'ancestors');
}

/** Highlight one detected cycle (nodes + the edges forming it), or null if acyclic. */
export function cyclesLayer(index: GraphIndex): OverlayLayer | null {
  const cycle = findCycle(index);
  if (!cycle) return null;
  const nodes: RoleMap = {};
  const edges: RoleMap = {};
  for (const n of cycle.nodes) nodes[n] = 'path';
  for (const e of cycle.edges) edges[e] = 'path';
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
  neighborhood?: { focus: string[]; radius: number; direction?: Direction };
  ancestorsOf?: string;
  descendantsOf?: string;
  stale?: string[];
  provenanceOf?: string;
  cycles?: boolean;
  components?: boolean;
  community?: boolean;
  criticalPath?: boolean;
  centrality?: { kind?: CentralityKind; topFraction?: number };
}

/** A requested layer the engine refused to compute, and why (honest, like graph-ui's degrade). */
export interface RefusedOverlay {
  request: keyof OverlayRequest;
  reason: 'traversal' | 'provenance';
  kind?: TraversalKind;
}

/** The result of an overlay computation: the drawable overlays AND what was refused. */
export interface OverlayResult {
  overlays: GraphOverlays;
  refused: RefusedOverlay[];
}

/**
 * Compute the requested overlay layers, gated by declared capabilities, and report any refusals.
 * A traversal layer is emitted only if its kind is in `capabilities.traversal`; provenance only if
 * `capabilities.hasProvenance`. When `capabilities` is omitted, everything requested is computed.
 * Refused layers are returned in `refused` rather than silently dropped — the same honesty
 * principle as graph-ui's rank-and-degrade.
 */
export function computeOverlaysFromIndex(
  index: GraphIndex,
  request: OverlayRequest,
  capabilities?: GraphCapabilities,
): OverlayResult {
  const layers: OverlayLayer[] = [];
  const refused: RefusedOverlay[] = [];
  const kindAllowed = (kind: TraversalKind): boolean => !capabilities || capabilities.traversal.includes(kind);

  const tryKind = (
    active: boolean,
    field: keyof OverlayRequest,
    kind: TraversalKind,
    produce: () => OverlayLayer | null,
  ): void => {
    if (!active) return;
    if (!kindAllowed(kind)) {
      refused.push({ request: field, reason: 'traversal', kind });
      return;
    }
    const layer = produce();
    if (layer) layers.push(layer);
  };

  tryKind(!!request.path, 'path', 'path', () => pathLayer(index, request.path!.source, request.path!.target));
  tryKind(!!request.neighborhood, 'neighborhood', 'neighborhood', () =>
    neighborhoodLayer(index, request.neighborhood!.focus, request.neighborhood!));
  tryKind(!!request.ancestorsOf, 'ancestorsOf', 'ancestors', () => ancestorsLayer(index, request.ancestorsOf!));
  tryKind(!!request.descendantsOf, 'descendantsOf', 'descendants', () => descendantsLayer(index, request.descendantsOf!));
  tryKind(!!request.stale, 'stale', 'stale', () => staleLayer(index, request.stale!));
  tryKind(!!request.cycles, 'cycles', 'cycles', () => cyclesLayer(index));
  tryKind(!!request.components, 'components', 'components', () => componentsLayer(index));
  tryKind(!!request.community, 'community', 'community', () => communityLayer(index));
  tryKind(!!request.criticalPath, 'criticalPath', 'critical-path', () => criticalPathLayer(index));
  tryKind(!!request.centrality, 'centrality', 'centrality', () => centralityLayer(index, request.centrality!));

  if (request.provenanceOf) {
    if (!capabilities || capabilities.hasProvenance) {
      layers.push(provenanceLayer(index, request.provenanceOf));
    } else {
      refused.push({ request: 'provenanceOf', reason: 'provenance' });
    }
  }

  return { overlays: { highlights: layers }, refused };
}
