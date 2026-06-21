/**
 * Adjacency-matrix data shaping + seriation — the renderer-agnostic backbone of the matrix lens.
 *
 * For dense-ish small/medium graphs a node×node matrix is often the RIGHT operable surface (the
 * "not-a-graph" insight). This builds the matrix and reorders rows/cols (seriation) so clusters
 * appear as blocks on the diagonal — the part no off-the-shelf grid does. The consumer renders the
 * cells (a thin heat-cell layer). No React import.
 */

import type { CanonicalGraph } from '@zodal/graph-core';

export interface AdjacencyMatrix {
  /** Node ids in row/column order. */
  order: string[];
  /** `cells[i][j]` = aggregated weight/count of edges from `order[i]` to `order[j]`. */
  cells: number[][];
}

export interface MatrixOptions {
  /** Edge `data` field to use as the cell weight; defaults to counting edges (1 each). */
  weight?: string;
  /** Mirror cells across the diagonal. Defaults to `!graph.directed`. */
  undirected?: boolean;
}

/** Build an N×N adjacency matrix from the canonical graph (rows/cols in node-declaration order). */
export function toAdjacencyMatrix(graph: CanonicalGraph, options: MatrixOptions = {}): AdjacencyMatrix {
  const order = graph.nodes.map((n) => n.id as string);
  const index = new Map(order.map((id, i) => [id, i]));
  const n = order.length;
  const cells = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  const undirected = options.undirected ?? !graph.directed;

  for (const edge of graph.edges) {
    const i = index.get(edge.source);
    const j = index.get(edge.target);
    if (i === undefined || j === undefined) continue; // edge to an undeclared node — skipped
    const weight = options.weight ? toWeight((edge.data as Record<string, unknown> | undefined)?.[options.weight]) : 1;
    cells[i][j] += weight;
    if (undirected && i !== j) cells[j][i] += weight; // don't double-count a self-loop on the diagonal
  }

  return { order, cells };
}

export type SeriationMethod = 'degree' | 'cuthill-mckee';

/**
 * Reorder the matrix's node ids to surface structure. Returns a permutation of `matrix.order`:
 *  - `'degree'`: by total degree descending (hubs first) — cheap, reveals high-degree groups.
 *  - `'cuthill-mckee'`: a bandwidth-reducing BFS ordering that groups connected nodes into
 *    diagonal blocks (the default — best for cluster reveal).
 */
export function seriate(matrix: AdjacencyMatrix, method: SeriationMethod = 'cuthill-mckee'): string[] {
  const degrees = nodeDegrees(matrix);
  if (method === 'degree') {
    return [...matrix.order.keys()].sort((a, b) => degrees[b] - degrees[a]).map((i) => matrix.order[i]);
  }
  return cuthillMckee(matrix, degrees).map((i) => matrix.order[i]);
}

/**
 * Permute a matrix's rows AND columns into the given node order (typically a {@link seriate} result),
 * so `cells` is reindexed consistently. Ids in `order` that aren't in the matrix are dropped; missing
 * ones are appended in their original position. Returns a new matrix (the input is untouched).
 */
export function reorderMatrix(matrix: AdjacencyMatrix, order: readonly string[]): AdjacencyMatrix {
  const original = new Map(matrix.order.map((id, i) => [id, i]));
  const indices = order.map((id) => original.get(id)).filter((i): i is number => i !== undefined);
  for (let i = 0; i < matrix.order.length; i++) if (!indices.includes(i)) indices.push(i); // keep any omitted
  const newOrder = indices.map((i) => matrix.order[i]);
  const cells = indices.map((i) => indices.map((j) => matrix.cells[i][j]));
  return { order: newOrder, cells };
}

// === internals ============================================================

/** Adjacency by edge EXISTENCE (`cell !== 0`), so zero/negative-weighted real edges still count. */
function isLinked(matrix: AdjacencyMatrix, i: number, j: number): boolean {
  return i !== j && (matrix.cells[i][j] !== 0 || matrix.cells[j][i] !== 0);
}

function nodeDegrees(matrix: AdjacencyMatrix): number[] {
  const n = matrix.order.length;
  const degrees = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (isLinked(matrix, i, j)) degrees[i] += 1;
    }
  }
  return degrees;
}

/**
 * Cuthill–McKee: BFS from a min-degree seed per component, queueing neighbours by ascending degree.
 * Isolated (degree-0) nodes are NOT used as seeds and are appended at the END, so they don't float
 * ahead of the diagonal blocks.
 */
function cuthillMckee(matrix: AdjacencyMatrix, degrees: number[]): number[] {
  const n = matrix.order.length;
  const adjacency = Array.from({ length: n }, (_, i) => {
    const neighbours: number[] = [];
    for (let j = 0; j < n; j++) if (isLinked(matrix, i, j)) neighbours.push(j);
    return neighbours;
  });

  const visited = new Array<boolean>(n).fill(false);
  const result: number[] = [];
  const seeds = [...Array(n).keys()].filter((i) => degrees[i] > 0).sort((a, b) => degrees[a] - degrees[b]);

  for (const seed of seeds) {
    if (visited[seed]) continue;
    visited[seed] = true;
    const queue = [seed];
    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];
      result.push(u);
      const next = adjacency[u].filter((v) => !visited[v]).sort((a, b) => degrees[a] - degrees[b]);
      for (const v of next) {
        visited[v] = true;
        queue.push(v);
      }
    }
  }
  // Append isolated / any unvisited nodes at the end, in original order.
  for (let i = 0; i < n; i++) if (!visited[i]) result.push(i);
  return result;
}

/** A present finite number, else 0 — so a missing/non-numeric weight field is NOT faked as 1. */
function toWeight(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
