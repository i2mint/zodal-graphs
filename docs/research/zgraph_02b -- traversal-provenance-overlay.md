# P2 — Renderer-Agnostic Traversal + Provenance Overlay Engine

> **Version note.** Claude Code grounded — full compute-library survey done here AND verified; the overlay-decoupling architecture is grounded in the P4 canonical model + the renderer-agnostic overlay config.

---

## 0. What this report decides

The facade exposes two capability bands that are, by design, **renderer-agnostic**: the `traversal` capability (cluster D — path / ancestors / descendants / cycle / component / critical-path / centrality) and the `hasProvenance` capability (cluster F — stale-set / downstream-impacted / lineage replay). The P4 grounding makes the architectural bet explicit:

> "Traversal & provenance overlays … are computed once by a **networkx-class backend** and emitted as **highlight/style data** … that *whatever* node-link renderer is currently selected consumes. They are modeled once, never per renderer — the brief's central bet." (04-declarative-facade-and-data-model.md §5.2)

This report answers the *implementation* question that bet defers: **which compute library actually plays the "networkx-class backend" role in the browser, and how does one overlay result fan out, unchanged, to React Flow, Cytoscape.js, sigma.js, and a GPU renderer?** It then draws the browser-vs-server boundary (when to delegate to Python networkx in the zodal backends) and confronts the scale risk P4 flagged: a `Record<nodeId, role>` overlay is infeasible at cosmograph scale.

The overlay data shape is **not reinvented here** — it is P4's serializable `GraphOverlays` block (04 §6), reproduced and tied to capability names in §3.

---

## 1. The compute checklist (what an overlay engine must produce)

The traversal/provenance affordances of the grounding brief (File-1 clusters D + F) reduce to a concrete algorithm checklist. Each row is a *role* an overlay can carry (`'path' | 'ancestors' | 'descendants' | 'stale' | 'cycle' | 'component' | 'critical-path' | 'community' | 'centrality'`), mapped to the algorithm that computes the node/edge id set:

| Overlay role (capability surface) | Algorithm | Capability tie |
|---|---|---|
| `path` (find-path, k-shortest) | BFS / Dijkstra / A* / all-simple-paths | `traversal` includes `'find-path'` |
| `critical-path` (longest / topo-order) | topological generations / longest path on DAG | `traversal` + `executable`/`canStep` (critical path = run order) |
| `ancestors` (upstream provenance) | reverse reachability (BFS/DFS on reversed edges) | `traversal` + `hasProvenance` (provenance = upstream lineage) |
| `descendants` (downstream impacted / **stale**) | forward reachability (BFS/DFS) | `traversal` + `hasProvenance` (stale-set = forward closure of a changed node) |
| `cycle` (detect-and-highlight-cycles) | cycle detection / SCC | `traversal`; also gates `executable` (a DAG must be acyclic) |
| `component` (color by connected component) | connected / strongly-connected components | `traversal` |
| `community` | Louvain | `traversal` (color-by-community) |
| `centrality` (size/color by importance) | degree / closeness / betweenness / pagerank | `traversal` |
| articulation / bridge | Tarjan low-link (biconnected) | `traversal` — **the documented gap (see §2)** |
| MST overlay | Kruskal / Prim | `traversal` — **a second gap (see §2)** |
| interval-relation | Allen 13-relation predicates | `hasIntervals` — **not a graph algorithm; lives in the timeline layer, out of scope here** |

The single most important observation, restated from File-1: **`stale` and `descendants` are the same computation** (forward reachability from a marked node), and **`ancestors` and "upstream provenance" are the same computation** (reverse reachability). The provenance overlay (`hasProvenance`) is not a separate engine — it is the traversal engine run over the `was_derived_from` derivation sub-DAG (lacing PROV-O, grounding brief §3 lacing model). This is why P4 unifies them under one renderer-agnostic overlay block. The compute layer therefore needs **one reachability primitive**, used twice.

---

## 2. Comparison table — compute libraries × algorithm coverage × model-decoupling × perf × license

Coverage legend: ✓ = first-class package/method; ✗ = absent; ~ = available but coupled or partial. The two columns the facade actually decides on are **model-decoupling** (can the algorithm run on a neutral data model, then return plain ids — *not* mutate a renderer?) and **license** (health-bar FLAG on copyleft/non-commercial).

| Library | Reach (anc/desc) | Shortest path | All-simple-paths | Cycle / topo / SCC | Components | Communities | Centralities | Articulation / bridge | MST | Model-decoupling | Perf class | License | Maintenance (verified) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **graphology + graphology-\*** | ✓ (`traversal` bfs/dfsFromNode) | ✓ (`shortest-path`: unweighted/Dijkstra/A*) | ✓ (`simple-path`: allSimplePaths) | ✓ (`dag`: hasCycle/topologicalSort/Generations) + `components` SCC | ✓ (`components`) | ✓ (`communities-louvain`) | ✓ (`metrics/centrality`: degree/closeness/betweenness/eigenvector/hits/pagerank) | ✗ **gap** | ✗ **gap** | **Best in JS** — one `Graph` object consumed by ~20 independent algo packages returning plain results; never mutates a renderer | Compute scales to tens of thousands in-browser for BFS/DFS; O(V·E) metrics move server-side | **MIT** | Core v0.26.0 (2025-02-08), repo commit 2025-12-03; satellites mature/slow (shortest-path 2.1.0 2024-03, dag 0.4.1 2023-12, louvain 2.0.2 2024-12, **traversal 0.3.1 & components 1.5.4 both 2022-04 ≈4yr**) — maturity, not abandonment |
| **Cytoscape.js (built-ins)** | ✓ (bfs/dfs) | ✓ (dijkstra/aStar/bellmanFord/floydWarshall) | ✗ | ✓ (components; no standalone topo-sort) | ✓ | ✗ (kargerStein min-cut only) | ✓ (closeness/betweenness/degree/pageRank) | **✓** (`hopcroftTarjanBiconnected` → cut vertices) | **✓** (`kruskal`) | **Weak** — algorithms are methods on a `cy` collection; compute is bound to one renderer's data model (the opposite of the facade requirement) | Canvas renderer; render degrades ~3–5k nodes (rule of thumb) | **MIT** | Active, mature 3.x line |
| **ngraph (ngraph.graph + ngraph.path)** | ~ (graph traversal primitives) | ✓✓ **best-in-class** (A*, A*-greedy, NBA* bidirectional, Dijkstra) | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | Good — minimal mutable graph, path module returns plain arrays | **Fastest** pathfinding at scale | ngraph.path **MIT** (1.6.1, 2025-11-18); ngraph.graph **BSD-3-Clause** (20.1.2, 2026-02-14) | Single-author (anvaka); healthy, bus-factor-1 |
| **jsnetworkx** | ~ | ~ | ~ | ~ | ~ | ~ | ~ | ~ | ✗ | (N/A) | (N/A) | BSD-style | **ABANDONED** — latest 0.3.4, 2015-07-19; 11 yr no release. **Do not adopt.** |
| **sigma.js** | — | — | — | — | — | — | — | — | — | N/A — **renderer only**; delegates ALL algorithms to its graphology data backend | WebGL; interactive into tens of thousands | **MIT** | Active (Yomguithereal/jacomyal); v3 stable, v4 beta |
| **cosmos.gl** (`cosmosgl/graph`) | — | — | — | — | — | — | — | — | — | N/A — **GPU renderer + force layout only**; no graph-theory API | **GPU** — 1M+ nodes, several M edges real-time | **MIT** (OpenJS Foundation continuation) | Active; v3 rendering engine (luma.gl / WebGL2) |
| *legacy* `@cosmograph/cosmos` | — | — | — | — | — | — | — | — | — | (renderer) | GPU | **MIT** (deprecated) | the old engine; **MIT but deprecated** → moved to `@cosmos.gl/graph` (MIT). NB: the *non-commercial* CC-BY-NC-4.0 license is on the higher-level `@cosmograph/cosmograph` / `@cosmograph/react` library, **not** on this engine package |
| **d3-dag** | — | — | — | topo/layered only | — | — | — | — | — | N/A — **DAG layout engine**, not algorithms; a `GraphLayout.algorithm` hint producer | — | **MIT** | Active, TS-first |
| **networkx (Python, server-side)** | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **Authoritative** — full catalog; returns plain id sets the overlay block ingests verbatim | Server CPU; the heavy-algorithm tier | **BSD-3-Clause** | Very active (3.6.x, 2025) |

**Verifier-driven caveats baked into the table:**

- The perf columns are **rules of thumb, not measured benchmarks** for this facade. Independent 2026 comparisons corroborate the *ordering* (Canvas ≪ WebGL ≪ GPU) but every source warns against citing universal node-count numbers — "Test your own graph shape, labels, edge density, layout strategy, and target hardware." Treat ~3–5k (Canvas), tens-of-thousands (WebGL), 1M+ (GPU) as bands to validate, never promises [4][6][7].
- Cytoscape coverage is **understated in the original survey**: it ships *both* `kruskal` (MST) **and** `hopcroftTarjanBiconnected` (articulation points / cut vertices), so both graphology gaps are technically available off-the-shelf — but **coupled to Cytoscape's renderer/Collection model**, which is exactly what the renderer-agnostic facade must avoid [5].
- The "graphology Graph is the model sigma.js renders natively, and adapts to React Flow / Cytoscape with thin adapters" claim holds, with one correction: **native** for sigma.js (graphology *is* its data backend); for React Flow and Cytoscape the adapters are **bespoke thin mappers you write**, not off-the-shelf bridges [3][8].

---

## 3. Recommended compute layer

**Recommendation: graphology + graphology-\* as the in-browser compute hub, with a ~50-line custom Tarjan module for the articulation/bridge gap, networkx as the server-side authority tier (§4), and ngraph.path as an optional drop-in only when fast large-graph pathfinding becomes the dominant need.**

Rationale, in order of weight:

1. **It is the only JS library whose architecture matches the facade's requirement.** A single mutable `Graph` object is consumed by independent algorithm packages that *take the graph as input and return plain results* — node/edge id arrays, never a mutated renderer. This is precisely the "compute once, render anywhere" separation the overlay engine needs. Cytoscape's algorithms, by contrast, are methods on a `cy` collection: adopting them as the compute layer would re-couple compute to one renderer, defeating the `traversal`/`hasProvenance` renderer-agnostic design.
2. **Coverage matches the checklist** with two named gaps. graphology covers reachability (the load-bearing primitive for both `descendants`/`stale` and `ancestors`/provenance), shortest/all-simple paths, cycle/topo/SCC, components, Louvain communities, and the full centrality suite. **Verified gaps: articulation points, bridges, biconnected components, MST** — none exist in the 23-package standard library [2].
3. **The gaps are cheap to close without re-coupling.** Articulation points + bridges are one Tarjan low-link DFS pass over the same graphology `Graph` — a small standalone module (~50 lines), keeping compute renderer-agnostic. MST (Kruskal/Prim) is similarly a short module. We deliberately do **not** borrow Cytoscape's `kruskal`/`htb` for this, even though they exist [5], because importing a renderer to get an algorithm is the anti-pattern the facade exists to prevent. (If the graph is *already* in a Cytoscape instance for medium-scale viz, calling its built-ins opportunistically is fine — but the canonical compute path stays on graphology.)
4. **The data model already round-trips to graphology.** The P4 canonical hub is `nodes_and_links` (04 §2); `linked` converts it to/from `networkx_digraph`, `edgelist`, dataframes, and graphology's `SerializedGraph` is a near-isomorphic `{attributes, nodes, edges, options}` shape. Loading the canonical graph into a graphology `Graph` (bipartite var/func/entity ids as node keys, `targetPort` carried as an opaque edge attribute) is a thin, lossless import. Algorithms run on the **node-id topology** and ignore ports entirely — reachability does not care which named port an edge binds to, so the typed-port enrichment is inert to the compute layer.

**Maturity is a feature, not a risk here.** The verifier confirmed the satellite packages are old (traversal and components both ≈4 years) but this reflects API stability: BFS/DFS/Dijkstra/topo-sort are settled mathematics that do not churn. The core repo is actively maintained (commit 2025-12-03), the license is MIT, and there is no abandonment signal — unlike jsnetworkx, which is genuinely dead (11 years, no release) and must not be confused for the "NetworkX-equivalent." graphology is the modern NetworkX-equivalent in JS [1][2].

**ngraph.path** stays as a documented escape hatch: its NBA\* bidirectional A\* is best-in-class for shortest-path on very large graphs (MIT, actively published 2025-11) [verified]. It under-delivers on the rest of the checklist (no communities/centralities/SCC/articulation), so it is *not* the hub — only a swap-in for the `path` overlay when graphs grow past graphology's comfortable pathfinding range and `find-path` is the hot path.

---

## 4. Overlay-decoupling architecture

### 4.1 The single result object — P4's `GraphOverlays`, tied to capabilities

The overlay engine's *only* output contract is the serializable highlight block from 04 §6. An overlay result is **a set of node-ids/edge-ids + a role** — nothing renderer-specific:

```ts
// From 04-declarative-facade-and-data-model.md §6 — reproduced verbatim, the SSOT.
interface GraphOverlays {
  highlights: {
    /** 'path' | 'ancestors' | 'descendants' | 'stale' | 'cycle' | 'critical-path' | 'community' | 'component' */
    layer: string;
    nodes: Record<string /*nodeId*/, HighlightRole>;   // 'primary' | 'related' | 'dimmed' | 'stale' | ...
    edges?: Record<string /*edgeId*/, HighlightRole>;
  }[];
}
```

This block lives in `graph.zodal.overlays` on the canonical document (04 §3.2). It is **declared as data, owned by no renderer**, and is only produced when the graph's `GraphCapabilities` advertise it:

- `traversal: TraversalKind[]` gates which `layer` values the compute backend may emit (`'find-path'`, `'ancestors'`, `'descendants'`, `'community'`, etc.). A graph that declares `traversal: ['ancestors','descendants','find-path']` (04 §4.4 example) will only ever produce those three overlay layers.
- `hasProvenance: boolean` gates the `'stale'` and lineage layers — produced by running the *same* `descendants` reachability over the `was_derived_from` sub-DAG. When `hasProvenance` is false, the engine never computes a stale-set even if asked.

So the capability vocabulary is the contract surface: **`traversal` says which overlays exist; `hasProvenance` says whether the provenance specialization of `descendants`/`ancestors` is wired to the lineage edges.** Neither capability mentions a renderer.

### 4.2 The fan-out — one result, four renderers, zero per-renderer compute

```
                          ┌─────────────────────────────────────────────┐
                          │  COMPUTE LAYER  (renderer-agnostic)           │
   canonical graph ──────▶│  graphology Graph  +  graphology-* / Tarjan   │
   (nodes_and_links,      │  OR  networkx (server, §4.4)                  │
    via linked)           │                                               │
                          │  reachability(markedNode) ─┐                  │
                          │  shortestPath(a,b)         ├─▶ node/edge ids  │
                          │  louvain / centrality / …  ┘                  │
                          └───────────────────────┬───────────────────────┘
                                                  │  emits ONE object:
                                                  ▼
                          ┌───────────────────────────────────────────────┐
                          │  graph.zodal.overlays.highlights[]              │
                          │  { layer:'stale', nodes:{n7:'stale', …},        │
                          │    edges:{e12:'stale'} }                        │
                          └───────────────────────┬───────────────────────┘
                                                  │  thin per-renderer ADAPTER
                                                  │  (pure id→style mapping, no compute)
              ┌───────────────────┬───────────────┼───────────────────┬──────────────────┐
              ▼                   ▼               ▼                   ▼                  ▼
        React Flow          Cytoscape.js       sigma.js          cosmos.gl (GPU)    TanStack Table
   node.data.highlight  ele.addClass(role)  reducer:           per-node color     row className
   = role; CSS class;   via style selector  nodeReducer(n) →   buffer write       by id∈nodes;
   edge stroke by role  .stale {…}          { color, zIndex }  (typed array §5)   "stale" badge
```

Each renderer adapter is a **pure projection from `(nodeId → role)` to that renderer's native styling channel** — no algorithm runs inside it:

- **React Flow** — map `role` onto `node.data.__overlayRole` (and an edge equivalent); a CSS class or a `style` prop colors it. The renderer already re-renders on data change; the adapter is a `nodes.map(...)`.
- **Cytoscape.js** — `cy.batch(() => { cy.nodes().removeClass('overlay'); ids.forEach(id => cy.$id(id).addClass(role)); })`, with roles defined once in the Cytoscape stylesheet (`.stale { background-color: … }`). Note we use Cytoscape *only as a renderer* here; its built-in algorithms are not the compute source.
- **sigma.js** — a `nodeReducer` / `edgeReducer` is sigma's idiomatic, allocation-free way to restyle by id: `nodeReducer: (id, attrs) => ({ ...attrs, color: roleColor[overlay.nodes[id]] ?? attrs.color })`. Because sigma's data backend *is* graphology, the overlay map indexes by the exact same node keys the compute layer used — no id translation.
- **cosmos.gl (GPU)** — the role map is projected into a per-node color/size **typed array** the GPU consumes (see §5; this is where `Record<nodeId, role>` is the *wrong* wire shape and must be replaced by a columnar projection).

The decoupling property that makes this work: **the overlay is keyed by stable node/edge ids from the canonical model, and every renderer addresses its elements by those same ids.** The compute layer never imports a renderer; each renderer adapter never imports an algorithm. Switching renderers (the registry's job, 04 §5.2) changes *only* which adapter consumes the unchanged overlay object. This is the literal realization of P4's "modeled once, never per renderer."

### 4.3 Styling vs. highlighting — reuse the existing `GraphStyling` channel

A subtlety from 04 §6: `centrality` and `community` overlays are *also* expressible as `GraphStyling.rules` (declarative `field → visual channel` mappings), because once the compute layer writes a `centrality` score back onto a node attribute, "size by centrality" is just `style-by-attribute` — which 04 notes is "free once a field is resolvable." So the engine has two emission modes:

1. **Discrete highlight** (`path`, `ancestors`, `descendants`, `stale`, `cycle`, `component`) → `GraphOverlays.highlights` (id → role).
2. **Continuous style** (`centrality`, `community`) → write a derived attribute, then a `GraphStyling.rule` maps it to color/size. Reuses zodal's existing affordance-driven styling generators (grounding brief substrate §4).

Both are serializable data on the canonical document; both are renderer-agnostic.

### 4.4 Provenance specialization

Provenance (`hasProvenance`) is not a new engine. The lineage graph is the `was_derived_from` sub-DAG (lacing PROV-O, grounding brief §3): a derivation edge `B was_derived_from A` is exactly a graph edge `A → B`. Therefore:

- **"highlight downstream impacted / flag stale derivatives"** = `descendants(markedNode)` over the derivation DAG → overlay `layer: 'stale'`.
- **"inspect node provenance / follow derived-from"** = `ancestors(node)` over the derivation DAG → overlay `layer: 'ancestors'`.
- **"replay state at time" / time-travel** (`canTimeTravel`) is *not* a graph traversal — it is a temporal filter on the provenance ledger and belongs to the timeline/state layer, not this engine.

This is why the engine needs one reachability primitive used twice and nothing provenance-specific beyond pointing it at the lineage edge set.

---

## 5. Browser-vs-server boundary — when to delegate to Python networkx

The decisive fact: **zodal backends are Python**, so networkx is already in reach as the authoritative compute tier (grounding brief: networkx is the "canonical compute/interchange layer … authoritative algorithm catalog"). The overlay result shape is identical whether computed in-browser by graphology or server-side by networkx — both return id sets that populate the same `GraphOverlays` block. So the boundary is a *cost/latency* decision, not an architecture decision.

**Compute in-browser (graphology) when:**

- **Interactive, per-gesture overlays.** `find-path`, `highlight-neighbors`, `expand-ego-or-k-hop`, hover-to-show-ancestors — these must respond within a frame budget and cannot round-trip to a server. Reachability (BFS/DFS) scales to tens of thousands of nodes in-browser comfortably (rule of thumb — verify [4][6]).
- **The graph already lives client-side** (small-rich editor regime: meshed, ij edit-slice, graph_dbs scene). The data is in the renderer's memory; shipping it to a server to compute `descendants` would be absurd.
- `scaleClass` is `'small'` or `'medium'`.

**Delegate to Python networkx (server-side) when:**

- **Heavy O(V·E) or all-pairs algorithms:** betweenness centrality, eigenvector centrality, all-pairs shortest path, Louvain on large graphs. These should move server-side "well before" the render ceiling — the verified guidance is that BFS/DFS reachability scales to tens of thousands in-browser, but the quadratic-class metrics do not [4].
- `scaleClass` is `'large'` or `'huge'` — the graph may not even fit comfortably in browser memory, let alone admit interactive whole-graph metrics.
- **The authoritative algorithm is required** and has no JS equivalent (the graphology gaps: networkx has articulation points, bridges, MST, and the full catalog out of the box — so for a one-shot server computation, prefer networkx over the custom Tarjan module).
- **Provenance lineage is stored server-side** (nw-class per-project lineage ledger): the `was_derived_from` DAG lives in the backend; computing the stale-set there and shipping only the result id list is cheaper than shipping the whole lineage graph to the client.

**The contract that makes the boundary invisible:** a `GraphDataProvider` reports a `getGraphCapabilities()` (04 §5.1, analogous to `ProviderCapabilities.getCapabilities()`). Its `traversal` list and a server-side-compute flag tell the facade *where* an overlay is computed; the **returned `GraphOverlays` object is byte-identical either way.** A server-computed overlay arrives as JSON and is fed to the exact same renderer adapter as a browser-computed one. This mirrors zodal's existing `serverFilter`/`serverSort` honest-capability-reporting pattern (grounding brief substrate §3): the provider declares what it does server-side, the client fills the rest.

---

## 6. Risks / unknowns

1. **The huge-graph overlay-shipping problem (P4-flagged, the headline risk).** P4 §9.5 states it directly: the overlay is `Record<nodeId, role>`, and "for cosmograph-scale graphs (100k–1M nodes) this map is itself huge; shipping it as JSON per-overlay is infeasible." A JSON object with a million string keys is hundreds of MB and will not serialize, transfer, or parse interactively. **At `scaleClass: 'huge'` the `Record<nodeId, role>` shape must be abandoned** in favor of one of:
   - a **columnar / typed-array** projection — a `Uint8Array` of role codes indexed by the node's ordinal position (the same Apache Arrow / typed-buffer discipline cosmos.gl already uses to ship node data to the GPU [verified]); the overlay becomes `{ layer, roleByIndex: Uint8Array, codes: {0:'dimmed',1:'stale',...} }`.
   - **compute-on-the-renderer** — for GPU renderers, push the marked-node set and run reachability/coloring in a shader pass, never materializing a per-node map on the CPU.
   - **sparse-only** — ship only the *non-default* ids (the highlighted minority), letting everything else default to `'dimmed'`/unstyled. Viable when overlays are selective (a path, an ego-network) but not when most of the graph is affected.
   This is an **open design fork**, not a solved problem: the small-graph overlay mechanism (id→role JSON record) and the huge-graph mechanism (columnar/shader) are genuinely different, and the facade needs a `scaleClass`-keyed switch between them. Flagged as the largest unknown in the overlay engine.

2. **Perf bands are unbenchmarked for this facade.** The ~3–5k (Canvas) / tens-of-thousands (WebGL) / 1M+ (GPU) figures are corroborated *rules of thumb* whose sources explicitly forbid citing them as universal benchmarks [4][6][7]. They depend on edge density, label rendering, and hardware. Any `scaleClass` threshold (04 §5.1: `<50 | <2k | <50k | 50k+`) and any browser-vs-server cutover point **must be measured on representative zodal graph shapes before being promised**. Treat as estimates.

3. **Custom Tarjan module is unwritten and untested.** The articulation/bridge gap is real and confirmed [2]; the ~50-line low-link DFS is a *reasonable estimate*, not delivered code. Edge cases (disconnected graphs, self-loops, the directed-vs-undirected semantics of "bridge") need test coverage. If correctness risk is unacceptable, the lower-risk path is to delegate articulation/bridge/MST to server-side networkx (which has them battle-tested) rather than ship a hand-rolled module — a deliberate browser-vs-server trade.

4. **graphology satellite staleness is a maturity bet, not abandonment — but monitor it.** traversal (0.3.1) and components (1.5.4) are ≈4 years old [verified]. The bet is that BFS/DFS/components are settled and don't need updates. The residual risk is a future graphology core (v0.27+) breaking a stale satellite's peer range with no maintainer to bump it. Low probability (same maintainer, core still active), but pin versions and keep the custom-module fallback warm.

5. **License FLAGs on the GPU tier — resolved, but the trap is real (corrected).** The non-commercial **CC-BY-NC-4.0** license is on the **high-level `@cosmograph/cosmograph` / `@cosmograph/react` library** (verified on the npm registry: both `2.3.2`, CC-BY-NC-4.0) — a hard FLAG for any commercial use of the facade. The low-level **engine** `@cosmograph/cosmos` is actually **MIT but deprecated** (moved to `@cosmos.gl/graph`), and the OpenJS Foundation continuation **`@cosmos.gl/graph` is MIT** (`3.0.0`) [verified — npm registry JSON]. *(Earlier drafts of this report pinned the NC license on `@cosmograph/cosmos`; that was wrong — the engine package is MIT. The recommended action is unchanged.)* **Action:** the huge-scale renderer adapter must target **`@cosmos.gl/graph` (MIT)** — optionally via the MIT `@sqlrooms/cosmos` React wrapper — and treat `@cosmograph/react` (CC-BY-NC-4.0) as a non-commercial opt-in only. This is a live footgun because the high-level library's NC terms are easy to miss behind the MIT engine. All other recommended libraries are permissive: graphology MIT, ngraph.path MIT, ngraph.graph BSD-3, sigma.js MIT, Cytoscape.js MIT, networkx BSD-3 [all verified].

6. **id stability across the boundary.** The decoupling rests on node/edge ids being identical in the canonical model, the compute layer, and every renderer. If a renderer rewrites ids (some import paths synthesize positional ids), the overlay map silently mis-targets. The adapters must guarantee a 1:1 id passthrough, and any renderer that cannot preserve canonical ids needs an explicit id-translation table — an integration risk to test per renderer.

7. **Interval/Allen overlays are out of this engine's scope but easy to mis-file.** `interval-relation-query` (cluster D in File-1) is *not* a graph-traversal algorithm; it is an Allen-13-relation predicate over `hasIntervals` timeline data (grounding brief lacing model). It does not belong in the graphology/networkx compute layer and must not be wedged in — it is the timeline renderer's concern (flagged by P4 §9.6 as the thinnest off-the-shelf path). Listed here only to prevent scope leakage into the overlay engine.

---

## References

[1] [graphology — GitHub repository](https://github.com/graphology/graphology). MIT; core v0.26.0 (2025-02-08), repo actively maintained (commit 2025-12-03). The modern NetworkX-equivalent for JavaScript.

[2] [graphology — Standard Library index](https://graphology.github.io/standard-library/). 23 packages; confirms shortest-path / simple-path / dag / traversal / components / communities-louvain / metrics-centrality coverage and confirms the **absence** of articulation-points, bridges, biconnected-components, and MST packages.

[3] [sigma.js — official site (graphology as data backend)](https://www.sigmajs.org/). "Graphology handles graph data model & algorithms; Sigma.js handles graph rendering & interactions." Native graphology consumption.

[4] [graphology-shortest-path — npm registry metadata](https://registry.npmjs.org/graphology-shortest-path). Satellite versions/dates: shortest-path 2.1.0 (2024-03-27), used to verify maturity-not-abandonment framing.

[5] [Cytoscape.js — official documentation](https://js.cytoscape.org/). MIT; built-in `kruskal` (MST) and `hopcroftTarjanBiconnected` (cut vertices / articulation points), plus dijkstra/aStar/bellmanFord/floydWarshall/pageRank/centralities — all coupled to the `cy` Collection model.

[6] [Cytoscape vs vis-network vs sigma — graph visualization comparison (2026)](https://www.pkgpulse.com/blog/cytoscape-vs-vis-network-vs-sigma-graph-visualization-javascript-2026). Corroborates Canvas ≪ WebGL ≪ GPU ordering as rules of thumb; explicitly warns against universal node-count benchmarks.

[7] [Introducing cosmos.gl — OpenJS Foundation](https://openjsf.org/blog/introducing-cosmos-gl). GPU force layout + rendering, 1M+ nodes / several M edges real-time, Apache Arrow data transfer; now an OpenJS incubating project. Repo: [cosmosgl/graph (MIT)](https://github.com/cosmosgl/graph).

[8] [Sigma.js — GitHub repository (jacomyal/sigma.js)](https://github.com/jacomyal/sigma.js/). MIT; built on graphology; WebGL rendering for graphs of thousands–tens-of-thousands of nodes.

[9] [ngraph.path — npm](https://www.npmjs.com/package/ngraph.path). MIT, v1.6.1 (2025-11-18); A*, A*-greedy, NBA* bidirectional, Dijkstra — best-in-class large-graph pathfinding. Companion [ngraph.graph (BSD-3-Clause, v20.1.2, 2026-02-14)](https://www.npmjs.com/package/ngraph.graph).

[10] [jsnetworkx — npm](https://www.npmjs.com/package/jsnetworkx). BSD-style; latest 0.3.4 (2015-07-19), no release in 11 years — abandoned, do not adopt.

[11] [NetworkX — documentation](https://networkx.org/documentation/stable/). BSD-3-Clause, very active (3.6.x, 2025); the authoritative algorithm catalog and the server-side compute tier (zodal backends are Python).

[12] [d3-dag — GitHub repository](https://github.com/erikbrinkman/d3-dag). MIT; TypeScript-first DAG **layout** engine (Sugiyama/coffman-graham) — a `GraphLayout.algorithm` hint producer, not a traversal/provenance compute backend.
