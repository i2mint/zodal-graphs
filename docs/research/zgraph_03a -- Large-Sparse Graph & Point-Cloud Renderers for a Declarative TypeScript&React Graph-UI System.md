# Large-Sparse Graph & Point-Cloud Renderers for a Declarative TypeScript/React Graph-UI System

*Author: Thor Whalen — June 18, 2026*

> **Note on delivery:** This report is provided as publication-ready Markdown. To produce the requested downloadable `.md` file, save the content below verbatim as `large-sparse-renderers.md`.

## TL;DR
- **For the "large-sparse" slot, Cosmograph (built on the MIT-licensed cosmos.gl engine) is the most capable single renderer** — it is the only browser library that credibly drives 1M+ nodes/links with GPU force-simulation, built-in crossfilter (DuckDB-WASM), histograms, legends, and rectangle/polygon selection — **but the Cosmograph layer is CC-BY-NC-4.0 (non-commercial), a hard licensing flag** [1][7][8].
- **The permissive open-source fallback is sigma.js + graphology (both MIT)** [11][13], which comfortably handles tens of thousands (low hundreds of thousands with care) of nodes/edges with a real React wrapper (`@react-sigma/core`) and a rich, serializable data/algorithm layer; **deck.gl (MIT, OpenJS)** is the better choice when the scene is fundamentally a point-cloud/scatterplot with GPU crossfilter [19][20].
- **The editor↔viz handoff is best built as a capability-based registry over one shared headless model**: keep the Zod-validated graph model, IDs, selection set, and attribute→style config invariant; swap only the *renderer* (React Flow/Rete.js below threshold; sigma/Cosmograph/deck.gl above it). Force-simulation, lasso, LOD, and labels are renderer-owned capabilities that degrade or disappear on the small-rich editor side.

## Key Findings

1. **Scale tiers are real and separate the field.** Canvas/SVG libraries (Cytoscape.js, React Flow, Rete.js, G6 in canvas mode) are interactive into the low thousands and strain past ~5–10k elements [14]. WebGL libraries (sigma.js, deck.gl, react-force-graph) reach tens of thousands to a few hundred thousand. Only cosmos.gl/Cosmograph, which run the *entire force simulation and rendering on the GPU*, claim and demonstrate 1M+ points/links interactively [4][8].

2. **"GPU force-simulation with live control" is rare.** cosmos.gl is the standout: simulation is decoupled from rendering with `start()/stop()/pause()/unpause()` and tunable gravity/repulsion/link-spring/friction [4]. react-force-graph offers live CPU/d3-force control [28]. sigma.js delegates layout to graphology's ForceAtlas2 (which has a supervisor with start/stop, but it's CPU and a separate package) [10]. deck.gl has no built-in graph force layout [20].

3. **Licensing is the decisive constraint.** cosmos.gl is MIT (OpenJS incubating project) [3][8], but **Cosmograph's higher-level library (`@cosmograph/cosmograph`, `@cosmograph/react`) and UI components are CC-BY-NC-4.0 — non-commercial only** [1][7]. ReGraph/KeyLines (Cambridge Intelligence) and GoJS (Northwoods) are commercial/subscription [25][26][32][33]. sigma.js, graphology, deck.gl, Cytoscape.js, G6, React Flow, Rete.js, react-force-graph, VivaGraph/ngraph are all MIT.

4. **Cosmograph is the multi-backend point-cloud + graph viewer**, with two modes (Graph mode with simulation/links; Embedding mode with precomputed coordinates and no links) covering embedding/k-NN scenes, DB query-result scenes (DuckDB), and pre-laid-out graphs [6]. Its limits: **no edge bundling, weak/limited directed-arrow rendering, and links auto-disabled above 250k nodes**; structural updates are possible but the data model is typed-array/columnar, not edit-friendly [6][4].

5. **Data prep varies widely.** Cosmograph/cosmos.gl want columnar points+links tables (CSV/Parquet/Arrow/DuckDB) or Float32Arrays of positions and source/target index pairs [1][3]. graphology/sigma want a node/edge object model (or serialized graphology JSON / GEXF) [11][13]. deck.gl wants arrays of JSON objects (or binary columns) with accessor functions [20]. This maps cleanly onto a Zod-validated facade.

## Details

### 1) Renderer-by-renderer: technology, scale ceiling, React story

**Cosmograph (cosmos.gl / `@cosmograph/react`).** Technology: WebGL2 (cosmos.gl v3 ported rendering from regl to luma.gl); *all computation and drawing on GPU* [3]. Scale: hundreds of thousands of nodes/links comfortably; Cosmograph's own documentation states it "still remains the only single-node web-based tool capable of visualizing graphs with 1 million points and way more than a million links due to its unique GPU Force Layout and Rendering engine cosmos.gl" [8]. React: first-class — `@cosmograph/react` (latest 2.3.2, published ~May 2026) ships `<Cosmograph>`, `<CosmographProvider>`, `useCosmograph()` hook, and companion components (`CosmographHistogram`, `CosmographTimeline`, `CosmographSearch`, `CosmographSizeLegend`, `CosmographRangeColorLegend`, `CosmographButtonRectangularSelection`, `CosmographButtonPolygonalSelection`, etc.) [1].

**sigma.js (+ graphology).** Technology: WebGL (canvas only for labels/edge-labels overlay) [11]. Scale: explicitly "thousands of nodes and edges" [11]; in practice tens of thousands smoothly, low hundreds of thousands with tuning (label declutter, edge hiding). React: `@react-sigma/core` is the recommended, idiomatic wrapper (`<SigmaContainer>`, hooks like `useSigma`, `useLoadGraph`, `useRegisterEvents`) [11][12]. License MIT; stars ~12k; stable **v3.0.3**, with **v4 in alpha** (renderer API rewrite, order-independent transparency, DOM labels planned) [10][11]. Maintained by OuestWare (Jacomy & Simard) with Guillaume Plique (médialab) maintaining graphology; v3/v4 sponsored by gdotv [10]. graphology is MIT, ~1.7k stars, and supplies the data model, ForceAtlas2 layout, metrics, and community detection (Louvain) [11][13].

**Cytoscape.js.** Technology: Canvas (single-threaded); a **WebGL renderer shipped as a preview in v3.31 (Jan 2025)** and remains an opt-in `webgl: true` preview through v3.34.0 (Jun 2, 2026) — node/label rendering complete, edge styles limited [16][17]. Scale: interactive to ~2–3k elements on canvas; per the maintainers' WebGL preview tests, "A publicly available network from NDExbio.org with approximately 3200 nodes and 68000 edges crawls at 3 FPS with the canvas renderer but improves to 10 FPS with the WebGL renderer" [16]. React: `react-cytoscapejs` (Plotly, MIT) is a thin, non-idiomatic wrapper [18]. License MIT (Cytoscape Consortium); ~11k stars [15]. Strong layout/algorithm library and a mature ecosystem, but architecturally a small/medium-graph analysis tool, not a large-sparse renderer.

**G6 / AntV (v5).** Technology: pluggable `@antv/g` engine — Canvas, SVG, *and* WebGL renderers, switchable at runtime; layouts can use Rust+WASM and some WebGPU acceleration [21][22]. Scale: thousands–tens of thousands; 3D large-graph mode for bigger structures [21]. React: official React integration guidance plus **Graphin** (React wrapper built on G6) [22]. License MIT; backed by Ant Group/AntV; ~12.2k stars; latest **v5.1.1 (Apr 17, 2026)**. A strong, modern, feature-rich generalist — but its sweet spot is rich mid-size analytics, not million-node point-clouds.

**deck.gl (ScatterplotLayer + LineLayer/ArcLayer, or GraphGL).** Technology: WebGPU/WebGL2 (luma.gl). Scale: per the docs, "deck.gl layers are able to handle millions of data objects very efficiently" [20]; documented examples render ~27M points via tiling. React: first-class `@deck.gl/react` (`<DeckGL>`), latest **v9.3.x (Jun 2, 2026)** [24]. License MIT, vis.gl/OpenJS Foundation; ~14.2k stars [19]. **Caveat: deck.gl is a general GPU dataviz framework, not a graph library** — there is no built-in force layout; you precompute positions (or use a separate engine) and render points+lines, then add GPU `DataFilterExtension`/`BrushingExtension` for crossfilter/brushing [23]. Best when the scene is conceptually a point-cloud/embedding rather than an editable network.

**ReGraph / KeyLines (Cambridge Intelligence) — COMMERCIAL.** Technology: WebGL (Canvas fallback) [25]. Scale: per the official KeyLines FAQ, "on an average laptop we can maintain an impressive 60 fps when panning around a chart with 10,000 items with the WebGL renderer. Other benchmarks have shown the KeyLines WebGL renderer coping very well with networks of 100,000 items" [26]. React: ReGraph is purpose-built for React (data-driven `<Chart>` and `<TimeBar>` components, props/state-driven) [25]. License: **commercial, per-application subscription; the component stops working when the subscription lapses** — flag accordingly [27]. Excellent support, layouts, SNA, combos, time bar; mature and polished.

**ngraph / VivaGraphJS (anvaka).** Technology: WebGL or SVG; layout via `ngraph.forcelayout` (2D/3D/nD), with offline/native (C++) layout for huge graphs and a space-efficient binary format [29][30]. Scale: historically one of the fastest JS drawing libraries; handles large graphs especially with precomputed/offline layout [30]. React: **no official React bindings** — manual lifecycle integration [29]. License MIT. **Health caveat: low recent activity; effectively maintenance mode**, author-described as a learning project [29]. Useful as an algorithm/layout toolkit (and as react-force-graph's optional physics engine) more than as a maintained React renderer.

**Bonus contender — react-force-graph / force-graph (vasturiano).** Technology: 2D Canvas and 3D ThreeJS/WebGL; physics via d3-force(-3d) or ngraph [28]. Scale: tens of thousands of nodes; great for 3D/quick prototypes; less customizable styling than sigma+graphology. React: official `react-force-graph-2d/3d/vr/ar` packages with identical prop interfaces, incremental `graphData` updates, zoom/pan, node drag, hover/click [28]. License MIT; ~3.2k stars. A pragmatic mid-tier option with live force control out of the box.

### 2) Capability coverage matrix

Legend: ✅ built-in / first-class · ◑ partial, via extension/plugin, or needs custom code · ❌ not available / impractical · 💲 commercial

| Capability | Cosmograph | sigma.js+graphology | Cytoscape.js | G6 v5 | deck.gl | ReGraph/KeyLines 💲 | ngraph/Viva | react-force-graph |
|---|---|---|---|---|---|---|---|---|
| **GPU/iterative force-sim, live control** | ✅ GPU, start/stop/pause + gravity/repulsion/link-spring/friction | ◑ CPU ForceAtlas2 (graphology, start/stop supervisor) | ◑ CPU layouts (cola/fcose), limited live control | ◑ CPU/WASM/GPU layouts, animatable | ❌ no built-in graph force | ✅ animated layouts (CPU) | ◑ ngraph force (CPU/offline) | ✅ d3-force live control |
| **Pan/zoom/fit-to-view** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Zoom-to / locate node** | ✅ (search + camera API) | ✅ (camera `animate`) | ✅ (`fit`/`center`) | ✅ | ◑ (manual viewState) | ✅ | ◑ | ✅ |
| **Rectangle + polygon/lasso selection** | ✅ rect + polygon buttons | ◑ rect via plugin; lasso not core | ◑ box-select built-in; lasso via ext | ◑ brush-select behavior | ◑ via Nebula/editable layers or custom | ✅ | ❌ | ◑ custom |
| **Hover tooltips & context menus** | ✅ popups + onContextMenu callbacks | ✅ event hooks | ✅ + ext menus | ✅ (React tooltip/menu) | ✅ getTooltip + onClick | ✅ | ◑ manual | ✅ |
| **Style-by-attribute (+legends)** | ✅ data-driven color/size + legend components | ✅ reducers (node/edge); legends DIY | ✅ stylesheet selectors; legends DIY | ✅ data-mapping + theme | ✅ accessors; legends DIY | ✅ + styling API | ◑ manual | ◑ accessors |
| **Cluster/community coloring** | ✅ clustering force + color | ✅ Louvain in graphology | ◑ via ext/algorithms | ✅ combos + algorithms | ◑ precompute then color | ✅ combos | ◑ | ◑ precompute |
| **Filter/crossfilter (linked panels)** | ✅ DuckDB-WASM crossfilter + histograms/timeline/bars | ◑ via graphology + your own panels | ◑ manual | ◑ data processors + your UI | ✅ GPU DataFilter/Brushing ext (1–4 dims) | ✅ filtering + time bar | ❌ | ◑ manual |
| **Neighbor highlight / ego / k-hop expand** | ◑ selection + neighbor APIs | ✅ graphology traversal + reducers | ✅ `neighborhood()`, expand patterns | ✅ behaviors | ◑ compute + restyle | ✅ | ◑ | ◑ |
| **Label management at scale (declutter)** | ✅ sampling-based labels | ✅ LOD label policy | ✅ LOD label thresholds | ✅ LOD labels | ◑ TextLayer + collision ext | ✅ | ❌ | ◑ |
| **Sampling / LOD for huge graphs** | ✅ `getSampledNodePositionsMap`, auto link-drop >250k | ◑ camera-based, manual | ✅ LOD modes | ✅ LOD | ✅ tiling/aggregation | ✅ | ◑ offline | ❌ |
| **Screenshot / export** | ✅ | ✅ (PNG export API) | ✅ (`png()`/`jpg()`) | ✅ (toDataURL) | ✅ (canvas capture) | ✅ | ◑ | ✅ |

### 3) The multi-backend viewer: Cosmograph and its limits

Cosmograph is the clearest fit for "one GPU point-cloud + graph viewer serving several backends." It explicitly ships **two modes**: *Graph mode* (nodes + links, full GPU simulation) and *Embedding mode* (precomputed coordinates, no links, no simulation) for ML embedding/k-NN scenes [6]. Because the data layer is **DuckDB-WASM**, it ingests large query-result scenes directly (CSV/TSV/Parquet/Arrow/JSON, a URL, an Arrow table, or a named DuckDB table) and cross-filters millions of rows in-browser [1][5]. Pre-laid-out graphs load via Float32Array positions, skipping simulation [3].

**Limits to design around:**
- **No edge bundling.** Cosmos.gl renders straight or simply curved links; there is no hierarchical/force-directed edge bundling [3]. Dense graphs rely on opacity and clustering, not bundling.
- **Directed-edge arrows are limited.** Arrowheads exist (an accessor for `linkArrows` was added) but arrow rendering at scale is minimal compared with Cytoscape/ReGraph; for nuanced directed semantics it is weak [4].
- **Links auto-disabled past 250k nodes** (and high-res rendering downgraded) to preserve frame rate — a deliberate LOD tradeoff that affects very large graphs [6].
- **Structural updates are columnar, not edit-friendly.** v2/v3 use typed arrays (`setPointPositions`, `setLinks`) and index-based events; you can update data, but it is a "replace the buffers" model, not a fine-grained mutable graph suited to interactive structural editing [3][4].
- **Licensing:** the engine (cosmos.gl, MIT) is reusable commercially [3]; the **Cosmograph library/React components are CC-BY-NC-4.0** — per the Cosmograph licensing page, "Cosmograph is available free of charge for non-commercial use under the CC BY-NC 4.0 public license. If you're planning to use Cosmograph commercially, reach out to us for a proprietary license" [7]. For a commercial product you either negotiate a Cosmograph license or build your own UI directly on MIT cosmos.gl (losing the ready-made histograms/timeline/search/legends).

A notable MIT pattern: **`@sqlrooms/cosmos`** wraps `@cosmos.gl/graph` with React components (`CosmosGraph`, `CosmosGraphControls`, `CosmosSimulationControls`) and a DuckDB-backed store — a template for getting Cosmograph-like capability on a fully permissive stack [9].

### 4) Editor↔viz coexistence under one capability-based scheme

The system already implies the right architecture: a **headless, Zod-validated config** with a **capability-based renderer registry**. The handoff between a small-rich editor (React Flow / Rete.js) and a large-sparse viewer (sigma/Cosmograph/deck.gl) should be a *renderer swap over a shared model*, not a data migration.

**What stays invariant (model-owned):**
- **Data model**: the declared nodes/edges with stable IDs and typed attributes (the Zod schemas). Both sides read the same source of truth.
- **Selection model**: a set of selected IDs (+ optional ego/neighborhood spec) held in app state, renderer-agnostic. Each renderer projects it (React Flow `selected` flag; sigma reducer; cosmos selection arrays) [31][1].
- **Styling/filter config**: serializable attribute→encoding rules (color/size/shape/width scales, legends) and filter predicates. These are declarative and portable; only the *application mechanism* differs (React Flow per-node React components; sigma reducers; cosmos data-driven buffers; deck.gl accessors) [11][20].

**What swaps (renderer-owned capabilities):**
- **Rendering substrate & node richness**: React Flow/Rete.js render arbitrary HTML/React inside each node (rich, editable, draggable handles, ports) — viable only at small N [31][32]. Above threshold, nodes become GPU primitives (circles/sprites); per-element rich metadata is intentionally *not* individually displayed (the stated use case).
- **Structural editing**: create/connect/delete with handles/ports and undo/redo lives on the editor side (React Flow/Rete.js) [31][32]. The large-sparse viewer treats structure as mostly read-only.
- **Force-simulation, lasso/polygon select, LOD/label declutter, sampling, crossfilter**: these are *added* capabilities on the viewer side and absent/limited on the editor side.

**Recommended pattern — capability negotiation at a threshold.** Define a pure function `pickRenderer(graphStats, intent)` keyed on size (`|V|`, `|E|`, density) and intent (`edit` vs `explore`). Each registered renderer advertises a capability descriptor (`{maxNodes, supportsForceSim, supportsLasso, supportsRichNodes, supportsStructuralEdit, …}`). The facade selects the highest-fit renderer and **down-projects the shared config** into renderer-specific props through adapters. Threshold heuristics from the evidence: React Flow/Rete.js up to ~1–2k nodes (rich, editable); sigma.js ~2k–~100k (explore, MIT); Cosmograph/cosmos.gl/deck.gl beyond that (GPU explore). Crossing the threshold should preserve viewport focus and selection (zoom-to the previously selected node/ego) so the transition feels continuous. Keep capability-gated UI (lasso button, simulation controls, crossfilter panels) bound to the active renderer's advertised capabilities, hiding controls the current renderer can't honor.

### 5) Data ingestion & prep effort

| Renderer | Expected input | Prep effort |
|---|---|---|
| Cosmograph / cosmos.gl | `prepareCosmographData` over points/links **tables** (arrays, CSV/TSV, Parquet, Arrow, URL, or DuckDB table); cosmos.gl core wants **Float32Array** positions `[x1,y1,…]` + links `[src,tgt,…]` index pairs; config maps `pointIdBy`/`linkSourceBy`/`linkTargetsBy` [1][3] | Low–medium; columnar/tabular fits ETL and DB exports well; index-based links require an id→index map |
| sigma.js + graphology | graphology `Graph` object (programmatic add, or serialized graphology JSON / **GEXF** import); node needs `x,y,size,color`, optional `type` [11][13] | Low; object model is ergonomic; positions usually from a layout step |
| Cytoscape.js | elements array `{data:{id,source,target}, position}` (Cytoscape JSON) [18] | Low |
| G6 v5 | `{nodes:[], edges:[]}` JSON with data processors for transforms [21] | Low |
| deck.gl | arrays of JSON objects (or binary columns) + **accessor functions** (`getPosition`, `getSourcePosition`/`getTargetPosition`, `getFillColor`, `getFilterValue`) [20][23] | Low for points; medium to assemble link records and precompute positions |
| ReGraph/KeyLines 💲 | proprietary `items` object format (nodes/links keyed) [25] | Low–medium; you write a formatter |
| ngraph/Viva | programmatic `addNode/addLink`; binary format for huge graphs [29][30] | Medium |
| react-force-graph | `{nodes:[{id}], links:[{source,target}]}` JSON [28] | Low |

This columnar-or-object split maps cleanly onto a Zod facade: validate a canonical `{nodes, edges, nodeAttrs, edgeAttrs}` shape once, then emit per-renderer adapters (graphology builder, cosmos typed-array packer + id↔index map, deck.gl accessor closures).

### 6) Health & licensing summary

| Project | License | Stars (≈) | Latest / recency | Backing | Flags |
|---|---|---|---|---|---|
| cosmos.gl (`@cosmos.gl/graph`) | **MIT** | ~1.2k | v2.6.x / v3 line, active (commits 2026) | OpenJS Foundation (incubating); Rokotyan & Stukova | Permissive ✅ |
| Cosmograph (`@cosmograph/*`) | **CC-BY-NC-4.0** | n/a (issues-only repo) | react 2.3.2, ~May 2026 | Cosmograph team | **Non-commercial ⚠️** |
| sigma.js | MIT | ~12k | v3.0.3 stable; v4 alpha | OuestWare + médialab | Permissive ✅ |
| graphology | MIT | ~1.7k | active | Guillaume Plique | Permissive ✅ |
| Cytoscape.js | MIT | ~11k | v3.34.0 (Jun 2, 2026); WebGL still **preview** | Cytoscape Consortium | Permissive ✅ |
| G6 / AntV | MIT | ~12.2k | v5.1.1 (Apr 17, 2026) | Ant Group / AntV | Permissive ✅ |
| deck.gl | MIT | ~14.2k | v9.3.x (Jun 2, 2026) | vis.gl / OpenJS | Permissive ✅ |
| React Flow (`@xyflow/react`) | MIT | ~37k | v12.11.0 (Jun 2026) | xyflow | Permissive ✅ |
| Rete.js | MIT | ~12k | core v2.0.6 (~2024); plugins active | retejs / Stoliarov | Permissive ✅; core release cadence slow |
| react-force-graph | MIT | ~3.2k | active | vasturiano | Permissive ✅ |
| ngraph / VivaGraphJS | MIT | (moderate) | low recent activity | anvaka | Permissive ✅; **maintenance-mode ⚠️** |
| ReGraph / KeyLines | **Commercial** | n/a | active vendor releases | Cambridge Intelligence | **Commercial subscription ⚠️** |
| GoJS | **Commercial** | n/a (source-visible, not OSS) | active | Northwoods | **Commercial; individual license $3,995 ⚠️** [33] |

## Recommendations

**Primary recommendation (capability-first, license-aware):**
1. **If non-commercial use is acceptable (research, internal, academic): adopt Cosmograph (`@cosmograph/react`) as the large-sparse renderer.** It is the only library that delivers the full stated wishlist — GPU force-sim with live control, rect+polygon selection, attribute styling + legends, DuckDB crossfilter with linked histograms/timeline, sampling/LOD, and 1M-scale — behind a clean React component/hook API that fits a declarative facade [1][8]. Accept its limits (no edge bundling, weak arrows, columnar updates).
2. **If the product is commercial: build the large-sparse renderer on the MIT cosmos.gl engine directly** (optionally via the MIT `@sqlrooms/cosmos` React components) [3][9], and reconstruct the panels (histograms, legends, search) you need. You keep million-node GPU performance and a permissive license; you give up Cosmograph's turnkey analytics UI.

**Open-source fallback (permissive, lower ceiling): sigma.js + graphology via `@react-sigma/core`.** This is the pragmatic MIT default for tens of thousands (to ~100k with tuning) of elements: real WebGL performance, a genuinely React-idiomatic wrapper, ForceAtlas2 with start/stop, Louvain community detection, traversal for ego/k-hop, LOD labels, PNG export, and a serializable data model that maps directly onto Zod schemas [11][12][13]. Build crossfilter/linked panels yourself over graphology.

**Use deck.gl when the scene is fundamentally a point-cloud/embedding** (k-NN/embedding scatter with optional LineLayer edges) and you want GPU crossfilter (`DataFilterExtension`, `BrushingExtension`) under MIT — but precompute layout, since it has no graph force engine [20][23].

**Editor side:** keep **React Flow (`@xyflow/react`, MIT, ~37k stars, actively released)** for the small-rich editable node-link diagrams; it's the strongest-maintained, most React-native choice [31]. Use **Rete.js** only if you need its dataflow/control-flow processing engine [32].

**Staged plan:**
- *Stage 1 — MIT-only MVP:* React Flow (edit) + sigma.js/graphology (explore) under the capability registry; one Zod model, shared selection/style config. Ship this regardless of licensing decisions.
- *Stage 2 — scale headroom:* add a cosmos.gl-based (MIT) or Cosmograph (if non-commercial) renderer as the >100k-node tier; reuse the same model adapters.
- *Stage 3 — point-cloud backend:* add deck.gl scatterplot renderer for embedding/k-NN and DB-query scenes with GPU crossfilter.

**Thresholds that change the recommendation:**
- If interactive node counts stay **< ~10k** and rich per-node UI matters more than scale → React Flow/G6 alone may suffice; skip the WebGL tier.
- If counts routinely exceed **~150k–1M** and budget allows commercial → evaluate **KeyLines/ReGraph** (vendor support, 100k benchmarks) vs. cosmos.gl/Cosmograph [26].
- If **edge bundling or precise directed-edge semantics** are first-class requirements → Cosmograph is a poor fit; prefer Cytoscape.js (smaller scale) or a commercial toolkit.

## Caveats / Unknowns
- **Vendor performance claims are vendor claims.** Cosmograph's "1M points," KeyLines' "100k items," and deck.gl's "millions of objects" come from the projects themselves [8][26][20]; real interactivity depends on edge density, label policy, GPU, and styling. Benchmark with your actual data, attributes, and target hardware before committing — multiple sources (sigma, Cytoscape) stress that labels/edge density/custom renderers dominate real-world FPS [14][16].
- **Cosmograph licensing nuance is easy to get wrong:** the *engine* is MIT but the *library/React wrapper and UI components* are CC-BY-NC-4.0 [3][7]. Treat any commercial deployment of `@cosmograph/*` as requiring a negotiated license.
- **cosmos.gl is an OpenJS *incubating* project** (governance still maturing) — low bus-factor (primarily two maintainers) [3]. It is active, but plan for that risk.
- **Cytoscape's WebGL renderer is still a preview** (opt-in `webgl: true`), not a graduated stable feature, and edge styling is limited there [16].
- **Rete.js core releases are infrequent** (core ~v2.0.6 from ~2024) even though plugins/org remain active; verify maintenance fit before depending on it.
- **WebGPU is largely roadmap, not shipping default**, across these libraries (G6 has some WASM/GPU layout acceleration; Cytoscape explicitly declined WebGPU for cross-browser reasons) [16][22]. Don't assume WebGPU performance today.
- **ngraph/VivaGraph** is permissive and fast but effectively maintenance-mode with no official React bindings — suitable as an algorithm/offline-layout toolkit, not a primary maintained renderer [29].
- Star counts are GitHub's rounded display values current to mid-June 2026, not independently re-verified against the live counter at publication time.

## References
1. [@cosmograph/react — npm](https://www.npmjs.com/package/@cosmograph/react)
2. [@cosmograph/cosmograph — npm](https://www.npmjs.com/package/@cosmograph/cosmograph)
3. [@cosmos.gl/graph — npm](https://www.npmjs.com/package/@cosmos.gl/graph)
4. [cosmosgl/graph — GitHub](https://github.com/cosmosgl/graph)
5. [Cosmograph — Library](https://cosmograph.app/library/)
6. [Cosmograph — How to use (modes, 250k link limit)](https://cosmograph.app/docs-app/)
7. [Cosmograph — Licensing](https://cosmograph.app/licensing/)
8. [Cosmograph — What's new (1M points claim)](https://cosmograph.app/docs-general/whats-new/)
9. [@sqlrooms/cosmos](https://sqlrooms.org/api/cosmos/)
10. [A fresh new version of sigma.js — OuestWare](https://www.ouestware.com/2024/03/21/sigma-js-3-0-en/)
11. [Sigma.js](https://www.sigmajs.org/)
12. [sigma.js — GitHub](https://github.com/jacomyal/sigma.js/)
13. [graphology](https://graphology.github.io/)
14. [Cytoscape.js — performance docs](https://github.com/cytoscape/cytoscape.js/blob/master/documentation/md/performance.md)
15. [Cytoscape.js — GitHub](https://github.com/cytoscape/cytoscape.js/)
16. [Cytoscape.js WebGL Renderer Preview](https://blog.js.cytoscape.org/2025/01/13/webgl-preview/)
17. [Cytoscape.js — js.cytoscape.org](https://js.cytoscape.org/)
18. [react-cytoscapejs — GitHub](https://github.com/plotly/react-cytoscapejs)
19. [deck.gl — GitHub](https://github.com/visgl/deck.gl)
20. [deck.gl — Using Layers (millions of objects)](https://deck.gl/docs/developer-guide/using-layers)
21. [AntV G6 — GitHub](https://github.com/antvis/G6)
22. [G6 5.0 feature overview](https://g6.antv.antgroup.com/en/manual/whats-new/feature)
23. [deck.gl DataFilterExtension](https://deck.gl/docs/api-reference/extensions/data-filter-extension)
24. [Using deck.gl with React](https://deck.gl/docs/get-started/using-with-react)
25. [ReGraph — Cambridge Intelligence](https://cambridge-intelligence.com/regraph/)
26. [KeyLines FAQ (performance)](https://cambridge-intelligence.com/keylines/faq/)
27. [Cambridge Intelligence — procurement/licensing](https://cambridge-intelligence.com/commercial/procurement/)
28. [react-force-graph — GitHub](https://github.com/vasturiano/react-force-graph)
29. [VivaGraphJS — GitHub](https://github.com/anvaka/VivaGraphJS)
30. [ngraph — GitHub](https://github.com/anvaka/ngraph)
31. [React Flow / xyflow](https://reactflow.dev/)
32. [Rete.js docs](https://retejs.org/docs/)
33. [GoJS pricing — Northwoods](https://nwoods.com/sales)
34. [GoJS license/deployment](https://gojs.net/latest/intro/deployment.html)
35. [Introducing cosmos.gl — OpenJS Foundation](https://openjsf.org/blog/introducing-cosmos-gl)
36. [deck.gl BrushingExtension](https://deck.gl/docs/api-reference/extensions/brushing-extension)