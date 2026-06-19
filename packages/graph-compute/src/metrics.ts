/**
 * Importance & structure metrics (issue #29): centrality (degree / PageRank / betweenness),
 * community detection (label propagation), critical path (longest weighted DAG path), and a
 * degree-of-interest score. All hand-rolled on the dependency-free {@link GraphIndex} — consistent
 * with the reachability core, no graphology dependency (a recorded deviation from research §3,
 * which suggested graphology-* satellites; the index already carries everything these need).
 *
 * These return raw score maps (not overlays) so consumers can drive data-driven styling — size a
 * node by PageRank, colour by community — via `@zodal/graph-core`'s `GraphStyling`. Overlay
 * producers (community bands, the critical-path highlight, a top-centrality highlight) live in
 * `overlays.ts`.
 */

import { topologicalOrder, neighborhood, type GraphIndex, type Walk } from './adjacency.js';

export type CentralityKind = 'degree' | 'pagerank' | 'betweenness';

/** Degree centrality: number of incident edges per node (`'all'` = in + out). Parallel edges are
 *  counted with multiplicity (each adjacency entry counts); undirected edges are indexed both ways. */
export function degreeCentrality(
  index: GraphIndex,
  mode: 'in' | 'out' | 'all' = 'all',
): Map<string, number> {
  const out = new Map<string, number>();
  for (const n of index.nodes) {
    const o = index.outgoing.get(n)?.length ?? 0;
    const i = index.incoming.get(n)?.length ?? 0;
    out.set(n, mode === 'out' ? o : mode === 'in' ? i : o + i);
  }
  return out;
}

/**
 * PageRank via power iteration (damping `d`). Dangling nodes (no out-edges) redistribute their
 * mass uniformly so the vector stays a distribution. Stops at `tolerance` (L1) or `iterations`.
 */
export function pagerank(
  index: GraphIndex,
  { damping = 0.85, iterations = 100, tolerance = 1e-6 }: {
    damping?: number;
    iterations?: number;
    tolerance?: number;
  } = {},
): Map<string, number> {
  const nodes = index.nodes;
  const n = nodes.length;
  const rank = new Map<string, number>(nodes.map((v) => [v, 1 / n]));
  if (n === 0) return rank;
  // out-degree = number of outgoing adjacency entries; parallel edges are weighted by MULTIPLICITY
  // (a node linked by k parallel edges receives k× the per-edge share — a weighted random surfer).
  // This matches degree centrality and the index's deliberate multi-edge support; betweenness, by
  // contrast, dedupes parallel edges. Mass is conserved either way.
  const outDeg = new Map<string, number>(
    nodes.map((v) => [v, index.outgoing.get(v)?.length ?? 0]),
  );
  const base = (1 - damping) / n;

  for (let it = 0; it < iterations; it++) {
    const next = new Map<string, number>(nodes.map((v) => [v, base]));
    let dangling = 0;
    for (const v of nodes) {
      const r = rank.get(v)!;
      const deg = outDeg.get(v)!;
      if (deg === 0) {
        dangling += r;
        continue;
      }
      const share = (damping * r) / deg;
      for (const { to } of index.outgoing.get(v) ?? []) {
        next.set(to, (next.get(to) ?? 0) + share);
      }
    }
    if (dangling > 0) {
      const spread = (damping * dangling) / n;
      for (const v of nodes) next.set(v, next.get(v)! + spread);
    }
    let delta = 0;
    for (const v of nodes) delta += Math.abs(next.get(v)! - rank.get(v)!);
    for (const v of nodes) rank.set(v, next.get(v)!);
    if (delta < tolerance) break;
  }
  return rank;
}

/**
 * Betweenness centrality via Brandes' algorithm (unweighted, shortest-path counting over the
 * directed successor relation). `normalized` divides by (n-1)(n-2) so values are comparable across
 * graph sizes. O(V·E).
 */
export function betweenness(
  index: GraphIndex,
  { normalized = true }: { normalized?: boolean } = {},
): Map<string, number> {
  const nodes = index.nodes;
  const cb = new Map<string, number>(nodes.map((v) => [v, 0]));

  for (const s of nodes) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>(nodes.map((v) => [v, []]));
    const sigma = new Map<string, number>(nodes.map((v) => [v, 0]));
    const dist = new Map<string, number>(nodes.map((v) => [v, -1]));
    sigma.set(s, 1);
    dist.set(s, 0);
    const queue: string[] = [s];
    let head = 0;
    while (head < queue.length) {
      const v = queue[head++];
      stack.push(v);
      // Dedupe parallel/multi edges: in shortest-path counting, k parallel v→w edges are ONE path,
      // not k, so each distinct successor contributes to sigma/pred exactly once (unlike
      // degree/PageRank, which weight parallel edges by multiplicity).
      for (const w of new Set((index.outgoing.get(v) ?? []).map((entry) => entry.to))) {
        if (dist.get(w)! < 0) {
          dist.set(w, dist.get(v)! + 1);
          queue.push(w);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }
    const delta = new Map<string, number>(nodes.map((v) => [v, 0]));
    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      }
      if (w !== s) cb.set(w, cb.get(w)! + delta.get(w)!);
    }
  }

  if (normalized && nodes.length > 2) {
    const scale = 1 / ((nodes.length - 1) * (nodes.length - 2));
    for (const v of nodes) cb.set(v, cb.get(v)! * scale);
  }
  return cb;
}

/**
 * Community detection by **label propagation** (deterministic): each node adopts the most frequent
 * label among its undirected neighbours; ties break to the smallest label; iterate to a fixed point
 * (or `iterations`). Returns a map node → community index (relabelled 0..k-1 in first-seen order).
 */
export function community(
  index: GraphIndex,
  { iterations = 50 }: { iterations?: number } = {},
): Map<string, number> {
  const nodes = index.nodes;
  const label = new Map<string, string>(nodes.map((v) => [v, v]));
  const neighbours = (v: string): string[] => [
    ...(index.outgoing.get(v) ?? []).map((e) => e.to),
    ...(index.incoming.get(v) ?? []).map((e) => e.to),
  ];

  for (let it = 0; it < iterations; it++) {
    let changed = false;
    for (const v of nodes) {
      const counts = new Map<string, number>();
      for (const w of neighbours(v)) {
        const l = label.get(w)!;
        counts.set(l, (counts.get(l) ?? 0) + 1);
      }
      if (counts.size === 0) continue;
      let best = label.get(v)!;
      let bestCount = -1;
      for (const [l, c] of counts) {
        if (c > bestCount || (c === bestCount && l < best)) {
          best = l;
          bestCount = c;
        }
      }
      if (best !== label.get(v)) {
        label.set(v, best);
        changed = true;
      }
    }
    if (!changed) break;
  }

  // relabel to contiguous community indices in first-seen order
  const idOf = new Map<string, number>();
  const out = new Map<string, number>();
  for (const v of nodes) {
    const l = label.get(v)!;
    if (!idOf.has(l)) idOf.set(l, idOf.size);
    out.set(v, idOf.get(l)!);
  }
  return out;
}

/**
 * Critical path: the longest (most-weighted) path through a DAG. `weightOf(edgeId)` defaults to 1
 * (longest by hop count). Returns the path as a {@link Walk}, or `null` if the graph has a cycle.
 */
export function criticalPath(
  index: GraphIndex,
  weightOf: (edgeId: string) => number = () => 1,
): Walk | null {
  const order = topologicalOrder(index);
  if (!order) return null; // cyclic — no well-defined longest path
  const dist = new Map<string, number>(index.nodes.map((v) => [v, 0]));
  const prevNode = new Map<string, string>();
  const prevEdge = new Map<string, string>();
  let best = order[0] ?? null;
  for (const u of order) {
    for (const { to, edge } of index.outgoing.get(u) ?? []) {
      const cand = dist.get(u)! + weightOf(edge);
      if (cand > (dist.get(to) ?? 0)) {
        dist.set(to, cand);
        prevNode.set(to, u);
        prevEdge.set(to, edge);
      }
    }
    if (best === null || dist.get(u)! > dist.get(best)!) best = u;
  }
  if (best === null) return null;
  const nodes: string[] = [best];
  const edges: string[] = [];
  let cur = best;
  while (prevNode.has(cur)) {
    edges.push(prevEdge.get(cur)!);
    cur = prevNode.get(cur)!;
    nodes.push(cur);
  }
  return { nodes: nodes.reverse(), edges: edges.reverse() };
}

/**
 * Degree-of-interest (Furnas): rank nodes by a-priori importance minus structural distance from a
 * focus set — the policy for *what to surface first* on a huge graph. `apriori` defaults to degree
 * centrality. `doi(x) = centralityWeight·apriori(x) − distanceDecay·hopDistance(x, focus)`; nodes
 * unreachable from the focus get the most negative distance term.
 */
export function degreeOfInterest(
  index: GraphIndex,
  focus: string[],
  {
    apriori,
    centralityWeight = 1,
    distanceDecay = 1,
  }: { apriori?: Map<string, number>; centralityWeight?: number; distanceDecay?: number } = {},
): Map<string, number> {
  const api = apriori ?? degreeCentrality(index, 'all');
  const dist = neighborhood(index, focus, { radius: index.nodes.length, direction: 'both' });
  const far = index.nodes.length + 1;
  const out = new Map<string, number>();
  for (const v of index.nodes) {
    const d = dist.get(v) ?? far;
    out.set(v, centralityWeight * (api.get(v) ?? 0) - distanceDecay * d);
  }
  return out;
}
