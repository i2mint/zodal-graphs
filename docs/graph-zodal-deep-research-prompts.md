# Deep-Research Prompts — zodal Graph-UI Facade & Renderers

**Author:** Thor Whalen  
**Date:** 2026-06-18  
**Derived from:** [`graph-affordances-analysis.md`](./graph-affordances-analysis.md) (File 1).

## Purpose & how to use

These are **standalone, copy-pasteable deep-research prompts** — each is meant to be launched as a *separate* deep-research run. Their collective goal: gather what we need to **choose and design the modern, maintained tools** for building the zodal graph facade (a declarative, Zod-v4-schema-driven layer) and its **renderers** (which map declared graph affordances onto existing graph-UI tools). Across all prompts the bias is **reuse existing, well-maintained tooling — not build from scratch.**

Recurring constraints every prompt restates, so each stays self-contained:
- **Stack fit:** TypeScript-first, React 18/19, ESM, headless/config-driven, state that is serializable and controllable (zodal produces *configuration objects*, never DOM directly), and a natural fit for a **Zod v4** schema substrate and a capability-based renderer registry.
- **Health bar:** actively maintained (recent releases/commits, responsive issues), permissive license (MIT/Apache-2.0/BSD preferred — flag copyleft/commercial), extensible (custom nodes/edges, plugins, headless core), and reasonable bundle/perf footprint.
- **Output shape:** a comparison table across the evaluation criteria, a clear recommendation (primary + fallback), a short integration sketch against the zodal facade, and a risks/unknowns section.
- **References:** Vancouver-style numbered citations `[1]`, `[2]`, … with a `REFERENCES` section of `[name](url)` hyperlinks.

### Priority (set by File 1)

File 1's core finding: **affordances cleave by UI regime, not by subject** — six regimes are coverable by **five renderer families plus a declarative glue layer**, and the **two most tool-constraining affordances** are *typed-port connection-with-validation* (meshed-class) and *renderer-agnostic traversal/provenance overlays*. The prompts are ordered accordingly:

| # | Prompt | Targets (File 1) | Priority |
|---|--------|------------------|----------|
| 1 | Typed-port node-link **editors** | small-rich editor cluster; `connect-to-specific-input-port` + `validate-connection-by-type` (the #1 tool-deciding affordance) | **Highest** |
| 2 | Renderer-agnostic **traversal + provenance overlay** engine | traversal cluster D + provenance cluster F; the #2 tool-deciding affordance | **Highest** |
| 3 | Large-sparse **WebGL/GPU** renderers | large-sparse viz cluster (cosmograph / linked / graph_dbs-large / networkx-large) | **High** |
| 4 | The **declarative facade + canonical graph data model** | the unifying schema/RendererRegistry glue + serialization | **High** |
| 5 | **Table / matrix / form** "not-a-graph" surfaces | `switch-to-table-view` (12/12) + table-or-matrix cluster | **Medium** |
| 6 | **Execution, pipeline-stepper, provenance & timeline** renderers | executable-DAG cluster E + provenance/timeline surfaces | **Medium** |

---

## Prompt 1 — Typed-port node-link **editor** libraries (the meshed-class differentiator)

> **Grounding:** File 1's "small-rich editor" regime, and its single most tool-constraining affordance — **typed-port connection with type/signature validation** (`connect-to-specific-input-port`, `rebind-argument-source`, `validate-connection-by-type`, `swap-node-function-with-check`), plus **collapse↔expand of a sub-DAG into a reusable component**. Backends: `meshed` (gold standard), `ij`, the `graph_dbs` edit-slice. This is where File 1 says React Flow / Rete are essentially the only viable options — verify and pressure-test that.

```text
You are helping choose the JavaScript/TypeScript library for an interactive, editable node-link
DIAGRAM EDITOR for small, metadata-rich graphs (flowcharts and computation DAGs of up to a few
hundred nodes). This editor is the "small-rich" renderer in a declarative, schema-driven graph-UI
system (TypeScript/React, Zod v4 schemas, headless config objects, a capability-based renderer
registry). The system favors reusing existing tooling over building from scratch.

The defining requirement is TYPED PORTS WITH CONNECTION VALIDATION, modeled on the Python library
`meshed`: a node is a function, its inputs are NAMED, TYPED argument ports, and an edge connects a
node's output to a SPECIFIC named input port of another node — only if the types/signatures are
compatible. The editor must let the user wire output→specific-input-port and reject invalid
connections at connect time.

ANSWER THESE QUESTIONS:
1. Which actively-maintained TS/JS node-link EDITOR libraries are credible here? Evaluate at least:
   React Flow / XYFlow, Rete.js, Litegraph.js, Drawflow, baklavajs, and Cytoscape.js (+ the
   edgehandles extension). Add any strong contenders you find (e.g. Reaflow, jsPlumb, GoJS,
   Sketch-like dataflow editors). Note which are React-native vs framework-agnostic.
2. For each, how well does it support: (a) multiple, individually-addressable, TYPED input/output
   ports ("handles") per node; (b) connection VALIDATION at drag time (e.g. React Flow's
   `isValidConnection`, type-tagged handles) including rejecting type-incompatible wires;
   (c) per-node custom rendering (so we can show argument names, types, defaults); (d) sub-flows /
   groups / COLLAPSE a selected subgraph into a single node and EXPAND it back (nesting); (e) an
   execution/value overlay (annotating nodes/edges with live values as a DAG runs); (f) controlled,
   serializable state (so the graph is driven from external config, not internal mutable DOM state);
   (g) auto-layout (hierarchical/DAG) integration.
3. How declarative / headless is each? Can node and edge "types" be supplied as data/config (ideal
   for a Zod-schema-driven facade), and is the canonical state a plain serializable
   nodes+edges object?
4. Which is the better fit specifically for the meshed pattern (function nodes, typed argument ports,
   signature-compatible connections, collapse-to-reusable-component) vs more general flowchart
   editing? Where does Rete.js's dataflow engine help or get in the way?
5. Health & licensing: maintenance cadence, release recency, community size, TypeScript types
   quality, license (flag GoJS/commercial and any copyleft), and bundle size.

EVALUATION CRITERIA: maintained & modern (TS-first, React 18/19, ESM); permissive license;
extensibility (custom nodes/edges/handles, plugins); and FIT with a TS/React + Zod/declarative,
headless-config stack with serializable state.

OUTPUT: a comparison table (libraries × the capabilities above), a primary recommendation + fallback,
a short sketch of how typed ports + `isValidConnection` would be driven from a Zod schema, and a
risks/unknowns section. Use Vancouver-style numbered references [1], [2], … with a REFERENCES section
of [name](url) hyperlinks.
```

---

## Prompt 2 — Renderer-agnostic **graph-theory traversal + provenance overlay** engine

> **Grounding:** File 1's traversal cluster (D) and provenance cluster (F), and its #2 tool-deciding insight: traversal and provenance affordances (`find-path-between-two-nodes`, `highlight-ancestors-descendants`, `detect-and-highlight-cycles`, `topological-order`, `color-by-connected-component`, and the provenance "mark a node changed → highlight the stale downstream set") are **renderer-agnostic overlays** — computed once by a "networkx-class" backend and drawn as highlights on *whatever* node-link renderer is active. These recur across meshed, ij, nw, graph_dbs, networkx, cosmograph. We need the JS/TS compute layer + the decoupling pattern.

```text
You are helping design a RENDERER-AGNOSTIC graph-algorithm and provenance OVERLAY layer for a
declarative TypeScript/React graph-UI system. The idea: graph-theory results (paths, reachable sets,
cycles, components, topological order) and PROVENANCE/lineage results (upstream sources of a node;
the downstream "stale/impacted" set after a change) are computed ONCE on the data model and then
rendered as visual HIGHLIGHTS (color, ring, dim-others, edge-emphasis) on top of any node-link
renderer (React Flow, Cytoscape.js, sigma.js, or a GPU renderer). The compute layer must NOT be tied
to any one renderer. Bias toward reusing existing libraries.

ANSWER THESE QUESTIONS:
1. What is the best modern JS/TS "NetworkX-equivalent" for in-browser/in-Node graph algorithms?
   Evaluate at least: graphology (+ graphology-* algorithm packages), ngraph (anvaka), jsnetworkx,
   Cytoscape.js's built-in algorithms, d3-dag, and any maintained alternatives. Cover: shortest path
   / all simple paths between two nodes, ancestors/descendants/reachability, cycle detection,
   topological sort, connected/strongly-connected components, articulation points/bridges, MST,
   community detection, and centralities.
2. Which library has the cleanest separation between a graph DATA MODEL and its ALGORITHMS, so the
   same model can feed multiple renderers? Is there a standard model (e.g. graphology's `Graph`) that
   the major renderers can consume or be adapted to with thin adapters?
3. PROVENANCE / lineage specifically: what is the right way to compute and represent a "downstream
   impacted / stale set" (forward reachability from changed nodes) and an "upstream provenance set"
   (backward reachability) as an overlay? Survey patterns from data-lineage UIs, build systems, and
   incremental-computation/content-addressed frameworks. How is time-travel / op-log replay over a
   versioned graph typically modeled?
4. Architecture: what is the cleanest decoupling pattern so a single "overlay result" (a set of
   node-ids / edge-ids + a role like 'path' | 'ancestors' | 'stale') can be applied as styling on
   React Flow, Cytoscape.js, sigma.js, and a GPU renderer alike? Look for prior art in "headless graph
   logic + pluggable view" designs.
5. Performance envelope: up to what graph size do these algorithm libraries stay interactive in the
   browser, and when must computation move server-side (e.g. delegated to Python networkx)?
6. Health & licensing for each candidate.

EVALUATION CRITERIA: maintained & modern (TS types, ESM); permissive license; renderer-INDEPENDENCE
and a clean data-model/algorithm split; and FIT with a declarative, Zod-schema-driven facade where
"which overlays are available" is a declared capability.

OUTPUT: a comparison table (libraries × algorithm coverage × model-decoupling × perf × license), a
recommended compute layer + an overlay-decoupling architecture sketch (how an overlay result maps to
highlights on any renderer), guidance on the browser-vs-server boundary, and a risks/unknowns section.
Use Vancouver-style numbered references [1], [2], … with a REFERENCES section of [name](url) hyperlinks.
```

---

## Prompt 3 — Large-sparse **WebGL/GPU** graph renderers (one tool, several backends)

> **Grounding:** File 1's "large-sparse viz" cluster — the regime where **one GPU/WebGL renderer can serve several backends at once** (`cosmograph` itself, `linked`'s k-NN point-clouds, large `graph_dbs` scenes, laid-out `networkx`). Signature affordances: viewport nav (`pan`/`zoom`/`fit`), `style-by-attribute`, crossfilter (`brush-histogram-or-category`), `sample-for-huge-graphs`, `run-force-simulation` + `tune-simulation-forces`, `highlight-neighbors`/`expand-ego-or-k-hop`, lasso/rect selection, `search-and-locate`.

```text
You are helping choose the JavaScript/TypeScript renderer for LARGE, SPARSE graphs and point-clouds
(tens of thousands to millions of nodes/edges) where per-element metadata is mostly NOT individually
displayable — so viewport navigation, attribute-driven styling, crossfilter, sampling, and force-layout
dominate, and structural editing is rare. This is the "large-sparse" renderer in a declarative
TypeScript/React graph-UI system (headless config, Zod schemas, capability-based renderer registry).
It must be embeddable in React. Bias toward reusing existing tooling.

ANSWER THESE QUESTIONS:
1. Compare the credible modern renderers: Cosmograph (cosmos / @cosmograph/react), sigma.js (+ graphology),
   Cytoscape.js, G6 / AntV, deck.gl (GraphGL / scatterplot+line layers), ReGraph/KeyLines (commercial),
   and ngraph/VivaGraph. Add any strong maintained contenders. For each: rendering tech (WebGL/WebGPU/
   canvas/SVG), realistic node/edge scale ceiling while staying interactive, and React integration story.
2. Capability coverage per renderer: GPU/iterative FORCE-SIMULATION with live control (start/stop/pause/
   step; gravity/repulsion/link-spring/friction); pan/zoom/fit-to-view; zoom-to / locate a node;
   rectangle + polygon/lasso SELECTION; hover tooltips and context menus; STYLE-BY-ATTRIBUTE (color/size/
   shape/width from node/edge fields) with legends; cluster/community coloring; FILTER/CROSSFILTER
   (brush histograms/categories, compound predicates) with linked panels; NEIGHBOR highlight + ego/
   k-hop EXPAND-on-click; label management at scale (show/hide, declutter); sampling/level-of-detail for
   huge graphs; and screenshot/export.
3. Which single renderer most credibly covers MULTIPLE backends at once — a GPU point-cloud + graph
   viewer (e.g. Cosmograph) that can serve embedding/k-NN graphs, large database query-result scenes, and
   pre-laid-out large graphs — and what are its limits (e.g. edge bundling, directed-edge arrows,
   dynamic structural updates)?
4. How does a large-sparse renderer COEXIST with a small-rich node-link EDITOR (React Flow/Rete) under
   one capability-based selection scheme — i.e. when the same declared graph crosses the size/edit
   threshold, what swaps and what stays (selection model, styling config, data model)?
5. Data ingestion: what input formats / column conventions does each expect (e.g. Cosmograph's points/
   links tables, graphology's serialized graph), and how heavy is the prep?
6. Health & licensing (flag commercial: ReGraph/KeyLines/GoJS; flag any non-permissive license).

EVALUATION CRITERIA: maintained & modern (TS, React-embeddable, ESM); permissive license (or clearly
note commercial); scale/perf headroom; extensibility (custom styling, panels); and FIT with a
declarative, Zod-driven facade with serializable styling/filter config.

OUTPUT: a comparison table (renderers × scale × the capabilities above × React fit × license), a primary
recommendation + open-source fallback, a note on the editor↔viz capability-threshold handoff, and a
risks/unknowns section. Use Vancouver-style numbered references [1], [2], … with a REFERENCES section of
[name](url) hyperlinks.
```

---

## Prompt 4 — The **declarative facade + canonical graph data model & serialization**

> **Grounding:** File 1's central architectural claim — *"the declarative/schema layer is the unifying glue"*: a **Zod-described affordance set + a `RendererRegistry` of ranked renderers keyed on `getCapabilities()`** should let the *same declaration* pick the editor when typed ports + editing are present, fall back to viz renderers as scale rises and editing drops, and degrade to a table when node-link adds nothing. This prompt covers the schema/registry design **and** the canonical graph data model/serialization that must round-trip the Python backends (meshed `nodes_and_links`, `linked`'s 12 representations, networkx node-link JSON, cytoscape JSON, GraphML/GEXF).

```text
You are helping design the DECLARATIVE FACADE and the CANONICAL GRAPH DATA MODEL for a schema-driven
graph-UI system. Context: an existing TypeScript monorepo ("zodal") already declares collection shape +
capabilities once via Zod v4 schemas and generates headless UI config, state, and data access from that
declaration, selecting concrete UI renderers via a capability-ranked RendererRegistry. We are extending
this to GRAPHS: declare a graph's shape (nodes, edges, optionally TYPED PORTS) and its AFFORDANCES (e.g.
editable / executable / has-provenance / large-sparse), then pick renderers (typed-port editor, GPU viz,
table) by declared capability. Bias toward reusing existing standards and libraries.

ANSWER THESE QUESTIONS:
1. CANONICAL DATA MODEL: what in-memory + serialized graph model should the facade adopt as its hub so it
   can feed multiple renderers AND round-trip backend formats? Compare graphology's serialized format,
   JSON Graph Format (JGF), Cytoscape.js JSON, React Flow's nodes/edges shape, networkx node-link JSON,
   and GraphML/GEXF. Which makes the best neutral hub, and what thin adapters convert to each renderer?
   How should TYPED PORTS (named, typed input/output handles, à la the Python `meshed` library) and
   PORT-LEVEL edges be represented in this model (most graph formats only have node↔node edges)?
2. SCHEMA MODELING IN ZOD v4: how should node types, edge types, port types, and graph-level affordances
   be expressed as Zod schemas so that (a) per-node/edge field affordances are inferred (reusing the
   existing collection inference) and (b) graph-level capabilities (editable, executable, has-provenance,
   directed, scale class) are declared? Survey prior art in SCHEMA-DRIVEN / DECLARATIVE graph & diagram
   UIs (e.g. declarative React Flow patterns, JSON-schema-driven form/flow builders, model-driven diagram
   frameworks like Sprotty/Eclipse GLSP, mermaid/PlantUML/D2 as declarative diagram languages) — what to
   borrow, what to avoid.
3. CAPABILITY-BASED RENDERER SELECTION: how should a registry rank and pick a renderer from declared
   capabilities + runtime signals (node count, whether typed ports exist, whether editing is enabled)?
   What's a good "capabilities" vocabulary (analogous to a data provider's getCapabilities()) for graphs,
   and how do renderers honestly report what they support server-side vs client-side?
4. RENDERER-AGNOSTIC OVERLAYS & STATE: how should traversal/provenance OVERLAYS, selection, styling, and
   layout be represented as serializable config that ANY renderer consumes (so switching renderers
   preserves intent)?
5. PRIOR ART / DON'T-REINVENT: are there existing declarative graph-UI frameworks that already do most of
   this (and could be adopted or wrapped) rather than built fresh?

EVALUATION CRITERIA: a neutral, serializable, round-trippable hub model; clean mapping from Zod schemas to
renderer config; honest capability reporting; renderer independence; and reuse of existing standards/libs
over bespoke design.

OUTPUT: a recommended canonical data model (with a typed-port representation), a Zod-schema modeling
sketch for nodes/edges/ports/affordances, a proposed graph "capabilities" vocabulary + renderer-selection
rule, a list of adapters to existing renderer/serialization formats, and a risks/unknowns section. Use
Vancouver-style numbered references [1], [2], … with a REFERENCES section of [name](url) hyperlinks.
```

---

## Prompt 5 — **Table / matrix / form** surfaces for graph data ("not-a-graph")

> **Grounding:** File 1's single most universal affordance, `switch-to-table-view` (**12/12 subjects**), and the "table-or-matrix / not-a-graph" cluster (linked, lacing, dagapp forms, nw tables, networkx, graph_dbs results). The table itself is largely settled (zodal already uses **TanStack Table**); the open research is the **adjacency/relation matrix & heatmap** viewer, **per-node value-editing forms**, and the **view-switching UX** (when table/matrix beats node-link). Keep this prompt tight.

```text
You are helping choose the components for the "NOT-A-GRAPH" surfaces of a declarative TypeScript/React
graph-UI system: rendering and operating on graph data as a TABLE, an ADJACENCY/RELATION MATRIX, or a
per-node FORM, rather than a node-link diagram. Context: graph data is frequently best operated on as an
edge-list table, an adjacency/relation matrix/heatmap, a paged query-result frame, or a per-node value
form; "switch to table view" is the most universally requested affordance in our analysis. The table
backbone is already TanStack Table; this research is mainly about the MATRIX and FORM surfaces and the
view-switching UX. Bias toward reusing existing components and integrating with TanStack Table + Zod.

ANSWER THESE QUESTIONS:
1. ADJACENCY/RELATION MATRIX & HEATMAP: what maintained, performant TS/React components render an
   interactive node×node adjacency matrix or relation matrix/heatmap at scale (reorderable rows/cols,
   cell tooltips, color encoding, large-matrix virtualization)? Evaluate at least regular-table
   (FINOS/Perspective), AG Grid, Glide Data Grid, ECharts/visx/Plot heatmaps, and any graph-specific
   matrix viewers. When is a matrix the RIGHT operable surface for a graph vs a node-link diagram?
2. EDGE-LIST / RESULT TABLE: confirm or challenge TanStack Table as the universal lens for edge lists,
   query-result frames (with paging/limit), per-step/per-shot status tables, and node/edge property
   tables. Note any gaps it can't cover that AG Grid / Glide Data Grid / react-data-grid would.
3. PER-NODE FORMS: what is the best maintained approach for per-node value-editing forms driven by a
   schema (react-hook-form + Zod resolver, shadcn/ui form, or schema-form libraries like
   @rjsf / Autoform / Formily)? This must take a Zod node schema and render typed input widgets
   (number/slider/range/text/select/list) — as needed by form-first DAG apps.
4. VIEW-SWITCHING UX: what are good patterns for letting a user switch the SAME graph between
   table / matrix / node-link / form lenses while preserving selection and filters? Any prior art in
   tools that offer multiple coordinated views of one dataset?
5. Health & licensing for each component (flag AG Grid Enterprise and any non-permissive license).

EVALUATION CRITERIA: maintained & modern (TS, React, ESM); permissive license; large-data virtualization;
schema/Zod-driven configuration; and clean integration with an existing TanStack-Table-based table layer.

OUTPUT: a comparison table for the matrix/heatmap and form options, a recommendation for the matrix viewer
and the per-node form approach, a short note on the view-switching pattern, and a risks/unknowns section.
Use Vancouver-style numbered references [1], [2], … with a REFERENCES section of [name](url) hyperlinks.
```

---

## Prompt 6 — **Execution, pipeline-stepper, provenance & timeline** renderers

> **Grounding:** File 1's "executable-DAG" cluster (E) and its two distinct sub-UIs, plus the provenance/timeline surfaces. (a) **Dataflow value-watching on a canvas** (`run-graph-on-input`, `step-through-execution`, `watch-values-flow`, `recompute-downstream-on-change`) for `meshed`/`dagapp`; (b) **linear named-step pipeline/agentic steppers** with status/retry/approval/cost (`view-step-status-and-retries`, `human-in-the-loop-approval`, `estimate-cost-and-gate`) for `aw`/`muvid`/`coact`; (c) **provenance/lineage diagrams + time-travel**; (d) a **timeline-track** surface for `lacing`/`nw` (interval tiers, Allen relations) — the regime File 1 flags as most likely to need bespoke glue.

```text
You are helping choose renderers for the DYNAMICS and PROVENANCE surfaces of a declarative
TypeScript/React graph-UI system. These cover four related needs; survey existing tools for each and
bias toward reuse:

(A) DATAFLOW VALUE-WATCHING ON A CANVAS — execute a computation DAG and watch intermediate/output values
    flow on the node-link diagram (set inputs, run, step node-by-node, see each node's current value,
    recompute only downstream of a change).
(B) LINEAR PIPELINE / AGENTIC STEPPERS — a named-steps pipeline (not a free-form canvas) with per-step
    STATUS, attempts/RETRIES, validation results, COST estimates + budget gates, and HUMAN-IN-THE-LOOP
    approve/reject/abort.
(C) PROVENANCE / LINEAGE + TIME-TRAVEL — read-mostly lineage views: select a node to see upstream sources
    and the downstream impacted/stale set; browse version history; replay state over an op-log; diff/fork.
(D) TIMELINE-TRACK SURFACE — interval "tiers"/tracks over a time axis (à la annotation timelines), with
    range brushing and interval-relation (Allen) queries — a genuinely NON-node-link surface.

ANSWER THESE QUESTIONS:
1. (A) What is the best way to add an EXECUTION/value OVERLAY to a node-link renderer (React Flow, Rete.js
   dataflow engine, or other)? Survey existing "run the graph and show values" UIs (visual dataflow tools,
   node-based computation editors, observable/notebook-style reactive recompute) and how they show live
   values + downstream recompute.
2. (B) What maintained TS/React components fit named-step pipeline/agentic run UIs with status/retry/
   approval/cost? Evaluate assistant-ui, agent-run/trace timeline UIs, XState + state-machine visualizers,
   stepper components (shadcn/ui, MUI Stepper), and workflow-run dashboards. Which align with a Zod-/
   schema-driven, headless-config approach?
3. (C) What existing patterns/libraries support data LINEAGE / provenance visualization and TIME-TRAVEL
   over a versioned graph (lineage diagrams, build-graph/impact views, event-sourced replay, git-style
   diff UIs)? How is the "stale downstream after a change" overlay typically presented? (Coordinate with
   the renderer-agnostic overlay engine — this is a presentation question, not a recompute one.)
4. (D) What maintained libraries render TIMELINE TRACKS / interval tiers with brushing and good
   performance (vis-timeline, vis.js, react-calendar-timeline, D3-based tracks, Gantt libs, OpenTimelineIO
   viewers)? Which support many tiers, half-open intervals, and a clean React/TS integration? Where is
   bespoke D3 unavoidable?
5. For each candidate across (A)-(D): maintenance, license, TS/React fit, and extensibility.

EVALUATION CRITERIA: maintained & modern (TS, React, ESM); permissive license; headless/config-driven and
Zod-schema-friendly; extensibility; and clean composition with the node-link editor and table backbone
(reusing them where possible rather than standalone tools).

OUTPUT: per-need (A/B/C/D) a short comparison + recommendation, a note on which needs reuse the node-link
editor / table vs require a dedicated renderer (flag the timeline as the likeliest bespoke-glue case), and
a risks/unknowns section. Use Vancouver-style numbered references [1], [2], … with a REFERENCES section of
[name](url) hyperlinks.
```

---

## Coverage check (prompts × File 1 regimes)

| File 1 regime / axis | Covered by |
|---|---|
| small-rich editor + typed ports (tool-deciding) | **P1** |
| traversal (D) + provenance overlays (tool-deciding) | **P2** (compute/decoupling) · **P6.C** (presentation) |
| large-sparse viz | **P3** |
| declarative glue + data model/serialization | **P4** |
| table-or-matrix / not-a-graph (`switch-to-table-view`, 12/12) | **P5** |
| executable-DAG dynamics | **P6.A** (canvas) · **P6.B** (stepper) |
| graph-DB / query explorer | composition of **P1** + **P5** (per File 1) — covered by their handoff notes; spin a dedicated run only if a graph-DB product becomes a near-term target |
| provenance / lineage / timeline | **P2** + **P6.C/D** |

All six File 1 regimes and both tool-deciding affordances are covered. The graph-DB explorer is intentionally *not* its own prompt — File 1 concludes it is a composition of the node-link editor (P1) and the table backbone (P5) plus a query editor, so it is folded into those rather than duplicated.
