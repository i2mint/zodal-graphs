/**
 * The React components for the table + matrix lenses — thin renderers over the headless shaping.
 * (The shadcn `form` lens is deferred; this ships table + matrix.)
 *
 * `<GraphTable>` drives TanStack Table from `toNodeRows`/`toEdgeRows` + `inferColumns`, sortable from
 * keyboard-accessible headers, sorting on the SAME value it displays (so object/mixed cells sort
 * transitively). `<GraphMatrix>` draws the seriated adjacency matrix as a heat-cell grid (a diverging
 * scale: hue ← sign, opacity ← |weight| / max-magnitude); given a shared `selection` it highlights the
 * selected nodes' bands and edges' cells, and `onSelect` reports band/cell hits (`MatrixTarget`, for
 * `matrixTargetToSelection`). Both are presentational and themeable via
 * class names (`zodal-table`, `zodal-matrix`).
 *
 * Linked views: give either lens the shared `view` store (`@zodal/graph-ui`'s `createGraphViewStore`)
 * and it reads and writes the state every other lens shares. `<GraphTable view>` adds a selection
 * checkbox column bound to the shared selection, leaves out the rows a `'hide'` filter removes, dims
 * the rows only `'fade'` filters drop, and reports row hover; `<GraphMatrix view>` highlights the
 * shared selection and writes its band/cell clicks back. Pass a NEW `graph` object to re-render (props are
 * memoised on identity — mutating the graph in place won't update).
 */

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type Row as TableRow,
  type SortingState,
} from '@tanstack/react-table';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactElement } from 'react';
import type { CanonicalGraph, GraphSelection } from '@zodal/graph-core';
import type { GraphViewState, GraphViewStore } from '@zodal/graph-ui';
import { useGraphView, useLinkedView } from '@zodal/graph-ui/react';
import { inferColumns, toEdgeRows, toNodeRows, type EdgeRow, type NodeRow } from './rows.js';
import { reorderMatrix, seriate, toAdjacencyMatrix, type SeriationMethod } from './matrix.js';
import { matrixHighlight, matrixTargetToSelection, type MatrixTarget } from './matrix-selection.js';
import { rowSelectionToSelection, selectionToRowSelection, type RowSelectionState } from './selection.js';

type Row = NodeRow | EdgeRow;
const SORT_GLYPH: Record<string, string> = { asc: ' ▲', desc: ' ▼' };
/** The selection column's id (not a field name: field columns come from `inferColumns`). */
const SELECT_COLUMN = '__select';
/** Opacity of a row only `'fade'` filters drop (dimmed, not removed). */
const DIMMED_OPACITY = 0.4;
/** Un-virtualized matrices render n² DOM nodes; warn past this (the registry caps comfort at 2000). */
const MATRIX_WARN_NODES = 200;

export interface GraphTableProps {
  graph: CanonicalGraph;
  /** Tabulate the graph's `'nodes'` (default) or `'edges'`. */
  of?: 'nodes' | 'edges';
  className?: string;
  /** The shared view store (linked views): the table shows and writes the shared selection through
   *  a checkbox column, leaves out rows a `'hide'` filter removes, dims rows only `'fade'` filters
   *  drop, and sets the shared hover on row hover. */
  view?: GraphViewStore;
  /** With `view`, show the selection checkbox column. Default true. */
  selectable?: boolean;
}

/** A sortable table of a graph's nodes or edges (TanStack Table over the headless row shaping). */
export function GraphTable({ graph, of = 'nodes', className, view, selectable = true }: GraphTableProps): ReactElement {
  const kind = of === 'edges' ? 'edge' : 'node';
  const linked = useLinkedView(graph, view);
  const allRows = useMemo<Row[]>(() => (of === 'edges' ? toEdgeRows(graph) : toNodeRows(graph)), [graph, of]);
  const hiddenIds = linked ? (kind === 'node' ? linked.hidden.nodes : linked.hidden.edges) : undefined;
  const rows = useMemo<Row[]>(
    () => (hiddenIds && hiddenIds.size > 0 ? allRows.filter((row) => !hiddenIds.has(rowId(row))) : allRows),
    [allRows, hiddenIds],
  );
  const withSelection = view !== undefined && selectable;
  const columns = useMemo<ColumnDef<Row>[]>(() => {
    // Columns come from ALL rows, so a filter hiding rows does not drop or reshuffle columns.
    const fields: ColumnDef<Row>[] = inferColumns(allRows).map((col) => ({
      id: col.id,
      // accessorFn (not accessorKey): a collision-renamed key like `data.id` is a literal flat key,
      // and accessorKey would mis-read it as a nested path (`row.data.id`).
      accessorFn: (row) => (row as Record<string, unknown>)[col.id],
      header: col.header,
      cell: (info) => formatCell(info.getValue()),
      // Sort on the SAME value we display so object/mixed cells sort transitively (TanStack's auto
      // comparator would compare the raw object refs — non-transitive, meaningless order).
      sortingFn: (a: TableRow<Row>, b: TableRow<Row>, id: string) => compareCells(a.getValue(id), b.getValue(id)),
    }));
    if (!withSelection) return fields;
    const select: ColumnDef<Row> = {
      id: SELECT_COLUMN,
      enableSorting: false,
      header: ({ table }) => (
        <Checkbox
          label={`Select all ${of}`}
          checked={table.getIsAllRowsSelected()}
          indeterminate={table.getIsSomeRowsSelected()}
          onChange={table.getToggleAllRowsSelectedHandler()}
        />
      ),
      cell: ({ row }) => (
        <Checkbox label={`Select ${row.id}`} checked={row.getIsSelected()} onChange={row.getToggleSelectedHandler()} />
      ),
    };
    return [select, ...fields];
  }, [allRows, withSelection, of]);
  const [sorting, setSorting] = useState<SortingState>([]);
  const selection = linked?.state.selection;
  // Only the rows on show: a selected id the table does not list (hidden, or not of its kind) must
  // not make the select-all checkbox look partly checked.
  const rowSelection = useMemo<RowSelectionState>(() => {
    if (!selection) return {};
    const shown = new Set(rows.map(rowId));
    return Object.fromEntries(Object.entries(selectionToRowSelection(selection, kind)).filter(([id]) => shown.has(id)));
  }, [selection, kind, rows]);
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    enableRowSelection: withSelection,
    // Based on the store's CURRENT selection (not this render's), so two toggles in one batch both
    // land. Selected ids the table does not show (hidden rows) are kept; only this table's kind is
    // written, so the other kind is left alone.
    onRowSelectionChange: (updater) => {
      if (!view) return;
      const current = selectionToRowSelection(view.getState().selection, kind);
      const shown = new Set(rows.map(rowId));
      const visible = Object.fromEntries(Object.entries(current).filter(([id]) => shown.has(id)));
      const next = typeof updater === 'function' ? updater(visible) : updater;
      const offscreen = Object.fromEntries(Object.entries(current).filter(([id]) => !shown.has(id)));
      view.setSelection(rowSelectionToSelection({ ...offscreen, ...next }, kind));
    },
    getRowId: rowId, // React key = node/edge id, stable across sorts
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (allRows.length === 0) {
    return <div className={cx('zodal-table', 'zodal-table--empty', className)}>No {of} to show.</div>;
  }

  const kept = linked?.kept ? (kind === 'node' ? linked.kept.nodes : linked.kept.edges) : undefined;
  const hovered = linked?.state.hovered;
  return (
    <table className={cx('zodal-table', className)}>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => {
              if (!header.column.getCanSort()) {
                return (
                  <th key={header.id} scope="col">
                    {flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                );
              }
              const sorted = header.column.getIsSorted();
              const toggle = header.column.getToggleSortingHandler();
              return (
                <th key={header.id} scope="col" aria-sort={ariaSort(sorted)} data-sorted={sorted || undefined}>
                  {/* a <button> keeps native keyboard activation (Enter/Space) + focus for sorting */}
                  <button
                    type="button"
                    className="zodal-table__sort"
                    onClick={toggle}
                    style={{ font: 'inherit', background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sorted ? SORT_GLYPH[sorted] : ''}
                  </button>
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => {
          const selected = row.getIsSelected();
          // A selected row stays at full strength under a fade filter (selection outranks dimming).
          const dimmed = kept !== undefined && !kept.has(row.id) && !selected;
          const isHovered = hovered?.kind === kind && hovered.id === row.id;
          return (
            <tr
              key={row.id}
              className={cx(
                'zodal-table__row',
                selected && 'zodal-table__row--selected',
                dimmed && 'zodal-table__row--dimmed',
                isHovered && 'zodal-table__row--hovered',
              )}
              data-selected={selected || undefined}
              data-dimmed={dimmed || undefined}
              style={dimmed ? { opacity: DIMMED_OPACITY } : undefined}
              {...(view
                ? {
                    onMouseEnter: () => view.setHovered({ kind, id: row.id }),
                    onMouseLeave: () => view.setHovered(null),
                  }
                : {})}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** A labelled checkbox whose `indeterminate` state (a DOM property, not an attribute) is kept in sync. */
function Checkbox({
  label,
  checked,
  indeterminate = false,
  onChange,
}: {
  label: string;
  checked: boolean;
  indeterminate?: boolean;
  onChange: (event: unknown) => void;
}): ReactElement {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate && !checked;
  }, [indeterminate, checked]);
  return <input ref={ref} type="checkbox" className="zodal-table__select" aria-label={label} checked={checked} onChange={onChange} />;
}

const selectSelection = (state: GraphViewState): GraphSelection => state.selection;

const rowId = (row: Row): string => String((row as Record<string, unknown>).id ?? '');

export interface GraphMatrixProps {
  graph: CanonicalGraph;
  /** Edge `data` field for the cell weight; defaults to counting edges. */
  weight?: string;
  undirected?: boolean;
  /** Row/column ordering. Default `'cuthill-mckee'` (clusters → diagonal blocks); `'none'` keeps input order. */
  seriation?: SeriationMethod | 'none';
  /** Cell edge length in px (default 18). */
  cellSize?: number;
  /** Heat colour (`r, g, b`) for positive weights (default a blue). */
  color?: string;
  /** Heat colour (`r, g, b`) for negative weights (default a red). */
  negativeColor?: string;
  className?: string;
  /** The shared selection to highlight: a selected node's row and column band, a selected edge's cell. */
  selection?: GraphSelection;
  /** Called with what was clicked: a cell, or (with `labels`) a row/column band. Translate it with
   *  `matrixTargetToSelection` and write it to the shared view store. */
  onSelect?: (target: MatrixTarget, event: ReactMouseEvent | ReactKeyboardEvent) => void;
  /** Render row and column header bands (node ids) — buttons when `onSelect` is given. Default false. */
  labels?: boolean;
  /** The shared view store (linked views): highlights the shared selection and writes band/cell
   *  clicks back to it. An explicit `selection` / `onSelect` takes precedence. */
  view?: GraphViewStore;
}

/** The seriated adjacency matrix as a heat-cell grid (diverging: hue ← sign, opacity ← |weight|/max). */
export function GraphMatrix({
  graph,
  weight,
  undirected,
  seriation = 'cuthill-mckee',
  cellSize = 18,
  color = '31, 119, 180',
  negativeColor = '214, 39, 40',
  className,
  selection,
  onSelect,
  labels = false,
  view,
}: GraphMatrixProps): ReactElement {
  // Only the selection: hover and filter changes in other lenses must not re-render n² cells.
  const sharedSelection = useGraphView(view, selectSelection); // called unconditionally (hook rules)
  selection ??= sharedSelection;
  onSelect ??= view ? (target) => view.setSelection(matrixTargetToSelection(graph, target, { undirected })) : undefined;
  const matrix = useMemo(() => {
    const base = toAdjacencyMatrix(graph, { weight, undirected });
    return seriation === 'none' ? base : reorderMatrix(base, seriate(base, seriation));
  }, [graph, weight, undirected, seriation]);

  // Saturate by MAGNITUDE so negative-weighted graphs aren't blank and opacity stays in [0, 1].
  const max = useMemo(
    () => matrix.cells.reduce((m, row) => row.reduce((n, v) => Math.max(n, Math.abs(v)), m), 0),
    [matrix],
  );

  const highlight = useMemo(
    () => (selection ? matrixHighlight(matrix, graph, selection, { undirected }) : null),
    [matrix, graph, selection, undirected],
  );

  if (matrix.order.length > MATRIX_WARN_NODES && typeof console !== 'undefined') {
    console.warn(
      `[graph-table] <GraphMatrix> is rendering ${matrix.order.length}² un-virtualized cells; ` +
        `consider aggregation/a table above ~${MATRIX_WARN_NODES} nodes.`,
    );
  }

  if (matrix.order.length === 0) {
    return <div className={cx('zodal-matrix', 'zodal-matrix--empty', className)}>Empty graph.</div>;
  }

  const n = matrix.order.length;
  // The value the matrix was built with: a cell hit carries it, so its selection matches its highlight.
  const bothWays = undirected ?? !graph.directed;
  const arrow = bothWays ? '—' : '→';
  const band = (kind: 'row' | 'column', node: string, i: number): ReactElement => {
    const bandClass = cx(
      'zodal-matrix__band',
      `zodal-matrix__band--${kind}`,
      highlight?.bands[i] ? 'zodal-matrix__band--selected' : undefined,
    );
    // A band is one cell thick (a column band's label runs vertically), so the grid stays square.
    const style =
      kind === 'column'
        ? { writingMode: 'vertical-rl' as const, width: cellSize, padding: 0, boxSizing: 'border-box' as const }
        : { height: cellSize, padding: '0 4px', boxSizing: 'border-box' as const, lineHeight: 1 };
    return onSelect ? (
      <button
        key={`${kind}-${node}`}
        type="button"
        className={bandClass}
        style={style}
        aria-current={highlight?.bands[i] ? 'true' : undefined}
        onClick={(e) => onSelect({ kind, node }, e)}
      >
        {node}
      </button>
    ) : (
      <div key={`${kind}-${node}`} className={bandClass} style={style}>
        {node}
      </div>
    );
  };

  const cellTarget = (i: number, j: number): MatrixTarget => ({
    kind: 'cell',
    source: matrix.order[i],
    target: matrix.order[j],
    undirected: bothWays,
  });

  const cells = matrix.cells.map((row, i) =>
    row.map((value, j) => {
      const inBand = highlight ? highlight.bands[i] || highlight.bands[j] : false;
      const selected = highlight?.cells[i][j] ?? false;
      return (
        <div
          key={`${i}-${j}`}
          className={cx(
            'zodal-matrix__cell',
            inBand ? 'zodal-matrix__cell--band' : undefined,
            selected ? 'zodal-matrix__cell--selected' : undefined,
          )}
          title={`${matrix.order[i]} ${arrow} ${matrix.order[j]}: ${value}`}
          data-value={value}
          // Selectable cells are keyboard buttons (Enter/Space), and say whether they are selected.
          {...(onSelect
            ? {
                role: 'button',
                tabIndex: 0,
                'aria-label': `${matrix.order[i]} ${arrow} ${matrix.order[j]}: ${value}`,
                'aria-pressed': selected,
                onClick: (e: ReactMouseEvent) => onSelect(cellTarget(i, j), e),
                onKeyDown: (e: ReactKeyboardEvent) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return;
                  e.preventDefault();
                  onSelect(cellTarget(i, j), e);
                },
              }
            : {})}
          style={{
            width: cellSize,
            height: cellSize,
            boxSizing: 'border-box',
            outline: selected ? '2px solid currentColor' : '1px solid rgba(0,0,0,0.06)',
            boxShadow: inBand ? 'inset 0 0 0 9999px rgba(0,0,0,0.06)' : undefined,
            cursor: onSelect ? 'pointer' : undefined,
            background:
              value !== 0 && max > 0
                ? `rgba(${value < 0 ? negativeColor : color}, ${Math.abs(value) / max})`
                : 'transparent',
          }}
        />
      );
    }),
  );

  return (
    <div
      className={cx('zodal-matrix', className)}
      role={onSelect || labels ? 'group' : 'img'}
      aria-label={`adjacency matrix, ${n} nodes`}
      style={{
        display: 'grid',
        gridTemplateColumns: labels ? `max-content repeat(${n}, ${cellSize}px)` : `repeat(${n}, ${cellSize}px)`,
        width: 'max-content',
      }}
    >
      {labels ? (
        <>
          <div className="zodal-matrix__corner" />
          {matrix.order.map((id, j) => band('column', id, j))}
          {cells.map((row, i) => [band('row', matrix.order[i], i), ...row])}
        </>
      ) : (
        cells
      )}
    </div>
  );
}

/** Sort numbers numerically, everything else by its displayed string — transitive, matches the cell. */
function compareCells(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const as = formatCell(a);
  const bs = formatCell(b);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

function ariaSort(sorted: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  return sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none';
}

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}
