/**
 * The layout engine — *applies* a `GraphLayout` hint to a canonical graph and returns node
 * positions. Renderer-agnostic and dependency-free: positions are written back into the
 * presentation layer (`GraphLayout.positions`) so any renderer (sigma, React Flow, …) can place
 * nodes without each reimplementing layout. Reuses `@zodal/graph-compute` for ranking
 * (`topologicalOrder`) and ego rings (`neighborhood`).
 *
 * Algorithms (by `GraphLayout.algorithm`):
 *  - `hierarchical` / `dagre` / `elk` → **layered-by-rank** (longest-path depth, or a custom
 *    `rankBy`); ideal for leveled DAGs. `direction` (TB/LR/BT/RL) orients the ranks.
 *  - `radial` → **ego rings** by hop-distance from a focus set (focus at centre).
 *  - `swimlane` → **lanes** partitioned by a categorical field (default: node `type`).
 *  - `circular` → all nodes on one ring. `force` falls back to `circular` (wrap a force lib later).
 *  - `preset` → use the spec's own `positions`.
 */

import type { CanonicalGraph, GraphLayout } from '@zodal/graph-core';
import { buildIndex, topologicalOrder, neighborhood, type GraphIndex } from '@zodal/graph-compute';

export interface Position {
  x: number;
  y: number;
}
export type Positions = Record<string, Position>;

export interface LayoutOptions {
  /** Distance between successive ranks (layered) / lanes (swimlane) / rings (radial). */
  rankSep?: number;
  /** Distance between nodes within a rank / lane / circle. */
  nodeSep?: number;
  /**
   * Layered: a node's rank key (number → used directly; string/other → ordered categorically).
   * Swimlane: a node's lane key. Default: the node's `type` (swimlane) / longest-path depth (layered).
   */
  rankBy?: (nodeId: string, graph: CanonicalGraph) => number | string;
  /** Radial: focus node id(s) placed at the centre (overrides `spec.params.focus`). */
  focus?: string[];
  /** Radial: max ring to lay out reachable nodes into (default: cover the whole graph). */
  radius?: number;
}

const DEFAULT_RANK_SEP = 160;
const DEFAULT_NODE_SEP = 80;

/** Apply `spec` to `graph`, returning positions keyed by node id. */
export function layout(graph: CanonicalGraph, spec: GraphLayout, opts: LayoutOptions = {}): Positions {
  switch (spec.algorithm) {
    case 'preset':
      return { ...(spec.positions ?? {}) };
    case 'radial':
      return radial(graph, spec, opts);
    case 'swimlane':
      return swimlane(graph, spec, opts);
    case 'circular':
    case 'force': // no bundled force engine yet — circular is the honest fallback
      return circular(graph, opts);
    case 'hierarchical':
    case 'dagre':
    case 'elk':
    default:
      return layered(graph, spec, opts);
  }
}

/** Convenience: return a copy of `spec` with computed `positions` filled in. */
export function applyLayout(
  graph: CanonicalGraph,
  spec: GraphLayout,
  opts: LayoutOptions = {},
): GraphLayout {
  return { ...spec, positions: layout(graph, spec, opts) };
}

// --- helpers -----------------------------------------------------------------

function push<K>(m: Map<K, string[]>, k: K, v: string): void {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}

const isHorizontal = (dir?: string): boolean => dir === 'LR' || dir === 'RL';
const isReversed = (dir?: string): boolean => dir === 'BT' || dir === 'RL';

/** Longest-path depth per node (0 at sources). Falls back to all-0 if the graph is cyclic. */
function longestPathRank(index: GraphIndex): Map<string, number> {
  const rank = new Map<string, number>(index.nodes.map((n) => [n, 0]));
  const order = topologicalOrder(index);
  if (!order) return rank; // cyclic — single rank; caller can pass rankBy
  for (const u of order) {
    const ru = rank.get(u)!;
    for (const { to } of index.outgoing.get(u) ?? []) {
      if ((rank.get(to) ?? 0) < ru + 1) rank.set(to, ru + 1);
    }
  }
  return rank;
}

/** Map arbitrary rank keys to contiguous integer ranks (numbers kept, others ordered). */
function integerRanks(raw: Map<string, number | string>): Map<string, number> {
  const allNumeric = [...raw.values()].every((v) => typeof v === 'number');
  if (allNumeric) return raw as Map<string, number>;
  const distinct = [...new Set([...raw.values()])].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );
  const index = new Map(distinct.map((v, i) => [v, i]));
  return new Map([...raw].map(([id, v]) => [id, index.get(v)!]));
}

function layered(graph: CanonicalGraph, spec: GraphLayout, opts: LayoutOptions): Positions {
  const index = buildIndex(graph);
  const rankSep = opts.rankSep ?? DEFAULT_RANK_SEP;
  const nodeSep = opts.nodeSep ?? DEFAULT_NODE_SEP;
  const rankOf = opts.rankBy
    ? integerRanks(new Map(index.nodes.map((id) => [id, opts.rankBy!(id, graph)])))
    : longestPathRank(index);

  const byRank = new Map<number, string[]>();
  for (const id of index.nodes) push(byRank, rankOf.get(id) ?? 0, id);

  const horizontal = isHorizontal(spec.direction);
  const reversed = isReversed(spec.direction);
  const pos: Positions = {};
  for (const [r, ids] of [...byRank].sort((a, b) => a[0] - b[0])) {
    const across = (reversed ? -r : r) * rankSep;
    ids.forEach((id, i) => {
      const along = (i - (ids.length - 1) / 2) * nodeSep;
      pos[id] = horizontal ? { x: across, y: along } : { x: along, y: across };
    });
  }
  return pos;
}

function radial(graph: CanonicalGraph, spec: GraphLayout, opts: LayoutOptions): Positions {
  const index = buildIndex(graph);
  const ringSep = opts.rankSep ?? DEFAULT_RANK_SEP;
  const focus =
    opts.focus ??
    (Array.isArray(spec.params?.focus) ? (spec.params!.focus as string[]) : undefined) ??
    index.nodes.slice(0, 1);
  const dist = neighborhood(index, focus, {
    radius: opts.radius ?? index.nodes.length,
    direction: 'both',
  });

  const byRing = new Map<number, string[]>();
  for (const id of index.nodes) push(byRing, dist.get(id) ?? -1, id); // -1 = unreached
  const maxRing = Math.max(0, ...[...byRing.keys()].filter((r) => r >= 0));

  const pos: Positions = {};
  for (const [ring, ids] of byRing) {
    const radius = (ring < 0 ? maxRing + 1 : ring) * ringSep;
    if (ring === 0 && ids.length === 1) {
      pos[ids[0]] = { x: 0, y: 0 };
      continue;
    }
    ids.forEach((id, i) => {
      const theta = (i / ids.length) * 2 * Math.PI;
      pos[id] = { x: radius * Math.cos(theta), y: radius * Math.sin(theta) };
    });
  }
  return pos;
}

function swimlane(graph: CanonicalGraph, spec: GraphLayout, opts: LayoutOptions): Positions {
  const index = buildIndex(graph);
  const laneSep = opts.rankSep ?? DEFAULT_RANK_SEP + 60;
  const nodeSep = opts.nodeSep ?? DEFAULT_NODE_SEP;
  const typeOf = new Map<string, string>(graph.nodes.map((n) => [String(n.id), n.type ?? '∅']));
  const laneBy = opts.rankBy ?? ((id: string) => String(typeOf.get(id) ?? '∅'));

  const laneKey = new Map(index.nodes.map((id) => [id, String(laneBy(id, graph))]));
  const lanes = [...new Set([...laneKey.values()])].sort((a, b) => a.localeCompare(b));
  const laneIndex = new Map(lanes.map((l, i) => [l, i]));
  const counters = new Map<string, number>();

  const horizontal = isHorizontal(spec.direction);
  const pos: Positions = {};
  for (const id of index.nodes) {
    const lane = laneKey.get(id)!;
    const k = counters.get(lane) ?? 0;
    counters.set(lane, k + 1);
    const laneCoord = laneIndex.get(lane)! * laneSep;
    const along = k * nodeSep;
    pos[id] = horizontal ? { x: along, y: laneCoord } : { x: laneCoord, y: along };
  }
  return pos;
}

function circular(graph: CanonicalGraph, opts: LayoutOptions): Positions {
  const ids = graph.nodes.map((n) => n.id);
  const n = ids.length || 1;
  const sep = opts.nodeSep ?? DEFAULT_NODE_SEP;
  const radius = (sep * n) / (2 * Math.PI);
  const pos: Positions = {};
  ids.forEach((id, i) => {
    const theta = (i / n) * 2 * Math.PI;
    pos[id] = { x: radius * Math.cos(theta), y: radius * Math.sin(theta) };
  });
  return pos;
}
