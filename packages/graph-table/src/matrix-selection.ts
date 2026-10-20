/**
 * Matrix ↔ shared-selection brushing: the matrix lens's half of linked views, next to the table's
 * `rowSelectionToSelection`. A row or column BAND is a node; a CELL aggregates every edge from its
 * row node to its column node (and back, in an undirected matrix). These pure adapters translate a
 * pointer hit into the `GraphSelection` the shared view state holds (`@zodal/graph-ui`'s
 * `store.setSelection`), and a selection back into what the matrix highlights: the bands of selected
 * nodes and the cells of selected edges.
 *
 * Form-lens scoping lives here too (`formTarget`): the form lens edits ONE node, the single selected
 * one. No React import.
 */

import type { CanonicalGraph, GraphSelection } from '@zodal/graph-core';
import type { AdjacencyMatrix } from './matrix.js';

/** What a pointer hit on the matrix lens: a row band, a column band, or one cell. */
export type MatrixTarget =
  | { kind: 'row'; node: string }
  | { kind: 'column'; node: string }
  | { kind: 'cell'; source: string; target: string };

export interface MatrixSelectionOptions {
  /** Whether a cell also stands for edges in the reverse direction. Defaults to `!graph.directed`,
   *  as in `toAdjacencyMatrix`; pass the same value the matrix was built with. */
  undirected?: boolean;
}

/** Whether `edge` is aggregated into the cell (`source`, `target`). */
function inCell(edge: { source: string; target: string }, source: string, target: string, undirected: boolean): boolean {
  return (edge.source === source && edge.target === target) || (undirected && edge.source === target && edge.target === source);
}

/** The selection a matrix hit makes: a band selects its node; a cell selects every edge it
 *  aggregates (none, for an empty cell). Both sides are set, so the selection is exactly what was hit;
 *  for an additive (shift-click) pick, union it with the current selection in the host. */
export function matrixTargetToSelection(
  graph: CanonicalGraph,
  target: MatrixTarget,
  options: MatrixSelectionOptions = {},
): GraphSelection {
  if (target.kind !== 'cell') return { nodes: [target.node], edges: [] };
  const undirected = options.undirected ?? !graph.directed;
  const edges = graph.edges.filter((e) => inCell(e, target.source, target.target, undirected)).map((e) => e.id as string);
  return { nodes: [], edges };
}

/** What the matrix highlights for a shared selection, indexed like `matrix.order` / `matrix.cells`. */
export interface MatrixHighlight {
  /** `bands[i]`: node `matrix.order[i]` is selected, so its row AND column band are highlighted. */
  bands: boolean[];
  /** `cells[i][j]`: the cell aggregates a selected edge. */
  cells: boolean[][];
}

/** The bands and cells a shared `GraphSelection` highlights in `matrix` (built from `graph`). */
export function matrixHighlight(
  matrix: AdjacencyMatrix,
  graph: CanonicalGraph,
  selection: GraphSelection,
  options: MatrixSelectionOptions = {},
): MatrixHighlight {
  const index = new Map(matrix.order.map((id, i) => [id, i]));
  const n = matrix.order.length;
  const selectedNodes = new Set(selection.nodes);
  const bands = matrix.order.map((id) => selectedNodes.has(id));
  const cells = Array.from({ length: n }, () => new Array<boolean>(n).fill(false));
  const undirected = options.undirected ?? !graph.directed;
  const selectedEdges = new Set(selection.edges);
  for (const edge of graph.edges) {
    if (!selectedEdges.has(edge.id as string)) continue;
    const i = index.get(edge.source);
    const j = index.get(edge.target);
    if (i === undefined || j === undefined) continue;
    cells[i][j] = true;
    if (undirected) cells[j][i] = true;
  }
  return { bands, cells };
}

/** The node a form lens edits: the selected node when exactly one is selected, else null (the
 *  form shows nothing, or a "select one node" hint). */
export function formTarget(selection: GraphSelection): string | null {
  return selection.nodes.length === 1 ? selection.nodes[0] : null;
}
