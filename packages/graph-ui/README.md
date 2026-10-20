# @zodal/graph-ui

> The renders + schema↔render mappings registries for **zodal-graphs** — capability-ranked,
> rank-and-degrade renderer selection, plus the shared view state that links the lenses. Headless
> (one optional React hook entry, `@zodal/graph-ui/react`).

`@zodal/graph-ui` decides *which* renderer should draw a graph, given what the graph declares it
needs (`GraphCapabilities`) and what each renderer honestly supports (`RendererCapabilities`). It
stores opaque renderer payloads (e.g. React components) and never inspects them — concrete
renderers live in their own packages (`@zodal/graph-react-flow`, `@zodal/graph-sigma`, …) and
register here.

## Install

```bash
pnpm add @zodal/graph-ui
```

`@zodal/graph-core` comes transitively (it's a regular dependency). If you also call
`defineGraph` from `@zodal/graph-core` directly, install its peers too: `@zodal/core` and `zod`.

## The idea

One registry serves both the **renders** registry and the **schema↔render mappings** — the
mappings *are* the testers you register. A tester scores how well a renderer fits the graph; the
registry picks the highest score and **degrades honestly**, reporting what the winner can't do.

```ts
import { createGraphRendererRegistry, makeTester, PRIORITY, isTypedPortGraph, wantsEditing, scaleAtMost, scaleAtLeast } from '@zodal/graph-ui';

const registry = createGraphRendererRegistry<MyComponent>();

registry.register({
  name: 'react-flow',
  renderer: ReactFlowView,
  capabilities: { renderer: 'react-flow', typedPorts: true, editing: true, maxComfortableNodes: 2000, /* … */ },
  tester: makeTester({
    eligible: scaleAtMost(2000),
    base: PRIORITY.DEFAULT,
    bonuses: [[isTypedPortGraph, PRIORITY.LIBRARY], [wantsEditing, PRIORITY.LIBRARY]],
  }),
});

registry.register({
  name: 'sigma',
  renderer: SigmaView,
  capabilities: { renderer: 'sigma', typedPorts: false, editing: false, maxComfortableNodes: 100_000, /* … */ },
  tester: makeTester({ base: PRIORITY.DEFAULT, bonuses: [[scaleAtLeast(2000), PRIORITY.LIBRARY]] }),
});

const sel = registry.select(graphDef.getCapabilities(), { nodeCount: 50_000, intent: 'explore' });
// → { renderer: SigmaView, score: …, degraded: ['typedPorts', 'editing'] }
//   (a huge graph forces the viz renderer; editing + typed ports are honestly dropped)
```

## Linked views: one shared state for every lens

Selection, filters, hover and the active view live in ONE serializable `GraphViewState`, so a
lens is a projection of it and brushing in one lens shows in all of them. Filters are owned (one
per lens or control) and combined with AND, so a timeline brush and a facet filter narrow together.

With the React lenses, hand every lens the same store and they wire themselves:

```tsx
import { createGraphViewStore } from '@zodal/graph-ui';
import { GraphTable } from '@zodal/graph-table';
import { TimelineView } from '@zodal/graph-timeline';
import { SigmaView } from '@zodal/graph-sigma';

const view = createGraphViewStore({ capabilities: graphDef.getCapabilities() });

<GraphTable graph={graph} view={view} />    {/* checkbox column = the shared selection; filtered rows dim/hide */}
<TimelineView graph={graph} view={view} />  {/* brushing sets the 'timeline' filter; clearing removes it */}
<SigmaView graph={graph} view={view} />     {/* click/shift-click select, hover; draws linkedOverlays */}
```

`<GraphMatrix view>` and graph-react-flow's `<GraphFlowView view>` take the same prop. In your own
React lens, `useGraphView(store)` (from `@zodal/graph-ui/react`; `react` is an optional peer) is the
one `useSyncExternalStore` subscription, and `useLinkedView(graph, store)` adds what to draw: the
`kept` / `hidden` id sets and the `linkedOverlays`.

Without React, or to wire a lens by hand, the pieces are pure:

```ts
import { createGraphViewStore, linkedOverlays, linkedFilterResult } from '@zodal/graph-ui';
import { rowSelectionToSelection, selectionToRowSelection } from '@zodal/graph-table/headless';
import { brushFilter, toTimeline } from '@zodal/graph-timeline/headless';

const view = createGraphViewStore({ capabilities: graphDef.getCapabilities() });

// table lens: TanStack rowSelection <-> the shared selection
onRowSelectionChange: (next) => view.setSelection(rowSelectionToSelection(next, 'node'));
rowSelection: selectionToRowSelection(view.getState().selection, 'node');

// timeline lens: a brushed window becomes the timeline's filter
onBrush: (window) => view.setFilter('timeline', brushFilter(toTimeline(graph), window));

// node-link lens: a click is view.pick({ kind: 'node', id }, shiftKey); draw the shared state as
// overlays (selection primary, faded-out dimmed, hover related), and leave out what a 'hide' owner removes
overlays = linkedOverlays(graph, view.getState());
hidden = linkedFilterResult(graph, view.getState())?.hidden; // { nodes, edges } not to draw
```

graph-sigma's focus mode (`dimUnhighlighted`) ignores layers of only `dimmed` roles and the `hover`
layer, so a fade filter or a hover alone does not fade the graph; a selection does. A selected node
stays `primary` even when a filter dims it (the selection is kept and marked, never pruned).
`graph-table`'s `switchView` helpers are pure conveniences over the same `activeView` field; in an
app with the store, switch through `store.setActiveView` so every lens is notified.

The pure transitions (`setSelection`, `setFilter`, `setActiveView`, …) return the same object when
nothing changed, so subscribers are not called for no-ops.

## API

| Export | What it does |
|---|---|
| `createGraphRendererRegistry<T>()` | factory → `{ register, resolve, select, explain, entries }` |
| `makeTester({ eligible, base, bonuses })` | author a tester declaratively |
| predicates: `isTypedPortGraph`, `wantsEditing`, `isExecutable`, `hasProvenance`, `hasIntervals`, `scaleAtMost(n)`, `scaleAtLeast(n)`, `viewIs(v)`, `supportsView(v)` | compose with `allOf` / `anyOf` / `not` |
| `PRIORITY` | named bands (`FALLBACK` → `OVERRIDE`); `INELIGIBLE` = -1 |
| `computeGaps` / `CapabilityGap` | the degrade report |
| `createGraphViewStore({ initial?, capabilities? })` | the shared view store: `getState`, `subscribe`, `setActiveView`, `setSelection`, `setFilter(owner, filter \| null)`, `setHovered`, `pick(element, additive?)`, `clear*`, `setState` |
| `initGraphViewState`, `setActiveView`, `setSelection`, `clearSelection`, `setFilter`, `clearFilters`, `setHovered`, `pickSelection` | the same transitions as pure functions over `GraphViewState` (`pickSelection`: a click selects one element, a shift-click toggles it) |
| `useGraphView(store)` · `useLinkedView(graph, store, { excludeOwners? })` (`@zodal/graph-ui/react`) | the React subscription every lens shares, and its projection (`kept`, `hidden`, `overlays`) |
| `linkedFilterResult(graph, state)` · `linkedOverlays(graph, state)` | what a lens draws: what every owner keeps (`selection`), what a hide owner removes (`hidden`), what only fade owners drop (dimmed), and the `GraphOverlays` for node-link |

`resolve()` returns the renderer payload; `select()` adds the `degraded` report; `explain()`
returns the full ranking (why a renderer won). Ties resolve to the first-registered entry.

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo. Mirrors zodal's `@zodal/ui`
renderer-registry pattern.
