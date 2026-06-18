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
pnpm add @zodal/graph-compute graphology
```

`@zodal/graph-core` comes transitively; `graphology` is a peer dependency (the compute hub).

## Use

```ts
import { createTraversalEngine, computeOverlays } from '@zodal/graph-compute';

const engine = createTraversalEngine(graph); // builds the index once

engine.descendants('n1');        // { layer:'descendants', nodes:{ n1:'primary', …:'descendant' } }
engine.ancestors('n9');          // upstream reachable set
engine.stale(['n3', 'n4']);      // downstream-impacted set after a change (provenance)
engine.provenance('n9');         // upstream sources
engine.path('n1', 'n9');         // shortest path: nodes + the edges along it (or null)
engine.cycles();                 // one detected cycle, or null
engine.topologicalOrder();       // node-id order, or null if cyclic
engine.components();             // color nodes by weakly-connected component

// Capability-gated multi-layer overlay (only emits permitted layers):
const overlays = engine.overlays(
  { descendantsOf: 'n1', provenanceOf: 'n9', cycles: true },
  graphDef.getCapabilities(), // gates by GraphCapabilities.traversal + hasProvenance
);
// → { highlights: [ {layer, nodes, edges?}, … ] }  — apply on any renderer
```

`computeOverlays(graph, request, capabilities?)` is a one-shot equivalent.

## The one primitive

Everything runs on a single reachability BFS (`reach`): `'forward'` powers descendants/stale,
`'backward'` powers ancestors/provenance — so provenance is not a separate engine, just
point-reachability over the dependency edges.

## Scope (this checkpoint)

Included: reachability, shortest path, cycle detection, topological order, weakly-connected
components, and the provenance layers. **Deferred:** custom Tarjan (articulation/bridge), MST,
community detection, centralities, and the huge-scale columnar-overlay projection (see the
monorepo `docs/dev-plan.md`). Recursion-based cycle detection assumes graphs that fit the call
stack; large graphs will move to an iterative pass.

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
