# @zodal/graph-core

> The canonical graph data model and declarative facade for **zodal-graphs** — the graph
> specialization of [zodal](https://www.npmjs.com/org/zodal).

`@zodal/graph-core` is the keystone every other zodal-graphs package consumes. It owns the
canonical model, the capabilities vocabulary, the serializer, the pure adapters, and
`defineGraph`. It renders nothing and runs no layout engine — it is the thin, declarative hub.

## Install

```bash
pnpm add @zodal/graph-core @zodal/core zod
# optional — only if you use the graphology adapter:
pnpm add graphology
```

`@zodal/core`, `zod` (`>=4.1.13`), and `graphology` are peer dependencies.

## What's in it

| Layer | Exports |
|---|---|
| **Topology** | `CanonicalGraph`, `GraphNode` (`kind: var\|func\|entity`), `GraphPort`, `GraphEdge` (`sourcePort`/`targetPort`), branded ids, `FuncRef` / `FuncRefResolver` |
| **Schema + affordances** | `defineGraph`, `GraphCapabilities`, `DEFAULT_GRAPH_CAPABILITIES`, `RendererCapabilities`, `portTypeCompatible`, `portTypeRefFromZod` |
| **Presentation** | `GraphOverlays`, `GraphStyling`, `GraphSelection`, `GraphLayout` (kept separate from topology) |
| **Serialization** | `toNodesAndLinks` / `fromNodesAndLinks` (the `nodes_and_links` superset wire format) |
| **Adapters** | `toReactFlow`/`fromReactFlow`, `toELK`/`fromELK` (pure, dependency-free); `toGraphology`/`fromGraphology` at the `@zodal/graph-core/graphology` subpath |

## Quick start

```ts
import { defineGraph } from '@zodal/graph-core';
import { z } from 'zod';

const graph = defineGraph({
  nodeTypes: { Add: z.object({ x: z.number(), y: z.number() }) },
  edgeTypes: { wire: { source: 'Add', target: 'Add', portAware: true } },
  affordances: { editable: true, executable: true },
});

graph.getCapabilities();
// → { typedPorts: true, validatesConnections: true, executable: true, canStep: true,
//     canEditNode: true, views: ['node-link', 'table', 'form'], scaleClass: 'small', … }
```

The three separate, serializable layers — topology / schema+affordances / presentation — are
the contract every renderer and compute package builds on. A port-rich graph round-trips
through every adapter with **zero port-level edge loss** (the package's flagship test).

## The two genuinely-new pieces

Almost everything here wraps existing standards. Only two pieces have no off-the-shelf
precedent: **`portTypeCompatible`** (the Zod-v4 connect-time subtyping rule that feeds a
renderer's `isValidConnection`), shipped here at a conservative v0; and the bespoke interval
timeline (a separate package, later). See the monorepo `docs/dev-plan.md`.

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
