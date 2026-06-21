/**
 * The React components for the table + matrix lenses — thin renderers over the headless shaping.
 *
 * `<GraphTable>` drives TanStack Table from `toNodeRows`/`toEdgeRows` + `inferColumns` (sortable,
 * object cells JSON-stringified). `<GraphMatrix>` draws the seriated adjacency matrix as a heat-cell
 * grid (opacity ∝ weight). Both are presentational: they compute from the canonical graph and render;
 * styling is via class names (`zodal-table`, `zodal-matrix`) so a host can theme them.
 */

import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useMemo, useState, type ReactElement } from 'react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { inferColumns, toEdgeRows, toNodeRows, type EdgeRow, type NodeRow } from './rows.js';
import { reorderMatrix, seriate, toAdjacencyMatrix, type SeriationMethod } from './matrix.js';

type Row = NodeRow | EdgeRow;
const SORT_GLYPH: Record<string, string> = { asc: ' ▲', desc: ' ▼' };

export interface GraphTableProps {
  graph: CanonicalGraph;
  /** Tabulate the graph's `'nodes'` (default) or `'edges'`. */
  of?: 'nodes' | 'edges';
  className?: string;
}

/** A sortable table of a graph's nodes or edges (TanStack Table over the headless row shaping). */
export function GraphTable({ graph, of = 'nodes', className }: GraphTableProps): ReactElement {
  const rows = useMemo<Row[]>(() => (of === 'edges' ? toEdgeRows(graph) : toNodeRows(graph)), [graph, of]);
  const columns = useMemo<ColumnDef<Row>[]>(
    () =>
      inferColumns(rows).map((col) => ({
        id: col.id,
        // accessorFn (not accessorKey): a collision-renamed key like `data.id` is a literal flat key,
        // and accessorKey would mis-read it as a nested path (`row.data.id`).
        accessorFn: (row) => (row as Record<string, unknown>)[col.id],
        header: col.header,
        cell: (info) => formatCell(info.getValue()),
      })),
    [rows],
  );
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (rows.length === 0) {
    return <div className={cx('zodal-table', 'zodal-table--empty', className)}>No {of} to show.</div>;
  }

  return (
    <table className={cx('zodal-table', className)}>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => {
              const sorted = header.column.getIsSorted();
              return (
                <th
                  key={header.id}
                  scope="col"
                  onClick={header.column.getToggleSortingHandler()}
                  data-sorted={sorted || undefined}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {sorted ? SORT_GLYPH[sorted] : ''}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export interface GraphMatrixProps {
  graph: CanonicalGraph;
  /** Edge `data` field for the cell weight; defaults to counting edges. */
  weight?: string;
  undirected?: boolean;
  /** Row/column ordering. Default `'cuthill-mckee'` (clusters → diagonal blocks); `'none'` keeps input order. */
  seriation?: SeriationMethod | 'none';
  /** Cell edge length in px (default 18). */
  cellSize?: number;
  /** Heat colour for a max-weight cell (default a blue). */
  color?: string;
  className?: string;
}

/** The seriated adjacency matrix as a heat-cell grid (cell opacity ∝ weight). */
export function GraphMatrix({
  graph,
  weight,
  undirected,
  seriation = 'cuthill-mckee',
  cellSize = 18,
  color = '31, 119, 180',
  className,
}: GraphMatrixProps): ReactElement {
  const matrix = useMemo(() => {
    const base = toAdjacencyMatrix(graph, { weight, undirected });
    return seriation === 'none' ? base : reorderMatrix(base, seriate(base, seriation));
  }, [graph, weight, undirected, seriation]);

  const max = useMemo(() => matrix.cells.reduce((m, row) => row.reduce((n, v) => Math.max(n, v), m), 0), [matrix]);

  if (matrix.order.length === 0) {
    return <div className={cx('zodal-matrix', 'zodal-matrix--empty', className)}>Empty graph.</div>;
  }

  return (
    <div
      className={cx('zodal-matrix', className)}
      role="grid"
      aria-label="adjacency matrix"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${matrix.order.length}, ${cellSize}px)`,
        width: 'max-content',
      }}
    >
      {matrix.cells.map((row, i) =>
        row.map((value, j) => (
          <div
            key={`${i}-${j}`}
            role="gridcell"
            title={`${matrix.order[i]} → ${matrix.order[j]}: ${value}`}
            data-value={value}
            style={{
              width: cellSize,
              height: cellSize,
              boxSizing: 'border-box',
              outline: '1px solid rgba(0,0,0,0.06)',
              background: value !== 0 && max > 0 ? `rgba(${color}, ${Math.abs(value) / max})` : 'transparent',
            }}
          />
        )),
      )}
    </div>
  );
}

function formatCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function cx(...parts: Array<string | undefined | false>): string {
  return parts.filter(Boolean).join(' ');
}
