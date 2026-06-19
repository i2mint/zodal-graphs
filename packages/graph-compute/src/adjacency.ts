/**
 * The traversal index and the graph algorithms it powers.
 *
 * The index is built ONCE, directly from the canonical model's `nodes`/`edges` (ids + endpoints
 * are already there) — it does NOT route through the graphology adapter, which would deep-clone
 * every node/edge payload only to discard it. graphology remains the *rendering* hub (sigma reads
 * it via `@zodal/graph-core`'s adapter); the overlays computed here are keyed by canonical ids and
 * apply to it (or any renderer) unchanged. When community/centrality land later, those will run on
 * a graphology Graph via the graphology-* satellites (per research §3); the reachability core is
 * deliberately hand-rolled and dependency-free.
 *
 * Adjacency is **edge-carrying** (`{to, edge}`) so path/cycle overlays highlight the *exact* edge
 * traversed — essential for multigraphs where several parallel edges connect the same pair.
 * Undirected edges are indexed both ways so reachability is symmetric for them.
 */

import type { CanonicalGraph } from '@zodal/graph-core';

/** One adjacency step: the neighbour node and the edge id taken to reach it. */
export interface AdjEntry {
  to: string;
  edge: string;
}

export interface GraphIndex {
  /** All node ids, in declaration order. */
  readonly nodes: string[];
  /** node → successor steps (includes undirected neighbours). */
  readonly outgoing: ReadonlyMap<string, AdjEntry[]>;
  /** node → predecessor steps (includes undirected neighbours). */
  readonly incoming: ReadonlyMap<string, AdjEntry[]>;
  readonly directed: boolean;
}

/** A node sequence plus the edge ids traversed between consecutive nodes. */
export interface Walk {
  nodes: string[];
  edges: string[];
}

/** Build a {@link GraphIndex} directly from the canonical graph. */
export function buildIndex(graph: CanonicalGraph): GraphIndex {
  const nodes: string[] = [];
  const outgoing = new Map<string, AdjEntry[]>();
  const incoming = new Map<string, AdjEntry[]>();

  const ensure = (m: Map<string, AdjEntry[]>, k: string): AdjEntry[] => {
    let list = m.get(k);
    if (!list) {
      list = [];
      m.set(k, list);
    }
    return list;
  };

  for (const node of graph.nodes) {
    nodes.push(node.id);
    ensure(outgoing, node.id);
    ensure(incoming, node.id);
  }

  for (const edge of graph.edges) {
    ensure(outgoing, edge.source).push({ to: edge.target, edge: edge.id });
    ensure(incoming, edge.target).push({ to: edge.source, edge: edge.id });
    if (!graph.directed) {
      ensure(outgoing, edge.target).push({ to: edge.source, edge: edge.id });
      ensure(incoming, edge.source).push({ to: edge.target, edge: edge.id });
    }
  }

  return { nodes, outgoing, incoming, directed: graph.directed };
}

/**
 * The load-bearing primitive: every node reachable from `start` following `direction` edges.
 * `'forward'` (successors) drives descendants / stale-set; `'backward'` (predecessors) drives
 * ancestors / provenance. Start nodes are EXCLUDED from the result (unless reached via a cycle) so
 * callers can label them distinctly. Iterative BFS with a head pointer — O(V+E), depth-safe.
 */
export function reach(index: GraphIndex, start: string[], direction: 'forward' | 'backward'): Set<string> {
  const adj = direction === 'forward' ? index.outgoing : index.incoming;
  const seen = new Set<string>();
  const queue: string[] = [];
  let head = 0;
  for (const s of start) {
    for (const { to } of adj.get(s) ?? []) {
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  while (head < queue.length) {
    const cur = queue[head++];
    for (const { to } of adj.get(cur) ?? []) {
      if (!seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return seen;
}

/** Traversal direction for neighborhood / ego queries. */
export type Direction = 'forward' | 'backward' | 'both';

/**
 * Bounded k-hop **neighborhood** (ego graph) around a focus set: BFS to depth `radius`, returning
 * each reached node's hop-distance from the focus (focus nodes = 0). `direction` follows
 * successors (`'forward'`), predecessors (`'backward'`), or both (`'both'`, the undirected ego
 * graph). Unlike `reach`, it is *bounded* and *distance-labelled* — the leveled-neighborhood
 * primitive for focusing on a target in a large graph. O(V+E) within the radius. The distance map
 * also powers "expand one more hop" (raise `radius`) and fade-by-distance focus.
 */
export function neighborhood(
  index: GraphIndex,
  focus: string[],
  { radius, direction = 'both' }: { radius: number; direction?: Direction },
): Map<string, number> {
  const dist = new Map<string, number>();
  const queue: string[] = [];
  let head = 0;
  for (const f of focus) {
    if (!dist.has(f)) {
      dist.set(f, 0);
      queue.push(f);
    }
  }
  const stepsOf = (node: string): AdjEntry[] => {
    if (direction === 'forward') return index.outgoing.get(node) ?? [];
    if (direction === 'backward') return index.incoming.get(node) ?? [];
    return [...(index.outgoing.get(node) ?? []), ...(index.incoming.get(node) ?? [])];
  };
  while (head < queue.length) {
    const cur = queue[head++];
    const d = dist.get(cur)!;
    if (d >= radius) continue; // bound the BFS at `radius` hops
    for (const { to } of stepsOf(cur)) {
      if (!dist.has(to)) {
        dist.set(to, d + 1);
        queue.push(to);
      }
    }
  }
  return dist;
}

/** Unweighted shortest path `source → target` (BFS) with the edges traversed, or null. */
export function shortestPath(index: GraphIndex, source: string, target: string): Walk | null {
  if (source === target) return { nodes: [source], edges: [] };
  const prevNode = new Map<string, string>();
  const prevEdge = new Map<string, string>();
  const seen = new Set<string>([source]);
  const queue: string[] = [source];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    for (const { to, edge } of index.outgoing.get(cur) ?? []) {
      if (seen.has(to)) continue;
      seen.add(to);
      prevNode.set(to, cur);
      prevEdge.set(to, edge);
      if (to === target) {
        const nodes = [target];
        const edges: string[] = [];
        let p = target;
        while (prevNode.has(p)) {
          edges.push(prevEdge.get(p)!);
          p = prevNode.get(p)!;
          nodes.push(p);
        }
        return { nodes: nodes.reverse(), edges: edges.reverse() };
      }
      queue.push(to);
    }
  }
  return null;
}

const WHITE = 0;
const GRAY = 1;
const BLACK = 2;

/**
 * Detect one cycle and return its node + edge sets, or null if acyclic. Iterative coloured DFS
 * (explicit stack → depth-safe on long chains). Tracks the *incoming edge* of each frame, so for
 * undirected graphs it skips only the exact edge it arrived on — a SECOND parallel edge back to the
 * parent is correctly recognised as a cycle. Self-loops are detected.
 */
export function findCycle(index: GraphIndex): Walk | null {
  const color = new Map<string, number>();
  for (const n of index.nodes) color.set(n, WHITE);
  const parentNode = new Map<string, string>();
  const parentEdge = new Map<string, string>();

  for (const root of index.nodes) {
    if (color.get(root) !== WHITE) continue;
    color.set(root, GRAY);
    const stack: Array<{ node: string; i: number; inEdge: string | null }> = [
      { node: root, i: 0, inEdge: null },
    ];
    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const adj = index.outgoing.get(frame.node) ?? [];
      if (frame.i >= adj.length) {
        color.set(frame.node, BLACK);
        stack.pop();
        continue;
      }
      const { to, edge } = adj[frame.i++];
      // Undirected: ignore only the single edge we arrived on (not every edge to the parent).
      if (!index.directed && edge === frame.inEdge) continue;
      const c = color.get(to);
      if (c === WHITE) {
        color.set(to, GRAY);
        parentNode.set(to, frame.node);
        parentEdge.set(to, edge);
        stack.push({ node: to, i: 0, inEdge: edge });
      } else if (c === GRAY) {
        // Back edge frame.node → to: collect the tree path to..frame.node plus this closing edge.
        const nodes = new Set<string>([to]);
        const edges = new Set<string>([edge]);
        let x = frame.node;
        while (x !== to) {
          nodes.add(x);
          edges.add(parentEdge.get(x)!);
          x = parentNode.get(x)!;
        }
        return { nodes: [...nodes], edges: [...edges] };
      }
    }
  }
  return null;
}

/** Kahn's topological order, or null if the graph has a cycle. (Directed graphs.) */
export function topologicalOrder(index: GraphIndex): string[] | null {
  const indeg = new Map<string, number>();
  for (const n of index.nodes) indeg.set(n, 0);
  for (const n of index.nodes) {
    for (const { to } of index.outgoing.get(n) ?? []) indeg.set(to, (indeg.get(to) ?? 0) + 1);
  }
  const queue = index.nodes.filter((n) => (indeg.get(n) ?? 0) === 0);
  const order: string[] = [];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    order.push(u);
    for (const { to } of index.outgoing.get(u) ?? []) {
      const d = (indeg.get(to) ?? 0) - 1;
      indeg.set(to, d);
      if (d === 0) queue.push(to);
    }
  }
  return order.length === index.nodes.length ? order : null;
}

/** Weakly-connected components (reachability ignoring edge direction). */
export function connectedComponents(index: GraphIndex): string[][] {
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const start of index.nodes) {
    if (seen.has(start)) continue;
    const component: string[] = [];
    const queue: string[] = [start];
    seen.add(start);
    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];
      component.push(u);
      const steps = [...(index.outgoing.get(u) ?? []), ...(index.incoming.get(u) ?? [])];
      for (const { to } of steps) {
        if (!seen.has(to)) {
          seen.add(to);
          queue.push(to);
        }
      }
    }
    components.push(component);
  }
  return components;
}
