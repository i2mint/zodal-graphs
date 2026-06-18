/**
 * Table data shaping — the renderer-agnostic backbone of the "not-a-graph" table lens.
 *
 * `switch-to-table-view` is the single most universal affordance (every graph wants it). The table
 * itself is well-trodden (TanStack Table); the renderer-independent value is turning a canonical
 * graph into row arrays + column descriptors, which a consumer feeds to whatever grid they use. No
 * React / TanStack import.
 */

import type { CanonicalGraph } from '@zodal/graph-core';

export interface NodeRow {
  id: string;
  kind: string;
  type?: string;
  [key: string]: unknown;
}

export interface EdgeRow {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  type?: string;
  [key: string]: unknown;
}

export interface ColumnDef {
  id: string;
  accessor: string;
  header: string;
}

/** Flatten nodes into table rows (node fields + spread `data`). */
export function toNodeRows(graph: CanonicalGraph): NodeRow[] {
  return graph.nodes.map((node) => {
    const row: NodeRow = { id: node.id, kind: node.kind };
    if (node.type !== undefined) row.type = node.type;
    if (isPlainObject(node.data)) Object.assign(row, node.data);
    return row;
  });
}

/** Flatten edges into an edge-list table (endpoints + ports + spread `data`). */
export function toEdgeRows(graph: CanonicalGraph): EdgeRow[] {
  return graph.edges.map((edge) => {
    const row: EdgeRow = { id: edge.id, source: edge.source, target: edge.target };
    if (edge.sourcePort !== undefined) row.sourcePort = edge.sourcePort;
    if (edge.targetPort !== undefined) row.targetPort = edge.targetPort;
    if (edge.type !== undefined) row.type = edge.type;
    if (isPlainObject(edge.data)) Object.assign(row, edge.data);
    return row;
  });
}

/** Derive column descriptors from the union of keys across rows (first-seen order). */
export function inferColumns(rows: ReadonlyArray<Record<string, unknown>>): ColumnDef[] {
  const seen = new Set<string>();
  const columns: ColumnDef[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push({ id: key, accessor: key, header: humanize(key) });
      }
    }
  }
  return columns;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `sourcePort` → `Source Port`, `id` → `ID`, `node_label` → `Node Label`. */
function humanize(key: string): string {
  if (key === 'id') return 'ID';
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.replace(/^\w/, (c) => c.toUpperCase());
}
