# @zodal/graph-sigma

> The large-sparse **WebGL viz renderer** for zodal-graphs — sigma.js over the graphology hub,
> drawing `@zodal/graph-compute` overlays by id.

sigma is the large-sparse renderer in the zodal-graphs fleet: it scales to ~100k nodes on WebGL and
is `@zodal/graph-ui`'s degrade target when the small-rich React Flow editor opts out on scale. It
renders a graphology graph (loaded via `@zodal/graph-core`'s hub — the same structure graph-compute
runs on) and draws renderer-agnostic overlays by node/edge id.

## Install

```bash
pnpm add @zodal/graph-sigma sigma graphology react
```

`@zodal/graph-core` and `@zodal/graph-ui` come transitively; `sigma`, `graphology`, and `react` are
peers (no `react-dom` — `SigmaView` uses only `react` hooks). Give the view a parent with a definite
height. `SigmaView` creates the Sigma instance once per `graph` and updates overlays live (the camera
is preserved across overlay changes); pass referentially-stable `overlays`/`styleOptions` (e.g.
`useMemo`) to avoid needless reducer refreshes.

## Headless core (no React/sigma) — `@zodal/graph-sigma/headless`

```ts
import { sigmaCapabilities, createSigmaRendererEntry, nodeOverlayStyle, edgeOverlayStyle } from '@zodal/graph-sigma/headless';

// Register into a graph-ui registry — it ranks up at large scale:
registry.register(createSigmaRendererEntry(SigmaView));

// Turn a graph-compute GraphOverlays into per-element style (sigma reducers):
const styleNode = nodeOverlayStyle(overlays);  // (nodeId) => { color, highlighted, zIndex }
// highlighted nodes take a role colour; in focus mode everything else dims.
```

## React shell (thin)

```tsx
import { SigmaView } from '@zodal/graph-sigma';

<SigmaView graph={graph} overlays={overlays} />;
```

`SigmaView` loads the graph via the graphology hub, seeds default coordinates, and wires the overlay
stylers into sigma's node/edge reducers.

## Scope (this checkpoint)

**Built + tested:** the honest `sigmaCapabilities` + registry entry (wins at large scale, degrades
ports/editing), and the `nodeOverlayStyle` / `edgeOverlayStyle` overlay-drawing bridge (role colours,
focus-mode dimming, `component:N` palette). **Component:** `SigmaView` — creates the Sigma instance
once per graph (camera preserved across overlay changes), renders an empty state for a node-less
graph, and degrades to an error overlay when WebGL context creation fails (rather than throwing).
Render-tested over happy-dom: the empty state + the WebGL-unavailable error path (NOT the live WebGL
canvas — `SigmaView` is a client-only component; `sigma` reads WebGL globals at import). **Deferred:**
a real layout pass (ForceAtlas2 / noverlap), force-sim controls, crossfilter panels, lasso /
ego-expand, and styling polish.

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
