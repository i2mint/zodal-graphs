# @zodal/graph-react-flow

> The **React Flow typed-port editor** renderer for zodal-graphs — connection validation generated
> from the canonical port types.

The small-rich editor regime: a node-link canvas where ports are first-class typed handles and a
connection is validated *at drag time* against the canonical port types. React Flow ships the
`isValidConnection` hook but no type check (handles are typeless) — so this package generates the
predicate from the graph's Zod-derived port types via graph-core's `portTypeCompatible`.

## Install

```bash
pnpm add @zodal/graph-react-flow @xyflow/react react react-dom
```

`@zodal/graph-core` and `@zodal/graph-ui` come transitively; `@xyflow/react`, `react`, and
`react-dom` are peers. Import `@xyflow/react/dist/style.css`, and give the view a parent with a
definite height — React Flow renders into its parent's box.

## Headless core (the substance)

Import from the **`/headless`** subpath to use the validation core / registry entry with **no React
or @xyflow/react dependency** (e.g. a Node validation script, or graph-ui's pure capability ranking):

```ts
import { makeIsValidConnection, createReactFlowRendererEntry, reactFlowCapabilities } from '@zodal/graph-react-flow/headless';

// Generate React Flow's isValidConnection from the canonical graph + its capabilities:
const isValidConnection = makeIsValidConnection(graph, graphDef.getCapabilities());
// number→number ✓   number→string ✗   unknown port ✗   no declared type → permissive
// (validation off when the graph doesn't declare typedPorts + validatesConnections)

// Register the renderer into a @zodal/graph-ui registry (it wins for small typed-port editable graphs):
registry.register(createReactFlowRendererEntry(GraphFlowView));
```

## React shells (thin — visual polish deferred)

```tsx
import { GraphFlowView, FuncNode } from '@zodal/graph-react-flow';
import '@xyflow/react/dist/style.css';

<GraphFlowView graph={graph} capabilities={graphDef.getCapabilities()} />;
```

`FuncNode` renders one `<Handle>` per port (handle id = port name, so `targetHandle === targetPort`);
`GraphFlowView` wires `toReactFlow` + `makeIsValidConnection` into `<ReactFlow>`.

## Scope (this checkpoint)

**Built + tested:** `makeIsValidConnection` + `lookupPort` (the headless P1 seam — rejects
type-incompatible wires, unknown ports, and self-connections), the **honest** `reactFlowCapabilities`
(it reports `false` for `compoundNodes`/`watchesValues`/`provenanceOverlay` — not yet built — so
graph-ui degrades honestly), and the graph-ui registry entry. **Shells:** `FuncNode` + an editable
`GraphFlowView` (seeds controlled state, wires `onConnect` through `isValidConnection`) — typecheck +
build only, not render-tested. **Deferred:** real layout (dagre/ELK), styling, collapse↔expand of a
sub-DAG into a reusable component, the value-watch execution overlay, provenance overlay drawing, and
component render tests.

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
