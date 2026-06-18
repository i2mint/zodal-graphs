# @zodal/graph-table

> The **table / matrix / form lenses** for zodal-graphs — the "not-a-graph" surfaces. Renderer-agnostic
> data shaping + view switching, headless.

`switch-to-table-view` is the single most universal affordance: every graph wants a table at some
point, and for much graph data a table, adjacency **matrix**, or per-node **form** is the *right*
operable surface — not a node-link diagram. The table itself is well-trodden (TanStack Table); the
renderer-independent value is **shaping the data** and **switching views** while selection/filters
stay shared. This package is pure and headless — a consumer renders the shaped data with TanStack /
a heat-cell grid / a shadcn form.

## Install

```bash
pnpm add @zodal/graph-table
```

`@zodal/graph-core` and `@zodal/graph-ui` come transitively.

## Use

```ts
import {
  toNodeRows, toEdgeRows, inferColumns,      // table lens
  toAdjacencyMatrix, seriate,                // matrix lens
  initViewState, switchView, availableViews, // view switching
  createTableRendererEntry, createMatrixRendererEntry,
} from '@zodal/graph-table';

const rows = toNodeRows(graph);              // [{ id, kind, type, ...data }]
const columns = inferColumns(rows);          // [{ id, accessor, header }]  — feed to TanStack Table

const matrix = toAdjacencyMatrix(graph);     // { order: nodeIds, cells: number[][] }
const order = seriate(matrix);               // cluster-revealing row/col order (Cuthill–McKee)

let view = initViewState(graphDef.getCapabilities()); // { activeView }
view = switchView(view, 'matrix');           // pure setter — selection/filters preserved

registry.register(createTableRendererEntry(MyTanStackTable));  // table = universal fallback
registry.register(createMatrixRendererEntry(MyHeatGrid));      // matrix = when requested
```

## Scope (this checkpoint)

**Built + tested:** `toNodeRows` / `toEdgeRows` / `inferColumns` (table data), `toAdjacencyMatrix` +
`seriate` (degree / Cuthill–McKee, the part no grid does), view-switching helpers, and the
`tableCapabilities` / `matrixCapabilities` registry entries (table wins when requested + is the
fallback; matrix when requested). **Deferred:** the TanStack table + heat-cell matrix + shadcn form
React components, virtualization, and the per-node form-config (react-hook-form + zodResolver + the
`form` view).

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
