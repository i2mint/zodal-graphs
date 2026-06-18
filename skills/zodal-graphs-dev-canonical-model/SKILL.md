---
name: zodal-graphs-dev-canonical-model
description: Use when working on the zodal-graphs CANONICAL GRAPH DATA MODEL — the keystone hub every other package consumes. Triggers when defining or changing CanonicalGraph / GraphNode / GraphPort / GraphEdge, the serialized nodes_and_links wire shape, the GraphCapabilities or RendererCapabilities vocabularies, the GraphOverlays/Selection/Styling/Layout presentation layers, defineGraph, or any adapter (graphology, React Flow, ELK JSON, Cytoscape, GraphML/GEXF, networkx). Also when touching Zod-v4 schema modeling for nodes/edges/ports/affordances or the port-fidelity round-trip benchmark. Read BEFORE writing model code — the port contract is easy to get wrong and expensive to change later.
metadata:
  audience: developers
---

# zodal-graphs · canonical model (the keystone)

The canonical model is **the contract every other regime consumes**. Build it first,
get the **typed-port** representation right, and prove fidelity with a round-trip
benchmark before layering anything on. This skill is the procedural guide; the *why*
and the surveyed alternatives live in the research (routed below).

## The one rule that shapes everything

**Three layers stay physically separate and separately serializable:**

1. **Topology** — `CanonicalGraph` (nodes, edges, ports). Pure structure.
2. **Schema + affordances** — Zod v4 schemas + `GraphCapabilities`. What the graph *is*
   and what you can *do* with it.
3. **Presentation** — `GraphOverlays` (highlights), `GraphStyling`, `GraphSelection`,
   `GraphLayout`. How a renderer *draws* it.

Renderer formats (React Flow, Cytoscape) **fuse** position/selection into topology. Every
`fromX` adapter MUST strip that presentation back out into layer 3, or round-trips drift.

## Canonical shapes (the contracts)

```ts
CanonicalGraph<N,E> = { directed, multigraph, nodes: GraphNode<N>[], edges: GraphEdge<E>[], graph: GraphMeta }
GraphNode<TData>    = { id, kind: 'var'|'func'|'entity', type?, ports?: GraphPort[], data?, position? }
GraphPort           = { port, param?, type?: PortTypeRef, kind?: <python-param-kind>, required?, default?, direction: 'in'|'out' }
GraphEdge<TData>    = { id, source, target, sourcePort?, targetPort?, type?, data? }   // targetPort = the field flat node-link drops
```

Serialized wire shape = **`nodes_and_links` superset** (linked-compatible):
`{ directed, multigraph, nodes:[{id,kind,type?,ports?,data?}], links:[{id,source,target,sourcePort?,targetPort?}], graph:{ zodal:{ schemaRefs, capabilities, overlays, layout } } }`.

- `kind` is the **bipartite discriminator** (meshed = `func` + `var` nodes). Default the
  common case to portless entity graphs so bipartite complexity never leaks into simple graphs.
- `GraphPort` mirrors **one meshed `Sig` parameter**; `port` = the meshed `bind` value
  (unique within the node) and becomes the React Flow handle `id` so `targetHandle === targetPort`.

## Capability vocabularies

- **`GraphCapabilities`** (declared by the graph def, reported by the provider):
  `canAddNode/…/canReverseEdge, typedPorts, validatesConnections, canExtractSubgraph,
  canCollapseToComponent, executable, canStep, watchesValues, hasProvenance, canTimeTravel,
  traversal: TraversalKind[], views: GraphView[], scaleClass: 'small'|'medium'|'large'|'huge',
  hasIntervals`. `DEFAULT_GRAPH_CAPABILITIES` = read-only / no-ports / not-executable /
  `views:['node-link','table']` / `scaleClass:'small'`.
- **`RendererCapabilities`** (renderer-side honest descriptor): `typedPorts, editing,
  compoundNodes, directed, undirected, multigraph, provenanceOverlay, maxComfortableNodes,
  layoutEngines, rendering:'svg'|'canvas'|'webgl', side:'client'|'server'|'hybrid'`.
- `GraphView = 'node-link'|'table'|'matrix'|'timeline'|'form'`. Keep this enum SSOT — it is
  reused as the `activeView` state field in the table/matrix/form lens (P5).

`typedPorts` and `scaleClass` are **orthogonal**: WebGL renderers cannot draw ports, so a
high-`maxComfortableNodes` renderer MUST report `typedPorts:false`.

## The build gate (do not skip)

Write `toGraphology`/`fromGraphology` first (near-identity), then the two port-exercising
adapters: `toReactFlow`/`fromReactFlow` and `toELK`/`fromELK`. **Then round-trip a
port-rich fixture through every adapter.** If any round-trip drops a port-level edge
(`sourcePort`/`targetPort`), the hub's port contract is wrong — **STOP and fix the model
before adding more adapters.** This benchmark is the acceptance test for the first checkpoint.

## Zod v4 gotchas (these will bite)

- **Pin `zod` ≥ 4.1.13.** Below it `z.union` → `oneOf` (semantically wrong); at/after,
  `z.union` → `anyOf` and `z.discriminatedUnion` → `oneOf`. Use `z.discriminatedUnion` for
  all node/edge/port **type tags** (validator perf + clean `oneOf`).
- **`z.toJSONSchema()` throws** on unrepresentable types (bigint, int64, symbol, undefined,
  void, date, map, set) unless `unrepresentable:'any'`. Keep the canonical model inside the
  JSON-Schema-Draft-2020-12 representable subset.
- **Register-before-wrap.** `.meta()` returns a NEW instance; metadata is lost when wrapped
  with `.optional()/.nullable()/.default()/.array()`. Call
  `affordanceRegistry.register(innerSchema, …)` on the INNER schema before wrapping.
- Read internals via `schema._zod.def` (NOT `.shape`/`._def`). `.meta()` with no args reads
  metadata. Registries key by **object identity** (WeakMap), not structural equality.
- **Codegen round-trip:** nested `graph.*` meta must be added to BOTH the
  `extractAffordancesFromMeta` whitelist AND `FIELD_PROP_ORDER` (verify against zodal's
  `codegen.ts` — whether nested meta survives `toCode` is unverified).

## The genuinely-new module this regime owns

`portTypeCompatible(out: PortTypeRef, into: PortTypeRef): boolean` — a Zod-v4 subtyping
relation with **no existing precedent** (no format/library defines connect-time type
validity). It feeds React Flow's `isValidConnection`. **Start conservative** (exact
base-type match + wildcard); widen toward covariance/refinements/unions only when a real
case demands it. See `zodal-graphs-dev-registries` for how it plugs into the editor.

## Adapter invariants (learned the hard way — hold these for every new adapter)

A round-trip benchmark passing on the *happy-path* fixture is not enough; these invariants
came out of an adversarial review and are now non-negotiable for any `toX`/`fromX` pair:

1. **Never rely on a string separator that can appear in user data.** ELK packs endpoints as
   `"<node>::<port>"` — but ids/ports can *contain* `::`. Carry the authoritative endpoint
   (`source`/`target`/`sourcePort`/`targetPort`) **structurally** in a namespaced field; treat
   any packed string as a hint, parsed back only for foreign input.
2. **Reconstruct `directed`/`multigraph`/`graph` meta.** If the target format has no slot for
   them (React Flow, ELK), stash them in a namespaced `zodal` field and restore on the way in —
   don't silently default (a flipped `multigraph` flag corrupts downstream graphology).
3. **Build graphology as `multi: true` always**, and preserve the *original* `multigraph` flag
   out-of-band — otherwise a legitimate parallel/anti-parallel edge makes `addEdgeWithKey` throw.
4. **Deep-clone mutable sub-objects** (`ports`, `data`, graph meta) at the adapter boundary, in
   AND out — never alias the caller's objects into a live store (or vice-versa).
5. **Guard foreign input**: reject empty/hyperedge endpoints with a clear error rather than
   coercing to a dangling `''` node.
6. **Validate ids at the boundary**: `nodeId`/`edgeId`/`portId` reject empty strings, so a
   malformed wire fails loudly instead of producing a dangling reference.

## Known lossy edges (document, don't hide)

- GraphML `<port>` is weakly/inconsistently tool-supported; **GEXF has no ports.** Preserve
  ports in attributes and document the loss in the adapter.
- `funcRef` is a *reference* (qualname / import-path / content-hash), not the function. The
  model carries `{ ref, lang: 'ts'|'py'|…, hash? }` plus a `FuncRefResolver` contract type
  (`(funcRef) => Callable | Promise<Callable>`). **Decided (owner): full in-browser execution
  is a first-class goal** — pure-TS funcRefs resolve to JS and run directly; Python-backed
  funcRefs resolve via a consumer-supplied resolver (Pyodide/WASM or backend). The engine
  lives in `@zodal/graph-runtime`; **only the `funcRef`/`FuncRefResolver` types belong in
  `graph-core`.** Keep the model resolver-ready (don't bake a single execution strategy in).

## Docs routed into this skill

- **Primary:** [`docs/research/zgraph_04b -- declarative-facade-and-data-model.md`](../../docs/research/zgraph_04b%20--%20declarative-facade-and-data-model.md) — grounded design of every shape above.
- **External prior art:** `zgraph_04a -- A Declarative Facade and Canonical Graph Data Model…md`.
- **Substrate facts** (meshed/linked round-trip): [`docs/research/_grounding-brief.md`](../../docs/research/_grounding-brief.md).
- **Decision rationale / conflicts:** [`docs/research/_reconciliation.md`](../../docs/research/_reconciliation.md).
- Use the `/zodal-graphs-dev-research-lookup` skill to find anything else.

## Maintenance

This skill describes contracts under active construction. When a canonical shape changes in
code, update the shapes above in the SAME change, and reconcile `docs/dev-plan.md`. If a
contract here drifts from the implementation, fix it — skill hygiene is part of the work.
