/**
 * Declarative filtering — turn a `GraphFilter` predicate into a `GraphSelection` (+ a fade
 * `GraphOverlays`), plus faceting and search/locate. Renderer-agnostic: the same filter drives
 * every lens. `'hide'` mode yields the matching subgraph's ids; `'fade'` keeps the structure and
 * dims non-matching elements (focus + context), the same overlay mechanism as traversal.
 */

import type {
  CanonicalGraph,
  GraphEdge,
  GraphFilter,
  GraphNode,
  GraphOverlays,
  GraphSelection,
  FilterPredicate,
} from '@zodal/graph-core';

/** Read a field off a node/edge: id/type/kind/source/target, or a `data` key (`scope` or `data.scope`). */
function getField(el: GraphNode | GraphEdge, field: string): unknown {
  switch (field) {
    case 'id':
      return el.id;
    case 'type':
      return el.type;
    case 'kind':
      return (el as GraphNode).kind;
    case 'source':
      return (el as GraphEdge).source;
    case 'target':
      return (el as GraphEdge).target;
    default: {
      const key = field.startsWith('data.') ? field.slice(5) : field;
      const data = (el as { data?: Record<string, unknown> }).data;
      return data ? data[key] : undefined;
    }
  }
}

const asNum = (v: unknown): number | null => (typeof v === 'number' ? v : null);

/** Evaluate a predicate against one element. */
export function matches(el: GraphNode | GraphEdge, pred: FilterPredicate): boolean {
  if ('all' in pred) return pred.all.every((p) => matches(el, p));
  if ('any' in pred) return pred.any.some((p) => matches(el, p));
  if ('not' in pred) return !matches(el, pred.not);
  const v = getField(el, pred.field);
  const w = pred.value;
  switch (pred.op) {
    case 'exists':
      return v !== undefined && v !== null;
    case 'eq':
      return v === w;
    case 'ne':
      return v !== w;
    case 'in':
      return Array.isArray(w) && w.includes(v);
    case 'contains':
      return typeof v === 'string' && typeof w === 'string' && v.toLowerCase().includes(w.toLowerCase());
    case 'lt':
      return asNum(v) !== null && asNum(w) !== null && (v as number) < (w as number);
    case 'lte':
      return asNum(v) !== null && asNum(w) !== null && (v as number) <= (w as number);
    case 'gt':
      return asNum(v) !== null && asNum(w) !== null && (v as number) > (w as number);
    case 'gte':
      return asNum(v) !== null && asNum(w) !== null && (v as number) >= (w as number);
    default:
      return false;
  }
}

/** The result of applying a filter: matched ids, a fade overlay, and live counts. */
export interface FilterResult {
  selection: GraphSelection;
  overlays: GraphOverlays;
  counts: { nodes: number; edges: number };
}

/**
 * Apply `filter` to `graph`. Nodes matching `filter.nodes` (or all) are selected; edges matching
 * `filter.edges` are selected, or — when `edges` is omitted — the edges induced by the matched
 * node set. In `'fade'` mode (default) a single `'filter'` overlay layer marks every NON-matching
 * node/edge `'dimmed'`; in `'hide'` mode the overlay is empty and the selection IS the subgraph.
 */
export function applyFilter(graph: CanonicalGraph, filter: GraphFilter): FilterResult {
  const matchedNodes = new Set<string>();
  for (const node of graph.nodes) {
    if (!filter.nodes || matches(node, filter.nodes)) matchedNodes.add(node.id);
  }
  const matchedEdges = new Set<string>();
  for (const edge of graph.edges) {
    const ok = filter.edges
      ? matches(edge, filter.edges)
      : matchedNodes.has(edge.source) && matchedNodes.has(edge.target);
    if (ok) matchedEdges.add(edge.id);
  }

  const selection: GraphSelection = {
    nodes: [...matchedNodes],
    edges: [...matchedEdges],
    name: 'filter',
  };

  const overlays: GraphOverlays = { highlights: [] };
  if ((filter.mode ?? 'fade') === 'fade') {
    const nodes: Record<string, string> = {};
    const edges: Record<string, string> = {};
    for (const n of graph.nodes) if (!matchedNodes.has(n.id)) nodes[n.id] = 'dimmed';
    for (const e of graph.edges) if (!matchedEdges.has(e.id)) edges[e.id] = 'dimmed';
    overlays.highlights.push({ layer: 'filter', nodes, edges });
  }

  return { selection, overlays, counts: { nodes: matchedNodes.size, edges: matchedEdges.size } };
}

/** Count nodes (or edges) by the distinct values of a field — for faceted filtering UIs. */
export function facet(
  graph: CanonicalGraph,
  field: string,
  target: 'node' | 'edge' = 'node',
): Record<string, number> {
  const els: (GraphNode | GraphEdge)[] = target === 'edge' ? graph.edges : graph.nodes;
  const counts: Record<string, number> = {};
  for (const el of els) {
    const v = getField(el, field);
    const key = v === undefined || v === null ? '∅' : String(v);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Search/locate: node ids whose listed `fields` contain `query` (case-insensitive substring).
 * Defaults to id + type + every node's `data` values. For wiring search-and-centre in a renderer.
 */
export function search(
  graph: CanonicalGraph,
  query: string,
  opts: { fields?: string[] } = {},
): string[] {
  const q = query.toLowerCase();
  if (!q) return [];
  const hits: string[] = [];
  for (const node of graph.nodes) {
    const haystacks: string[] = opts.fields
      ? opts.fields.map((f) => String(getField(node, f) ?? ''))
      : [
          String(node.id),
          String(node.type ?? ''),
          ...Object.values((node.data ?? {}) as Record<string, unknown>).map(String),
        ];
    if (haystacks.some((h) => h.toLowerCase().includes(q))) hits.push(node.id);
  }
  return hits;
}
