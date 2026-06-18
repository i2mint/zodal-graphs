# zodal-graph Research — Reconciliation Record

> Detailed reconciliation of the Claude-AI deep-research surveys (`a`) against the Claude-Code grounded reports (`b`) across the six fleet regimes (P1–P6). Each regime gives a status line (how researched), agreements, a conflicts table, survey additions worth adopting, and the final consolidated recommendation. Arbitration rule throughout: the grounded report wins on zodal/meshed/linked/lacing **integration**; the survey wins only where it surfaces a concrete external fact (format capability, library, license/maintenance) the grounded report got wrong or missed.

---

## P1 — Typed-Port Node-Link Editor

**Status — how researched: grounded-only (b-only).** The library survey was performed inside Claude Code AND adversarially verified against primary sources (npm registry / GitHub / vendor docs). No separate Claude-AI survey twin; no reconciliation conflict to resolve.

**Agreements (internal — survey + verifier within the grounded report).**
- React Flow / xyflow (`@xyflow/react` 12.11.0, MIT) is the typed-port editor for the small-rich-editor branch.
- No node-link library and no serialization standard carries a *typed, kinded* port natively; the type and connect-time validity rule are always a zodal enrichment.
- React Flow gives the validation *hook* (`isValidConnection`) but not the type check — which is exactly the seam wanted, because the facade generates the predicate from Zod port types.
- Rete.js v2 (MIT) rejects type-incompatible wires by default and bundles a dataflow engine — the alternate for the pure executable-dataflow branch, not the default.
- GoJS is the most feature-complete but proprietary (~US$3,995/dev) and fails the permissive-license bar.

**Conflicts** — none (no survey twin). The one internal disagreement resolved by the verifier: Rete's maintenance was downgraded from "actively maintained" to "maintained-but-slow" (~9–12 month cadence), and Rete's `socket.combineWith()` API was flagged v1-stale (v2 uses `isCompatibleWith` + `addPipe('connectioncreate')`).

**Survey additions worth adopting** — n/a (no survey twin). Litegraph.js (native type-checking, MIT, but Canvas2D/imperative) and BaklavaJS (typed interfaces, MIT, but Vue renderer) were both considered and rejected for the React facade.

**Final consolidated recommendation.** Primary typed-port editor: **React Flow / xyflow (`@xyflow/react` 12.11.0, MIT)**. Fallback for the executable-dataflow branch: **Rete.js v2 (MIT)**, registered at a lower priority band. The facade generates `isValidConnection` from Zod port types via the `portTypeCompatible` subtyping rule (the one genuinely new module). Handle `id` = port name, so `targetHandle === targetPort`. Collapse-to-component is NOT a React Flow primitive and must be facade-implemented via canonical subgraph extraction. Avoid GoJS (proprietary). Selection rule target (from P4 §5.2 rule 2): `typedPorts && validatesConnections && canEditNode && scaleClass === 'small'`.

---

## P2 — Renderer-Agnostic Traversal + Provenance Overlay Engine

**Status — how researched: grounded-only (b-only), then corrected by the P3 verification pass.** The compute-library survey was done and verified inside Claude Code. One factual package-name error was caught later by the P3 grounding/verification pass (see correction below).

**Agreements (internal + corroborated by P3).**
- `graphology` + `graphology-*` (MIT) is the only JS library whose architecture matches the renderer-agnostic requirement: one `Graph` object consumed by independent algorithm packages returning plain id sets, never mutating a renderer.
- `stale`/`descendants` are the same computation (forward reachability); `ancestors`/upstream-provenance are the same (reverse reachability) — the compute layer needs one reachability primitive used twice.
- sigma.js is renderer-only and delegates all algorithms to its graphology backend (P3 corroborates).
- Verified graphology gaps: articulation points, bridges, biconnected components, MST — close with a ~50-line custom Tarjan module rather than re-coupling to Cytoscape's built-ins.
- networkx (Python, BSD-3) is the server-side authoritative tier; overlay result shape is byte-identical browser-vs-server.
- Perf bands (Canvas ~3–5k ≪ WebGL tens-of-thousands ≪ GPU 1M+) are rules of thumb to benchmark, not promises.

**Conflicts** (raised by the grounded P3 verification pass, which re-checked the npm registry).

| Topic | Survey said | Grounded said | Resolution | Winner |
|---|---|---|---|---|
| Which `@cosmograph` npm package carries the CC-BY-NC-4.0 license | The NC license lives on the high-level library `@cosmograph/cosmograph` / `@cosmograph/react`; the engine is MIT | P2 §6.5 + table labelled the legacy package `@cosmograph/cosmos` as "CC-BY-NC-4.0 — non-commercial; FLAG" | PRIMARY SOURCE: npm shows `@cosmograph/cosmos` is **MIT** (the low-level engine), deprecated → "moved to `@cosmos.gl/graph`". The CC-BY-NC-4.0 license is on `@cosmograph/cosmograph` and `@cosmograph/react`. P2 pinned the NC flag to the wrong package. Action item unchanged (target the MIT engine), but the package name is a factual error to fix in P2. | survey |

**Survey additions worth adopting** (surfaced by the P3 pass).
- The huge-scale overlay-shipping problem (the headline risk): a `Record<nodeId, role>` JSON overlay is infeasible at 100k–1M nodes; must switch (by `scaleClass`) to a columnar/typed-array projection (`Uint8Array` role codes by node ordinal), compute-on-shader, or sparse-only highlight sets.

**Final consolidated recommendation.** Compute hub: **`graphology` + `graphology-*` (MIT)** in-browser, plus a ~50-line custom **Tarjan** module for articulation/bridge/biconnected, **networkx (BSD-3)** as the server-side authority tier for heavy O(V·E)/all-pairs work, and **`ngraph.path` (MIT)** as an optional drop-in for fast large-graph pathfinding only. One result contract: P4's serializable `GraphOverlays.highlights` block (`nodeId → role`), fanned out by thin per-renderer adapters (React Flow / Cytoscape / sigma / cosmos.gl) that do pure id→style projection and run no compute. Browser-vs-server boundary is a cost/latency decision; the provider's `getGraphCapabilities()` declares where overlays compute. **P2 correction:** edit the table/§6.5 from "`@cosmograph/cosmos` — CC-BY-NC-4.0" to "`@cosmograph/cosmograph` / `@cosmograph/react` — CC-BY-NC-4.0 (high-level library); `@cosmograph/cosmos` (legacy engine) MIT, deprecated → `@cosmos.gl/graph`".

---

## P3 — Large-Sparse WebGL/GPU Renderers

**Status — how researched: survey-only, now grounded + primary-source verified (a-only + reconciliation grounding).** No grounded twin existed; the reconciliation pass read all four local docs and verified every license/version claim against the npm registry JSON API and GitHub/OpenJS primary sources.

**Agreements (survey ↔ grounded design).**
- Scale tiers are real and ordered Canvas ≪ WebGL ≪ GPU, matching P4's `scaleClass` vocabulary and the brief's large-sparse regime.
- The package-level license split is correct and verified: the cosmos.gl **engine** (`@cosmos.gl/graph` v3.0.0, OpenJS-incubating) is MIT; the higher-level Cosmograph **library** (`@cosmograph/cosmograph`, `@cosmograph/react` 2.3.2) is CC-BY-NC-4.0.
- All other recommended OSS libs are permissive (verified MIT): sigma 3.0.3, graphology 0.26.0, deck.gl 9.3.4, @antv/g6 5.1.1, cytoscape 3.34.0, @xyflow/react 12.11.0, react-force-graph 1.48.2, @react-sigma/core 5.0.6.
- GoJS (proprietary ~$3,995/dev) and ReGraph/KeyLines (commercial subscription) correctly fail the permissive bar.
- deck.gl is a GPU dataviz framework, not a graph library (no force layout) — scoped to point-cloud/embedding scenes.
- sigma.js delegates data-model/algorithms to graphology (consistent with P2's compute hub).

**Conflicts.**

| Topic | Survey said | Grounded said | Resolution | Winner |
|---|---|---|---|---|
| Which `@cosmograph` package is CC-BY-NC-4.0 | NC applies to the high-level `@cosmograph/cosmograph` / `@cosmograph/react`; `@cosmograph/cosmos` is the MIT engine | P2 attached the NC flag to `@cosmograph/cosmos` | PRIMARY SOURCE confirms the survey: `@cosmograph/cosmos` is MIT (deprecated → `@cosmos.gl/graph`); NC lives on the high-level library. Net recommendation unchanged (target `@cosmos.gl/graph`), but P2's package name is wrong. | survey |
| Should `@cosmograph/react` be a recommended *default* renderer | Yes, IF non-commercial use is acceptable — it is the only lib delivering the full wishlist behind a clean React API | The facade has a permissive-license health bar; the huge-tier adapter MUST target `@cosmos.gl/graph` (MIT), NC is a hard FLAG | MERGE: canonical huge-tier adapter targets `@cosmos.gl/graph` (MIT), optionally via `@sqlrooms/cosmos` (MIT). `@cosmograph/react` is a documented OPT-IN for non-commercial deployments only — cannot be the shipped default. | grounded |

**Survey additions worth adopting.**
- **`@sqlrooms/cosmos` (v0.28.0, MIT, depends on `@cosmos.gl/graph`)** — the MIT pattern for Cosmograph-like turnkey panels (graph + controls + DuckDB store). Adopt in the huge-tier adapter notes.
- cosmos engine capability constraints: NO edge bundling; weak directed-arrow rendering; links auto-disabled past 250k nodes; structural updates are columnar/typed-array ("replace the buffers"), so the huge tier is structurally read-only — reinforces "editing/ports drop as scale rises".
- Capability-coverage + data-ingestion matrices per renderer (columnar typed-arrays for cosmos/deck.gl vs node/edge object model for graphology/sigma).
- cosmos.gl bus-factor risk (OpenJS *incubating*, two primary maintainers); WebGPU is roadmap-not-default.
- `react-force-graph` (1.48.2, MIT) as a pragmatic mid-tier with 2D/3D/VR variants.

**Final consolidated recommendation.** Tier by `scaleClass`: (1) **HUGE (50k+)** → MIT engine **`@cosmos.gl/graph`** (v3.0.0), optionally wrapped via **`@sqlrooms/cosmos`** (MIT); `@cosmograph/react` (CC-BY-NC-4.0) is a documented opt-in for non-commercial only. (2) **LARGE (~2k–50k)** → **sigma.js (3.0.3, MIT) + graphology (0.26.0, MIT)** via `@react-sigma/core` (MIT); graphology doubles as P2's compute hub. (3) **MEDIUM (<2k)** → **Cytoscape.js (3.34.0, MIT)** (WebGL renderer still preview; treat as canvas/medium). (4) **POINT-CLOUD/embedding scenes** → **deck.gl (9.3.4, MIT)** with DataFilter/Brushing extensions; precompute layout. (5) **SMALL-RICH EDITOR** → **React Flow / `@xyflow/react` (MIT)** (per P1); Rete.js for pure dataflow. Realizes P4 §5.2 escalation; degrades to TanStack Table when node-link adds nothing. The editor↔viz handoff holds: data model, selection set, and styling/filter config stay invariant across the swap; `typedPorts`/`validatesConnections` live only on the React Flow editor side. Avoid for the shipped facade: GoJS, ReGraph/KeyLines, `@cosmograph/cosmograph`/`@cosmograph/react`.

---

## P4 — Declarative Facade + Canonical Graph Data Model

**Status — how researched: both-merged (a vs b).** Grounded P4b (design-deep, pinned to zodal/meshed/linked/lacing) reconciled against survey P4a (literature-broad over the JS/serialization landscape) across five axes: canonical hub, typed-port encoding, Zod modeling, capabilities vocabulary, renderer-selection rule, adapters.

**Agreements.**
- Both pick a NODE-LINK JSON hub, not a richer XML standard (grounded = linked's `nodes_and_links`; survey = graphology's `SerializedGraph` — near-isomorphic).
- Both find independently: NO mainstream JSON graph format models typed ports as first-class.
- Both encode a port-level edge the same way: node-id `{source,target}` always present + optional `sourcePort`/`targetPort`; absent port fields = ordinary edge (strict superset).
- Both model a port as a named, typed, per-node keyed slot with direction + a type token resolvable against a schema registry; both cite meshed's Sig/bind name-matching.
- Both keep three concerns physically separate and serializable: topology hub / Zod schema + affordances / renderer-agnostic presentation+overlay layer keyed by canonical ids.
- Both adopt a capability-ranked `RendererRegistry` (modeled on `getCapabilities()`), with typed-port editing and scale-class as orthogonal axes, degrading editing/ports as scale rises (React Flow → Cytoscape/Sigma → Cosmograph), bottoming out at TanStack Table.
- Both treat React Flow as the primary typed-port editor and say "wrap, don't rebuild"; layout (dagre/ELK/force) carried as a hint/sidecar.
- Both flag Eclipse Sprotty/GLSP as prior art (source-model → graphical-model split + first-class semantic ports) and reject the stack while borrowing the architecture.
- Both flag the same risks: meshed's implicit name-matched wiring must materialize into explicit (node,port) edges on import; capability self-reporting can lie; port export to GraphML/GEXF is lossy.

**Conflicts.**

| Topic | Survey said | Grounded said | Resolution | Winner |
|---|---|---|---|---|
| Canonical hub spine | graphology `SerializedGraph` (live Graph object, Sigma's native data layer, bijective with networkx node-link/JGF) | linked's `nodes_and_links` (free round-trip to ~12 Python forms, IS meshed's `DAG.graph_ids` shape, native lacing/PROV-O fit) | Grounded wins on integration. Merge: graphology is JSON-isomorphic, so promote it from "lossy (ports→attributes)" to a FIRST-CLASS near-identity bidirectional adapter for the Sigma scale path. | grounded |
| Native-port interchange format | Eclipse **ELK JSON** — the one mature JSON format with first-class ports (`ports[]` on nodes, edges naming ports); round-trips port-level edges AND computes x/y layout | GraphML (only XML standard with native ports; weakly tool-supported) | Survey wins — concrete fact grounded missed. ELK JSON natively models typed ports in JSON and is already the in-stack layout engine (elkjs). Adopt BOTH: ELK JSON as primary port-aware + layout-computing adapter; GraphML retained only as XML archival/yEd escape hatch. | survey |
| Zod v4 union→JSON-Schema mapping | Version-sensitive: early v4 mapped `z.union()`→`oneOf` (wrong); fixed at v4.1.13 (`union`→`anyOf`, `discriminatedUnion`→`oneOf`). Pin ≥4.1.13; prefer `z.discriminatedUnion`; some types unrepresentable (throws unless `unrepresentable:'any'`) | Did not address `z.toJSONSchema` export or the union/oneOf version sensitivity | Survey wins — concrete external Zod fact. Fold in as an implementation constraint on the SSOT codegen/export path (grounded Risk #7); architecture unchanged. | survey |
| WebGL renderers and ports | Hard constraint (yFiles WebGL2): WebGL cannot visualize ports at all → any WebGL renderer should report `typedPorts:false`; typed-port editing + massive scale not jointly satisfiable → split into dual-view | Degrades ports as scale rises but doesn't state the categorical fact or prescribe the dual-view | Survey wins on the fact; merge into the selection rule as an invariant: any large/huge renderer MUST report `typedPorts:false`; "typed ports required AT large scale" has no single-renderer answer → dual-view (React Flow edit-pane over an extracted subgraph + Sigma/cosmos whole-graph view). | survey |
| Scale-class numeric thresholds | Sourced: SVG~2k / Canvas~5k / WebGL~10k+ / Cosmograph ~1M; buckets interactive≤~1500 / large ~1.5k–10k / massive >~10k | `small<50 \| medium<2k \| large<50k \| huge 50k+`, no external citation | Merge — not really in conflict. Keep grounded four-band names; adopt survey's externally-sourced rendering ceilings as the benchmarkable evidence behind the boundaries: small(<~50) / medium(~50–2k) / large(~2k–10k) / huge(>10k). | merge |

**Survey additions worth adopting.**
- **ELK JSON (elkjs)** as a native-port, layout-computing JSON interchange adapter.
- **graphology `SerializedGraph` promoted to first-class near-identity adapter** for the WebGL scale path.
- **Zod v4 SSOT-export hardening**: pin ≥4.1.13; keep the model in the JSON-Schema-representable subset (or `unrepresentable:'any'`).
- The yFiles-WebGL2 "ports not visualized" fact + the **dual-view** pattern.
- Externally-sourced scale ceilings behind the bucket boundaries.
- A broader port-serialization census (ComfyUI/Litegraph `[link_id,upstream,out_slot,downstream,in_slot,dtype]`, NodeGraphQt, BaklavaJS, Flume, AntV G6 v5) as references.
- Mapbox-GL / Vega-Lite as named precedent for the data-driven style/encoding layer.
- The Python-first pivot escape hatch: make networkx node-link the hub and treat graphology as a derived view.

**Final consolidated recommendation.** **Canonical hub** = a single JSON node-link "zodal canonical graph document" on linked's `nodes_and_links` spine, taken as a SUPERSET via three additive namespaced enrichments: (1) bipartite node `kind` (`var`|`func`|`entity`, default `entity`); (2) a typed/kinded `ports[]` block on func nodes derived from meshed's `Sig.ch_names(**bind)` (`{port, param, type, kind, default, required, direction}`); (3) port-level links carrying optional `sourcePort`/`targetPort` over an always-present node-id `{source,target}`. Chosen over graphology because linked already canonicalizes it (free round-trip to ~12 Python forms), it IS meshed's `DAG.graph_ids` shape, and lacing/PROV-O layer natively — BUT graphology's `SerializedGraph` is promoted to a first-class near-identity adapter for the WebGL path. **Typed ports** are first-class named/typed/kinded per-node keyed slots; edges reference `(node, portName)`; the model degrades to every port-less format by dropping ports/`*Port`. For port-aware JSON interchange, adopt **ELK JSON (elkjs)** as primary (consumes port sides/constraints, returns x/y into the overlay layer); **GraphML** as the XML archival/yEd escape hatch. React Flow handles / Rete sockets are the highest-fidelity renderer mappings, not hubs. Zod modeling reuses zodal's 6-layer field inference + `.meta()`+WeakMap `affordanceRegistry` + discriminated-union `kind`/`type` tags; if `z.toJSONSchema()` is emitted as backend SSOT, pin Zod ≥4.1.13 and stay in the representable subset. **Keep three layers separate & serializable.** **Capabilities + selection:** `GraphCapabilities` (structure / `typedPorts`+`validatesConnections` / composition / execution / provenance / traversal overlays / views / `hasIntervals` / `scaleClass`) drives `RendererRegistry.resolve` (no registry change, new graph testers). Encode the dual-view invariant for typed-ports-at-scale. **Wrap, don't rebuild** — the facade renders nothing and runs no layout engine; the genuinely new surface is: `defineGraph`, the `graph.*` `.meta()` whitelist, ~3 RendererTester predicates, the canonical serializer + adapters (incl. ELK JSON and a first-class graphology adapter), and the overlay/styling/selection/layout data shapes.

---

## P5 — Table / Matrix / Form Surfaces

**Status — how researched: both-merged (a vs b + 8-item matrix checklist).** Survey P5a's primary matrix pick (FINOS Perspective + regular-table; fallback ECharts heatmap) scored against grounded P5b §4's delegated 8-item evaluation checklist + reconciliation rule; the form recommendation cross-checked between both.

**Agreements.**
- FORM surface: both land on **react-hook-form + @hookform/resolvers `zodResolver` + shadcn Form primitives** (all MIT, native to the stack, Zod-v4 compatible).
- FORM fallback: both treat vantezzen **AutoForm** as accelerator/fallback only (slowed maintenance, no native slider/range).
- FORM rejections: both reject `@rjsf/core` (JSON-Schema-native, not shadcn-native) and Formily (own reactive core, AntD-oriented).
- **TanStack Table** is the universal TABLE lens (headless, MIT, no built-in virtualization → pair with TanStack Virtual).
- View-switching: both endorse a single-source-of-truth store (selection + filters + active lens), each lens a pure projection.
- Both flag AG Grid's matrix-relevant power (pivot, grouping, range selection) as Enterprise/commercial — avoid unless already licensed.

**Conflicts.**

| Topic | Survey said | Grounded said | Resolution | Winner |
|---|---|---|---|---|
| Matrix-viewer pick | Adopt **FINOS Perspective + regular-table** (Apache-2.0, WASM, virtualizes billions of cells, built-in switcher); ECharts heatmap fallback | §4 checklist: if the winner fails item 5 (Zod-driven config), 6 (clean TanStack integration), or 7 (permissive license), prefer building a thin heat-cell renderer ON TanStack Table | Perspective PASSES 7 (Apache-2.0, verified) + 8 (maintained, v4.5.1 2026-05-31) + 2/3/4 — but FAILS 5 (WASM custom element with its own viewer config; doesn't consume `ResolvedFieldAffordance`) and 6 (demands its own Apache-Arrow + WASM pipeline, forking the shared TanStack row model + selection/filter state). Failing 5 AND 6 triggers the reconciliation rule. | grounded |
| ECharts heatmap as a matrix engine | Lightweight FALLBACK matrix surface (Apache-2.0, canvas/WebGL, visualMap, tooltips) | Checklist demands an operable matrix on the TanStack row model accepting `GraphStyling.rules` | ECharts is a charting heatmap, not a reorderable/operable grid; survey itself says you wire reordering/selection through your own store — fails 5 and 6 harder. Survives only as an optional pure-display heatmap pane. | grounded |

**Survey additions worth adopting.**
- AG Grid Enterprise license trap quantified ($999/dev perpetual, $1,598 with Charts; per-front-end-developer; watermark without a key) — carry as a do-not-adopt note.
- InfoVis grounding for WHEN a matrix is the right surface: Ghoniem/Fekete/Castagliola (2005) — above ~20 vertices matrix beats node-link except path-following; Alper et al. CHI 2013; Okoe/Jianu/Kobourov. Task-dependent (matrix for dense neighborhoods, node-link for sparse path-following).
- Seriation caveat: NO off-the-shelf heatmap/matrix lib computes a cluster-revealing row/col permutation — add optimal-leaf / Cuthill–McKee / TSP ordering yourself.
- Glide Data Grid (MIT, canvas, millions of cells) as the closest "one grid engine for both edge-list AND matrix" if the DOM heat-cell approach hits a canvas-scale ceiling.
- `zod-to-json-schema` is unmaintained (Nov 2025; use Zod v4 native `z.toJSONSchema`) — reinforces rejecting `@rjsf/core`.
- Perspective integration cost named honestly (WASM custom element, client-only/dynamic-import for SSR, bundles WASM+Arrow).

**Final consolidated recommendation.** **MATRIX VIEWER:** do NOT adopt Perspective as the operable lens. **BUILD A THIN HEAT-CELL RENDERER ON TANSTACK TABLE** — per-cell color from a P4 §6 `GraphStyling.rules` color scale, hover tooltips for edge-weight/relation metadata, TanStack Virtual for rows + added column virtualization for the matrix axis; add a seriation module (optimal-leaf / Cuthill–McKee). Keep Perspective (Apache-2.0) only as an OPTIONAL standalone heatmap pane for billion-cell scale, with its own feed, NOT wired into the cross-lens bridge. Avoid AG Grid Enterprise. **FORM:** **react-hook-form + @hookform/resolvers `zodResolver` + shadcn Form primitives** (RHF supplies only state+validation+submit; widget choice stays with zodal's `RendererRegistry` resolving the emitted `FormFieldConfig`). AutoForm is a fallback accelerator only. Add react-hook-form + @hookform/resolvers to `zodal-ui-shadcn` deps. **VIEW-SWITCHING:** model the active view as ONE pure field (`activeView: 'node-link'|'table'|'matrix'|'timeline'|'form'`) + ONE setter on the existing framework-agnostic `CollectionState`, picked by the existing `RendererRegistry.resolve` keyed on `GraphCapabilities.views`/`scaleClass`/`typedPorts`. Selection (`rowSelection` ↔ `GraphSelection.nodes` 1:1) and filters (one `FilterExpression` AST) are shared by construction, so lenses are pure projections and a switch preserves selection+filters for free.

---

## P6 — Execution / Stepper / Provenance / Timeline

**Status — how researched: both-merged (a vs b + requirements specs).** Grounded 06b covers (A) dataflow value-watching + (C) provenance in full and carries REQUIREMENTS specs for the delegated (B) stepper and (D) timeline surveys; survey 06a is the library survey for all four. The decisive external facts (vis-timeline Allen/rational-time support, existence of any JS Allen-13-relations package, `@thi.ng/intervals`) were web-verified during reconciliation.

**Agreements.**
- (A) Dataflow value-watching: both pick **React Flow** (MIT) as renderer with execution OUT of the renderer in a headless engine/state layer; both name **Rete.js DataflowEngine** (MIT, pull-based + per-node caching + reset) as the specialized recompute alternative.
- (C) Provenance/lineage: both treat it as a PRESENTATION overlay on the existing node-link renderer in read-mostly mode (dirty-set/stale coloring + badges + selection-focuses-neighborhood), time-travel as deterministic op-log replay; both converge on the canonical lineage grammar (upstream-left/downstream-right, modified/impacted coloring à la dbt/Marquez).
- (D) Timeline is THE bespoke-glue case: both agree no maintained JS/TS library renders ELAN/Praat-style multi-tier interval annotations with Allen-relation queries; vis-timeline is the most capable general timeline but fast-start-only; a custom D3/visx track renderer is the real answer. The "timeline = the one bespoke renderer" claim HOLDS — web-confirmed (no 13-relation Allen JS/TS package; vis-timeline uses Date/number/moment, no Allen/rational-time concept).
- (B) Steppers: both reuse the table backbone + a thin headless shadcn/Radix stepper, NOT a node-link canvas, NOT a standalone workflow-orchestration dashboard (Temporal/Prefect/Dagster/Inngest reference-only).
- Architectural spine: both endorse the headless-engine + swappable-view split, Zod-described config as SSOT.

**Conflicts.**

| Topic | Survey said | Grounded said | Resolution | Winner |
|---|---|---|---|---|
| (B) stepper STATE CORE | Adopt **XState** (MIT, v5) — status/retry/validation/cost-gate/human-approval/abort as explicit states; "machine IS the declarative config" | The stepper is a THIN orchestration shell over zodal's EXISTING `toFormConfig` + `CollectionState`; a candidate owning its own form/field model breaks SSOT (Risk 7: is a generic stepper even needed?) | MERGE with grounded SSOT governing: adopt XState + shadcn-stepper presentation, but confine XState to orchestration/transition logic; per-step form inputs flow through `toFormConfig`, fan-out rows through the table backbone. | merge |
| (A) recompute engine emphasis | Primary: drive React Flow from **Rete.js DataflowEngine** (or thin engine modeled on it) as the headless recompute SSOT; Observable fallback | React Flow primary; execution in zodal's state layer; Rete.js a LOWER-priority alternate. CRITICAL: a TS/browser facade CANNOT execute a Python-backed func node (model serializes only a `funcRef`) → split `executable` into executable-in-browser vs executable-via-backend | Grounded wins on integration: execution lives in zodal's state layer; Rete is opt-in for the minority pure-TS-funcRef case. The survey entirely misses the executable-in-browser-vs-via-backend split, which is the governing constraint. | grounded |
| (B) assistant-ui as a stepper option | **assistant-ui** (MIT, YC-backed) is the standout embeddable agent-UI with inline approvals + tool-call rendering | Doesn't name it; anti-requirement: a candidate forcing a chat shape over-reaches the linear-pipeline regime | MERGE, scoped narrowly: assistant-ui only when the pipeline IS a conversational LLM agent loop with tool calls + human-in-the-loop. For named-step pipelines the table+shadcn-stepper answer stands. Keep as a documented escape hatch for the agentic-chat sub-case. | merge |

**Survey additions worth adopting.**
- (D) **`@thi.ng/intervals`** (Apache-2.0, TS-native): half-open/semi-open interval math (`classify`/`isBefore`/`intersection`/`contains`) to back the hand-written 13 Allen relations — de-risks the half-open boundary correctness concern. A genuine grounded-report gap.
- (D) **`@flatten-js/interval-tree`** (MIT, v2.0.3): best-maintained interval tree for large-dataset indexing.
- (D) **`@visx/brush`** over `scaleTime × scaleBand` (MIT): a concrete ~100 LOC bespoke brushable interval-tier primitive.
- (D) audio sub-case: `@waveform-playlist/annotations` (MIT), wavesurfer.js v7 + `@wavesurfer/react` (BSD-3); peaks.js flagged LGPL-3.0 copyleft; react-chrono rejected (storytelling, not interval-tier).
- (B) concrete shadcn/Radix stepper implementations (Dice UI `@diceui/stepper`, ReUI, shadcn-expansions) with pending/active/loading/completed/error + onValidate + RHF integration.
- (C) mirror the **OpenLineage** Job/Run/Dataset model in the Zod schema; Redux-DevTools jump/skip/reorder/import/export as the time-travel feature set; LineageViewer (Marquez + Cytoscape.js) as concrete precedent; Marquez as optional enterprise lineage backend.

**Final consolidated recommendation.**
- **(A) Dataflow value-watching:** ADOPT **React Flow** (MIT, v12) behind `executable && watchesValues && scaleClass==='small'`. Execution OUT of the renderer in zodal's framework-agnostic state layer. GOVERNING CONSTRAINT: split `GraphCapabilities.executable` into **executable-in-browser** (pure-TS funcRef → JS fn) vs **executable-via-backend** (Python meshed: facade ships `{graph, input bindings}` to a Python executor, merges results via `updateNodeData(...,{merge})`). Value-watch is presentation only. Per-handle addressing via `useNodeConnections` + `useNodesData` keyed on canonical `targetPort`/`ports[].kind`. Input widgets DERIVED from resolved port type. Register **Rete.js DataflowEngine** (MIT) as a lower-priority alternate for the pure-TS case; NOT the default SSOT.
- **(B) Named-step pipeline stepper:** REUSE the **TanStack-Table backbone** (one row/step) + a thin headless **shadcn/Radix stepper** (Dice UI `@diceui/stepper` or ReUI; copy-own). State core = **XState** (MIT, v5) confined to orchestration; per-step form inputs flow through `toFormConfig`, fan-out rows through the table backbone. NO node-link canvas. Escape hatch: **assistant-ui** (MIT) ONLY for genuinely conversational LLM agent loops.
- **(C) Provenance/lineage:** ADOPT the renderer-agnostic **`GraphOverlays.highlights`** overlay (ancestors/descendants/stale/critical-path roles) on whatever node-link renderer is active, read-mostly, + a provenance-inspector panel on the form/table backbone. HARD dependency: traversal computed ONCE by the P2 networkx-class backend; (C) is a pure consumer, never re-derives. Time-travel = deterministic op-log replay (Redux-DevTools pattern). Mirror **OpenLineage** Job/Run/Dataset in the Zod schema.
- **(D) Interval-tier timeline track:** BUILD the dedicated bespoke renderer (the one true new renderer; web-verified). Core = **`@visx/brush`** over `scaleTime × scaleBand` (MIT); interval math = **`@thi.ng/intervals`** (Apache-2.0) to back the hand-written 13 Allen relations; **`@flatten-js/interval-tree`** (MIT) for large-dataset indexing. MUST honor rational `{v,r}` time at the model layer (float only at pixel projection), half-open `[start,end)` incl. zero-measure points, the five ELAN tier stereotypes + parent linkage, Allen-relation brushing, and lacing Annotation binding (`NodeRef.scene_path`). vis-timeline = fast-start prototype only. Audio sub-case: `@waveform-playlist/annotations` (MIT) or wavesurfer.js v7 + `@wavesurfer/react` (BSD-3); AVOID peaks.js (LGPL-3.0) and react-chrono.

---

## Brief Corrections (aggregated across regimes)

- **P3 / grounding brief §e renderer family 3** lists "cosmograph + sigma.js / Cytoscape.js" without the license nuance. With verification, the brief's "cosmograph" must be read as the MIT `@cosmos.gl/graph` engine (optionally + `@sqlrooms/cosmos`), NOT `@cosmograph/cosmograph`/`@cosmograph/react` (CC-BY-NC-4.0). The brief's prose is license-agnostic shorthand; the facade must pin the MIT engine. This is a clarification, not an error.
- **P4** — none material. The brief's §5 conclusion (`nodes_and_links` hub, bipartite var/func split, links carry `target_port`, func nodes carry a typed/kinded ports block) is correct and independently corroborated by the survey's cross-library finding. The one thing the brief did not name (scoped to the four Python backends, not the JS landscape) is **ELK JSON** as an existing native-port JSON interchange format — worth noting in the brief's adapter inventory, but it doesn't change the recommendation.
- **P5 / brief §(e)** lists "TanStack Table — universal table/matrix/result-frame lens (all 12 subjects)". Refine: TanStack Table is the universal TABLE lens but NOT by itself the matrix/heatmap viewer (no 2-D virtualization, no native heat encoding, no seriation). Read the brief's shorthand as "the substrate to integrate a matrix viewer against".
- **P1, P2, P6** — none.

---

## Open Items / Next Research (aggregated)

**Canonical model / capabilities (P4 + P6).**
- `funcRef` resolution / cross-language execution boundary: is the TS facade ever the executor of a meshed DAG, or only editor/viewer handing a serialized graph back to a Python runtime? Confirm with the canonical-model owner — it determines whether typed-port VALIDATION must run in TS at all, and whether Rete's engine is an asset or weight.
- Split `GraphCapabilities.executable` into executable-in-browser vs executable-via-backend; add the contract that `canStep` requires the executor to expose a STEP (not just run-all) endpoint.
- A defined Zod-v4 subtyping/compatibility relation for connect-time validation (`portTypeCompatible`): is `z.number()` connectable to `z.number().min(0)`? to a union? No precedent to reuse; likely a new small module (covariance, refinements, unions, optional/nullable, structural object compatibility).
- Variadic port (`*args`/`**kwargs`) addressing scheme: how a renderer draws N handles for one `var_positional` port and how an edge addresses `args[0]` vs `args[1]` (React Flow needs distinct handle ids per slot).
- Bipartite var/func vs plain-entity mental-model leakage: a clear rule for when ports apply so the common portless case stays simple.
- Confirm graphology ↔ `nodes_and_links` field mapping is truly lossless both directions (key vs id, undirected flag, multigraph edge `key`) before promoting graphology to near-identity adapter.

**Scale / overlays (P2 + P3 + P6).**
- The huge-graph overlay-shipping problem (the largest open design fork): `Record<nodeId, role>` JSON is infeasible at 100k–1M nodes. Needs a `scaleClass`-keyed switch to a columnar/typed-array projection (`Uint8Array` role codes by node ordinal, matching cosmos's Arrow discipline), compute-on-shader, or sparse-only highlight sets.
- Perf/`scaleClass` thresholds and the browser-vs-server compute cutover are unbenchmarked rules-of-thumb. Measure on representative zodal graph shapes (edge density, label policy, target GPU) before promising in capability advertisements.
- Cosmos's columnar "replace-the-buffers" update model + links-auto-disabled-past-250k mean the huge-tier adapter cannot honor fine-grained structural editing or full directed-edge semantics — confirm the facade never routes an editing/ports-required profile to the cosmos adapter; renderer-selection testers must encode the 250k link cutoff and read-only constraint.
- id stability across the canonical-model → graphology compute → cosmos typed-array index boundary: cosmos uses index-based events + an id↔index map; overlays/selection are keyed by stable string ids. The cosmos adapter must maintain a guaranteed 1:1 id↔ordinal table or overlays silently mis-target.
- Custom Tarjan module (articulation/bridge) is unwritten and untested; edge cases (disconnected graphs, self-loops, directed-vs-undirected "bridge") need coverage, else delegate to server-side networkx.
- graphology satellite staleness is a maturity bet, not abandonment — pin versions and keep the custom-module fallback warm.

**Product / licensing (P3).**
- Whether to ship a Cosmograph (`@cosmograph/react`, CC-BY-NC-4.0) adapter at all as a non-commercial opt-in, vs only the MIT `@cosmos.gl/graph` + `@sqlrooms/cosmos` path — a product/licensing policy decision for the facade owner.

**Table / form (P5).**
- 2-D matrix virtualization: column virtualization for a wide dense matrix is the less-trodden path; must prove out at `scaleClass` medium→large or fall back to a canvas grid (Glide Data Grid).
- Seriation (cluster-revealing row/col permutation) is custom work under every option — needs an optimal-leaf / Cuthill–McKee / TSP module.
- Verify `toFormConfig` handles a graph node's PORT-object schema (a Zod object whose keys are port names) as cleanly as a flat collection-row schema before committing the form lens to func nodes.
- New deps land in `zodal-ui-shadcn` (react-hook-form + @hookform/resolvers); track `@hookform/resolvers` issue #799 (TS-inference annoyance with explicit `useForm<Schema>` generic).
- shadcn Form primitive drift: bind to the pinned shadcn version's actual primitives (Controller + Field/FieldLabel/FieldError vs older FormField wrapper).

**Provenance / timeline (P6).**
- SEQUENCING: (C) cannot ship before the P2 networkx-class traversal backend exists (hard dependency). Confirm P2 timeline.
- DECIDE the (D) generic core: `@visx/brush` (recommended) vs a raw-D3 axis. Validate it handles the tier count and rational-time projection cleanly before committing.
- VALIDATE `@thi.ng/intervals` half-open boundary behavior against lacing's exact Allen "meets" (`a.end == b.start`) and point-annotation (`start == end`) semantics before relying on it.
- RESOLVE the (B) open question: is a generic stepper (XState + shadcn) actually needed, or do zodal's collection-UI primitives already cover the named-step pipeline with only a thin orchestration wrapper? Prototype both.
