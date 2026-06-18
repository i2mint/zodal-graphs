# @zodal/graph-compute

> Renderer-agnostic **traversal + provenance overlays** for zodal-graphs — computed once on the
> canonical graph, drawn as highlights on any renderer.

Graph-theory results (paths, reachable sets, cycles, components, topological order) and
provenance results (downstream-impacted / upstream-sources) are computed **once** on the canonical
graph and emitted as a single `GraphOverlays` block of `{nodeId/edgeId → role}` layers. Any
renderer — React Flow, sigma, Cytoscape — draws them as highlights. This is the research's #2
tool-deciding insight: traversal and provenance are *overlays*, not per-renderer features.

## Install

```bash
pnpm add @zodal/graph-compute
```

`@zodal/graph-core` comes transitively. The overlay engine builds its index directly from the
canonical model (ids + endpoints), so it has no graphology dependency; graphology remains the
*rendering* hub (sigma) via `@zodal/graph-core`'s adapter, and these overlays apply to it by id.
All node/edge ids are canonical id strings.

## Use

```ts
import { createTraversalEngine, computeOverlays } from '@zodal/graph-compute';

const engine = createTraversalEngine(graph); // builds the index once

engine.descendants('n1');        // { layer:'descendants', nodes:{ n1:'primary', …:'descendant' } }
engine.ancestors('n9');          // upstream reachable set
engine.stale(['n3', 'n4']);      // downstream-impacted set after a change (provenance)
engine.provenance('n9');         // upstream sources
engine.path('n1', 'n9');         // shortest path: nodes + the edges along it (or null)
engine.cycles();                 // one detected cycle (nodes + edges), or null
engine.topologicalOrder();       // node-id order, or null if cyclic (method-only, not an overlay)
engine.components();             // color nodes by weakly-connected component

// Capability-gated multi-layer overlay — emits permitted layers AND reports refusals:
const { overlays, refused } = engine.overlays(
  { descendantsOf: 'n1', provenanceOf: 'n9', cycles: true },
  graphDef.getCapabilities(), // gates by GraphCapabilities.traversal + hasProvenance
);
// overlays → { highlights: [ {layer, nodes, edges?}, … ] }  — apply on any renderer
// refused  → [ {request, reason, kind?}, … ]  — what was requested but not permitted (honest, like graph-ui's degrade)
```

`computeOverlays(graph, request, capabilities?)` is a one-shot equivalent.

## The one primitive

Everything runs on a single reachability BFS (`reach`): `'forward'` powers descendants/stale,
`'backward'` powers ancestors/provenance — so provenance is not a separate engine, just
point-reachability over the dependency edges.

## Scope (this checkpoint)

**Included:** the reachability primitive, shortest path, iterative (depth-safe) cycle detection,
topological order (method-only), weakly-connected components, and the provenance layers — all
edge-carrying so multigraph parallel edges are highlighted correctly, and capability-gated with an
honest refusal report.

**Deferred** (see the monorepo `docs/dev-plan.md` §5 for the sequence and rationale):
- the **huge-scale columnar-overlay projection** (the plan's headline deferred item — `Record<id,role>`
  is infeasible at 100k–1M nodes);
- **custom Tarjan** (articulation points / bridges) — the research's sanctioned fallback for this gap
  is server-side networkx;
- the **server / networkx boundary** + a `GraphDataProvider`-style honest-capability contract (so a
  `GraphOverlays` object arrives byte-identical from the browser or a backend) — research §5;
- **critical-path** overlays, MST, community detection, and centralities.

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
