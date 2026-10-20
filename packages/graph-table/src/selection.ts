/**
 * Table ↔ shared-selection brushing. TanStack Table keeps selected rows as `rowSelection`
 * (`Record<rowId, boolean>`), and the table lens keys rows by canonical node/edge id (`getRowId`),
 * so a row selection IS a `GraphSelection` — these pure adapters translate between the two so the
 * table lens reads and writes the shared view state (`@zodal/graph-ui`'s `GraphViewState`).
 *
 * Wire them as: `onRowSelectionChange` → `store.setSelection(rowSelectionToSelection(next, 'node'))`,
 * and `state.rowSelection = selectionToRowSelection(store.getState().selection, 'node')`.
 */

import type { GraphSelection } from '@zodal/graph-core';

/** TanStack Table's row-selection state: row id → selected. */
export type RowSelectionState = Record<string, boolean>;

/** Which kind of rows the table lists: node rows or edge rows. */
export type RowKind = 'node' | 'edge';

/** The selected row ids of a TanStack `rowSelection`, as the matching part of a `GraphSelection`.
 *  Only the `kind` side is returned, so `setSelection` leaves the other kind's selection alone. */
export function rowSelectionToSelection(rowSelection: RowSelectionState, kind: RowKind): Partial<GraphSelection> {
  const ids = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  return kind === 'node' ? { nodes: ids } : { edges: ids };
}

/** The `rowSelection` a table of `kind` rows should show for a shared `GraphSelection`. */
export function selectionToRowSelection(selection: GraphSelection, kind: RowKind): RowSelectionState {
  const ids = kind === 'node' ? selection.nodes : selection.edges;
  return Object.fromEntries(ids.map((id) => [id, true]));
}
