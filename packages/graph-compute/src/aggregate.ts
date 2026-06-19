/**
 * Aggregation (issue #28): fold a big graph into a readable meta-graph. `aggregate` groups every
 * node by a key (a field or a function) into one meta-node per group, with **weighted meta-edges**
 * (weight = number of original edges crossing between the two groups). `collapse` folds one chosen
 * set of nodes into a single meta-node while keeping the rest of the graph intact (incremental
 * exploration / expand↔collapse). Both return a `CanonicalGraph` so the result renders and lays out
 * like any other graph, plus a `members` map (meta-node id → original node ids) for expansion.
 *
 * This is the renderer-agnostic complement to a WebGL renderer's raw scale, and the substrate for a
 * group-by / semantic-zoom UI: a 2k-node hairball becomes a ~14-node type meta-graph.
 */

import type { CanonicalGraph, GraphNode } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';

/** A grouping key for a node: a field path (`'type'`, `'kind'`, `'scope'`, `'data.scope'`) or a fn. */
export type GroupBy = string | ((node: GraphNode) => string | number | null | undefined);

export interface AggregateResult {
  /** The meta-graph: one `type: 'group'` node per group, weighted `type: 'aggregate'` meta-edges. */
  graph: CanonicalGraph;
  /** meta-node id → the original node ids it subsumes (for expand). */
  members: Record<string, string[]>;
}

function fieldOf(node: GraphNode, field: string): unknown {
  if (field === 'id') return node.id;
  if (field === 'type') return node.type;
  if (field === 'kind') return node.kind;
  const key = field.startsWith('data.') ? field.slice(5) : field;
  const data = (node as { data?: Record<string, unknown> }).data;
  return data ? data[key] : undefined;
}

const keyFn = (groupBy: GroupBy): ((n: GraphNode) => string | number | null | undefined) =>
  typeof groupBy === 'function' ? groupBy : (n) => fieldOf(n, groupBy) as string | number | null | undefined;

/**
 * Group every node by `groupBy` into a meta-graph. Nodes whose key is null/undefined are dropped
 * (and edges touching them with them). Intra-group edges are omitted; cross-group edges are summed
 * into one weighted meta-edge per ordered group pair. `includeSingletons=false` drops groups of
 * size 1 (and re-drops their edges) for a terser overview.
 */
export function aggregate(
  graph: CanonicalGraph,
  groupBy: GroupBy,
  { includeSingletons = true }: { includeSingletons?: boolean } = {},
): AggregateResult {
  const key = keyFn(groupBy);
  const groupOf = new Map<string, string>();
  const members: Record<string, string[]> = {};
  for (const node of graph.nodes) {
    const k = key(node);
    if (k === null || k === undefined) continue;
    const g = String(k);
    groupOf.set(node.id, g);
    (members[g] ??= []).push(node.id);
  }

  let keep = new Set(Object.keys(members));
  if (!includeSingletons) keep = new Set([...keep].filter((g) => members[g].length > 1));

  const metaId = (g: string) => `meta:${g}`;
  const nodes: GraphNode[] = [...keep].map((g) => ({
    id: nodeId(metaId(g)),
    kind: 'entity' as const,
    type: 'group',
    data: { label: g, group: g, count: members[g].length },
  }));

  const weights = new Map<string, { source: string; target: string; weight: number }>();
  for (const e of graph.edges) {
    const sg = groupOf.get(e.source);
    const tg = groupOf.get(e.target);
    if (sg === undefined || tg === undefined || sg === tg || !keep.has(sg) || !keep.has(tg)) continue;
    const k = JSON.stringify([sg, tg]);
    const cur = weights.get(k) ?? { source: metaId(sg), target: metaId(tg), weight: 0 };
    cur.weight += 1;
    weights.set(k, cur);
  }
  const edges = [...weights.values()].map((w, i) => ({
    id: edgeId(`metaedge:${i}`),
    source: nodeId(w.source),
    target: nodeId(w.target),
    type: 'aggregate',
    data: { weight: w.weight },
  }));

  const kept: Record<string, string[]> = {};
  for (const g of keep) kept[metaId(g)] = members[g];
  return {
    graph: { directed: graph.directed, multigraph: false, nodes, edges, graph: {} },
    members: kept,
  };
}

/**
 * Collapse a chosen set of nodes into a single meta-node, keeping every other node intact and
 * rewiring edges: any edge with exactly one endpoint inside the set is redirected to the meta-node;
 * edges fully inside the set are dropped; parallel results are merged into weighted meta-edges. The
 * inverse of an expand. `metaId` defaults to `meta:<first id>`; `label` defaults to the count.
 */
export function collapse(
  graph: CanonicalGraph,
  nodeIds: string[],
  { metaId, label }: { metaId?: string; label?: string } = {},
): AggregateResult {
  const inSet = new Set(nodeIds);
  const mid = metaId ?? `meta:${nodeIds[0] ?? 'group'}`;
  const remap = (id: string) => (inSet.has(id) ? mid : id);
  // Guard: if mid equals a surviving node's id, the output would have a duplicate id AND external
  // edges to that node would be misclassified as internal and dropped. Refuse rather than corrupt.
  const survivors = new Set(graph.nodes.filter((n) => !inSet.has(n.id)).map((n) => String(n.id)));
  if (survivors.has(mid)) {
    throw new Error(`collapse: metaId "${mid}" collides with an existing node id — pass a unique metaId.`);
  }

  const nodes: GraphNode[] = graph.nodes
    .filter((n) => !inSet.has(n.id))
    .map((n) => ({ ...n }));
  nodes.push({
    id: nodeId(mid),
    kind: 'entity',
    type: 'group',
    data: { label: label ?? `${nodeIds.length} nodes`, count: nodeIds.length },
  });

  // rewire: drop fully-internal edges; merge parallels created by remapping into weighted edges
  const weights = new Map<string, { source: string; target: string; type?: string; weight: number }>();
  const passthrough: typeof graph.edges = [];
  for (const e of graph.edges) {
    const s = remap(e.source);
    const t = remap(e.target);
    if (s === mid && t === mid) continue; // internal — dropped
    if (s !== mid && t !== mid) {
      passthrough.push({ ...e });
      continue;
    }
    const k = JSON.stringify([s, t]);
    const cur = weights.get(k) ?? { source: s, target: t, weight: 0 };
    cur.weight += 1;
    weights.set(k, cur);
  }
  const merged = [...weights.values()].map((w, i) => ({
    id: edgeId(`meta:${mid}:${i}`),
    source: nodeId(w.source),
    target: nodeId(w.target),
    type: 'aggregate',
    data: { weight: w.weight },
  }));

  return {
    graph: {
      directed: graph.directed,
      multigraph: graph.multigraph,
      nodes,
      edges: [...passthrough, ...merged],
      graph: {},
    },
    members: { [mid]: [...nodeIds] },
  };
}
