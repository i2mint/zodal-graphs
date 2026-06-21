# @zodal/graph-table

> The **table / matrix / form lenses** for zodal-graphs — the "not-a-graph" surfaces. Renderer-agnostic
> data shaping + view switching, with React `<GraphTable>` / `<GraphMatrix>` components on top.

`switch-to-table-view` is the single most universal affordance: every graph wants a table at some
point, and for much graph data a table, adjacency **matrix**, or per-node **form** is the *right*
operable surface — not a node-link diagram. The table itself is well-trodden (TanStack Table); the
renderer-independent value is **shaping the data** and **switching views** while selection/filters
stay shared. This package is pure and headless — a consumer renders the shaped data with TanStack /
a heat-cell grid / a shadcn form.

## Install

```bash
pnpm add @zodal/graph-table react @tanstack/react-table
```

`react` and `@tanstack/react-table` are **peers** (provide your own so React context/hooks resolve to a
single instance); `@zodal/graph-core` + `@zodal/graph-ui` come transitively. Import
`@zodal/graph-table/headless` for the shaping core **without** React/TanStack.

## React components

```tsx
import { GraphTable, GraphMatrix } from '@zodal/graph-table';

<GraphTable graph={graph} />;            // sortable TanStack table of the nodes (or of="edges")
<GraphMatrix graph={graph} />;           // seriated adjacency matrix as a heat-cell grid
```

`<GraphTable>` builds its columns from `inferColumns` and is sortable (click a header); object cells are
JSON-stringified. `<GraphMatrix>` seriates by Cuthill–McKee by default (cluster blocks on the diagonal),
cell opacity ∝ weight. Both are presentational and themeable via the `zodal-table` / `zodal-matrix`
class names.

## Headless shaping (`@zodal/graph-table/headless`)

```ts
import {
  toNodeRows, toEdgeRows, inferColumns,      // table lens
  toAdjacencyMatrix, seriate, reorderMatrix, // matrix lens
  initViewState, switchView, availableViews, // view switching
  createTableRendererEntry, createMatrixRendererEntry,
} from '@zodal/graph-table/headless';

const rows = toNodeRows(graph);              // [{ id, kind, type, ...data }]
const columns = inferColumns(rows);          // [{ id, accessor, header }]
const matrix = reorderMatrix(toAdjacencyMatrix(graph), seriate(toAdjacencyMatrix(graph)));

registry.register(createTableRendererEntry(GraphTable));  // table = universal fallback
registry.register(createMatrixRendererEntry(GraphMatrix)); // matrix = when requested
```

## Scope

**Built + tested:** the headless shaping (`toNodeRows`/`toEdgeRows`/`inferColumns`, `toAdjacencyMatrix`
+ `seriate` + `reorderMatrix`, view switching, registry entries) **and** the `<GraphTable>` (TanStack) +
`<GraphMatrix>` (heat-cell) React components, with render tests. **Deferred:** the shadcn **form** lens
(per-node form-config: react-hook-form + zodResolver + the `form` view) and row/cell **virtualization**
(`@tanstack/react-virtual`) for very large tables.

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
