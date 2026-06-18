# Graph Affordances Analysis — toward a zodal Graph-UI Facade

**Author:** Thor Whalen  
**Date:** 2026-06-18  
**Status:** Affordances analysis (File 1 of 2). File 2 — deep-research prompts — is derived from this.

> **Goal.** Build a *zodal renderer for graph UI tools*. zodal lets you declare a collection's data shape and capabilities once (via Zod v4 schemas) and generates UI config, state, data access, and API interfaces from that declaration. We want to extend the same bet to **graphs**: declare a well-organized set of graph **affordances** via Zod, then build **renderers** that map those affordances onto existing, modern, well-maintained graph-UI tools. We are explicitly **not reinventing the wheel** — the target is a thin declarative facade over solid tooling. This document catalogs the affordances each backend package needs or exposes, so we can find the common patterns and pick frontend tooling that covers as many cases as possible.

## Summary (read this first)

The headline result: **affordances cleave by UI regime, not by subject.** Each of the twelve subjects lives in one or two regimes, and its affordances cluster tightly around them. That is exactly what zodal wants — a *small* number of renderer families, selected by declared capability, can cover the whole fleet.

- **Five renderer families cover all twelve subjects.** (1) a **table/matrix backbone** (TanStack Table) — `switch-to-table-view` is wanted by **12/12** subjects and is non-negotiable; (2) a **small-rich node-link editor** (React Flow) — the only mainstream lib with first-class **typed ports + connection validation**, which the meshed gold-standard requires; (3) a **large-sparse GPU renderer** (cosmograph / sigma.js / Cytoscape.js) — one tool serving `linked`, large `graph_dbs` scenes, and laid-out `networkx`; (4) a **stepper + form** renderer built on zodal's *existing* collection-UI primitives (executable-pipeline + provenance subjects); (5) a **timeline-track** renderer (lacing / nw). The **graph-DB explorer** is a *composition* of (1)+(2), not a sixth tool.
- **The universal spine:** `switch-to-table-view` (12/12), `edit-node-properties` (11/12), `add-node` (~10/12), and import/export/convert-between-representations recur across nearly every backend.
- **The highest-leverage cross-regime affordances** (worth modeling once, reusing everywhere): `extract-subgraph` (appears in *every* regime), `find-path-between-two-nodes`, `highlight-neighbors` / `expand-ego-or-k-hop`, `style-by-attribute`, `switch-to-node-link-view`.
- **The two affordances that most constrain the tool choice — and deserve the deepest research:** **typed-port connection-with-validation** (only React Flow / Rete do it well) and **renderer-agnostic traversal/provenance overlays** (a networkx-class compute layer feeding highlights — path, ancestors/descendants, stale-set — into *whatever* node-link renderer is active).

## What an "affordance" means here

A way a user might want to **view or operate on** graph data that could surface as a concrete UI element or interaction — e.g. "add a node," "connect output X to a specific input port Y with type validation," "show the shortest path between these two nodes," "collapse this sub-graph into a single node," "switch to a table view," "run this DAG and watch values flow." Throughout, affordances are named as short verb-noun UI actions so they can feed a subject×affordance matrix.

## The spectrum

- **Large / sparse** — big graphs, little (or non-displayable) per-element metadata. Viewport, navigation, filtering, aggregation dominate; per-element editing is rare. *(cosmograph, large graph_dbs scenes, k-NN graphs, laid-out networkx.)*
- **Small / rich** — small graphs whose metadata must be visible and operable (flowchart, computation DAG). Per-element CRUD, typed ports, validation, execution dominate. *(meshed is the gold standard; ij; the graph_dbs edit-slice.)*
- **Not-a-graph** — sometimes the right UI for graph data is a **table / matrix / form / timeline**, not a node-link diagram. Called out where it applies. *(linked, lacing, dagapp forms, nw tables.)*

## Method & scope

Each subject was evaluated against nine dimensions — **graph semantics, scale & density, representation(s), structural CRUD, graph-level operations, traversal/graph-theory ops (only those with a plausible UI gesture), execution/dynamics, import/export, best-fit UI surface** — using whichever apply. Entries are grounded in **actual readmes/source** (local repos first, then PyPI/GitHub/web); depth was weighted by each package's `ir 0.XX` graph-centrality score (higher `ir` → deeper treatment), and information gaps are flagged honestly rather than guessed. Twelve subjects were analyzed in parallel, then normalized into the consolidated catalog, matrix, and regime clusters in the synthesis below.

---

## Per-Subject Analysis

### Primary graph / DAG libraries

#### meshed

**Regime: small-rich editor / executable-DAG.** The gold-standard rich case — a callable DAG where functions are nodes and edges land on *specific named arguments* (typed ports), not node-to-node. The whole graph is runnable, sub-settable, composable, and renderable. [meshed (GitHub)](https://github.com/i2mint/meshed) · [PyPI](https://pypi.org/project/meshed/) · [docs](https://i2mint.github.io/meshed/)

- **Graph semantics:** Bipartite — `FuncNode`s (functions) and var-nodes (named values). A `FuncNode` carries `name`, `out`, and a `bind` ({arg → scope-name}) mapping; an out-value flows into a *specific named parameter* of a downstream node. Ports = function arguments, typed/default-bearing via `i2.Sig`.
- **Scale & density:** Small-rich. Per-node metadata (function, arg names, types, defaults, bound sources) is the point and must be visible/editable. Not a large-sparse renderer.
- **Representations:** In-memory tuple of `FuncNode`s + adjacency `Mapping` (`graph` / `graph_ids`); `itools` works on any `{node: neighbors}` map. Serializes via `to_dict`/`from_dict` and round-trips to/from Python source (`code_to_dag` / `dag_to_code`). Renders to graphviz dot, SVG/PNG, and ascii.
- **Structural CRUD:** Add nodes by passing funcs (`DAG([*dag, f])`); rewire via `bind` or `add_edge(from, to, to_param=)` (connect to a *chosen* argument); swap functions with signature-compatibility checks (`rebind_to_func`, `ch_funcs`); validation enforces unique valid identifiers and that bind keys are real params.
- **Graph-level ops:** Union (`dag1 + dag2`, `sum`), sub-DAG extraction (`dag[inputs:outputs]`), `partial()` currying, and — because a DAG is itself callable — collapse a sub-DAG into a single reusable node / expand it back; `code_to_dag` round-trip for save/reuse.
- **Traversal ops (UI-mappable):** `find_path(src, dst)`, `has_cycle` (returns the cycle), `topological_sort`, `ancestors`/`descendants`/`parents`/`children`, `root_nodes`/`leaf_nodes`, neighbors, in/out degrees.
- **Execution / dynamics:** Fully executable — `__call__` runs nodes in topo order over a shared scope. `call_on_scope_iteratively` yields per step (watch values flow); `last_scope` + debugger hook expose every intermediate value as provenance.
- **Import / export:** In from funcs / FuncNodes / dicts / Python source; out to Python source, dot/SVG/PNG, ascii, adjacency map.
- **Best-fit UI:** Node-link diagram with *typed ports* (React Flow / Rete-style), plus hybrid synopsis-table and ascii views, with an execution overlay and sub-DAG collapse/expand.

**Affordances**
- add function node from list; wrap bare callable as node; delete node; rename node
- connect output to specific input port; rebind argument to a different source; validate port connection by signature; swap node function with signature check
- extract sub-graph between inputs and outputs; merge or union two graphs; curry graph into smaller signature
- collapse sub-graph into reusable node; expand node into sub-graph; save graph as reusable component
- run the DAG on input data; step through execution node by node; watch intermediate values flow; inspect last execution scope
- show topological execution order; find path between two nodes; detect cycles; highlight ancestors and descendants of a node; show neighbors of a node; mark root input and leaf output nodes
- render node-link diagram; render ascii diagram; switch to table or synopsis view
- export graph as Python code; import graph from Python code; export diagram as image; edit node argument defaults and types

#### ij

**Regime: small-rich editor + code-analysis + provenance.** "Idea Junction" — a NetworkX-backed, bidirectional diagramming library whose AST-like `DiagramIR` (typed nodes, labeled directed edges) round-trips between text, Python/TypeScript source, and diagram-as-code formats (Mermaid/PlantUML/D2/Graphviz). Highest-ir subject because graph IS the core; it exposes the broadest graph-theory operations surface of the cohort, but has **no typed ports, no add-time connection validation, and no DAG execution** (it visualizes/analyzes structure, it doesn't run it). Links: [ij (GitHub)](https://github.com/i2mint/ij) · [ij (PyPI)](https://pypi.org/project/ij/) · built on [NetworkX](https://networkx.org).

- **Graph semantics:** Directed graph. `Node(id, label, NodeType, metadata)` where NodeType ∈ {PROCESS, DECISION, START, END, DATA, SUBPROCESS, CUSTOM} (auto-inferred from label keywords); `Edge(source, target, label?, EdgeType, metadata)` where EdgeType ∈ {DIRECT, CONDITIONAL, BIDIRECTIONAL}. Domains: flowcharts, dataflow, Python call graphs, class/inheritance diagrams, ER diagrams, state machines.
- **Scale & density:** Small-rich — labels and node-type shapes are meant to be visible/operable; explicit complexity guards (warns >50 nodes, branching >10; configurable max-nodes/max-edges). Not built for huge sparse graphs.
- **Representations:** Central `DiagramIR`; round-trips to a NetworkX `DiGraph` for all analysis; serialized as Mermaid/PlantUML/D2/DOT text; layout coords ({id:(x,y)}) from hierarchical/force-directed/circular/grid engines.
- **Structural CRUD:** add/get node & edge with enum-tagged types + metadata dicts. **No typed argument ports (unlike meshed); no connection-validation at connect-time** — validity is a separate lint pass (dangling-edge, self-loop, duplicate-id rules). Diff classifies node/edge add/remove/modify.
- **Graph-level ops:** merge (union of diagrams), diff (compare two diagrams), git-style branch merge, subgraph extraction (BFS from root, max-depth), filter by node-type / predicate, simplify (drop isolated, dedupe edges), transitive reduction (drop redundant edges), collapse a linear non-branching chain into one node. SUBPROCESS is a marker only — no runtime collapse-to/expand-from reusable-component round-trip.
- **Traversal / graph-theory ops (UI-mappable):** find all simple paths between two nodes; detect cycles (+ highlight cycle path); topological order (or "has cycles"); find critical/articulation nodes (removal disconnects graph); connectivity / reachability check listing disconnected nodes; reverse edges; degree & statistics.
- **Execution / dynamics:** Not executable — no value flow or intermediate inspection. Authoring-time dynamics: `watch` CLI live-re-renders on file change; `DiagramHistory` + diff/merge give version provenance. Closest to "semantics": AST reverse-engineering of code into flowcharts/call-graphs/class-diagrams.
- **Import / export:** In — text DSL (conditionals/parallel/loops), Mermaid & D2 parsers, Python/TS analyzers, importers for PlantUML/drawio/OpenAPI/databases. Out — Mermaid, PlantUML, D2, Graphviz, sequence diagrams, PNG (playwright). CLI: convert · validate · stats · simplify · diff · extract · watch.
- **Best-fit UI:** Node-link diagram is the natural surface (the typed-node + labeled-directed-edge + layout-coord IR maps cleanly to React Flow / Cytoscape), but ij currently emits diagram-as-code text + static images and a minimal Mermaid HTTP viewer rather than an interactive canvas. Its diff/stats/lint outputs also argue for a side panel and a node/edge table view.

**Affordances**
- Structural: add/delete/edit node, set node type, add/delete/label edge, set edge type, edit node metadata
- Traversal/analysis: find all paths between two nodes, detect cycles, highlight cycle path, compute topological order, find critical/articulation nodes, check connectivity, list disconnected nodes, show node degree, reverse edge directions
- Graph-level: extract subgraph from root (with depth limit), filter nodes by type/predicate, simplify diagram, remove transitive edges, collapse linear chain into single node, merge diagrams, diff two diagrams (show added/removed/modified), merge diagram branches
- Quality/inspect: view statistics, validate against rules, lint for style
- Generation: generate flowchart / call graph / class diagram / sequence diagram from code, convert text to diagram
- View/format: switch render format, apply layout, export as image, watch & live-preview, browse version history, view nodes/edges as a table

#### linked

**[table-or-matrix | large-sparse viz] A headless Python conversion hub that auto-routes graphs between 12+ representations and builds graphs from vectors via k-NN — the "representations" authority. No UI, editing, or execution; it sits *upstream* of a UI, feeding it.** ([GitHub](https://github.com/i2mint/linked) · [PyPI](https://pypi.org/project/linked/))

- **Representation(s) [authority]:** 12+ registered "kinds" in a hub-and-spoke around `edgelist` + `nodes_and_links`: `nodes_and_links` (D3 JSON dict), `edgelist` (Nx2), `weighted_edgelist` (Nx3), `minidot` (text mini-language `1 -> 2`), `adjacency_matrix` (dense), `sparse_adjacency` (scipy CSR/CSC/COO), `adjacency_list` (dict-of-neighbors or `{nbr:weight}`), `networkx_graph`/`networkx_digraph`, `edges_dataframe`, `graph_dataframes` (edges+nodes DataFrames), and `vectors` (Nxd → graph). Conversions auto-route the cheapest path via `i2.castgraph` (per-edge costs, LRU-cached paths, `isa()` source auto-detection); optional deps register gracefully only if importable.
- **Graph semantics:** representation-agnostic, not domain-specific. Nodes = bare int/str ids (at most an `id` field); edges = (src,tgt[,weight]). Directedness is a per-conversion flag (auto-detected from matrix symmetry); weights first-class. No typed ports, no rich metadata model.
- **Scale & density:** spans both ends — explicitly targets large-sparse (k-NN over 50K–500K points, 3000+ dims, approximate NN via pynndescent, sparse outputs, MST/NN connectivity repair) and small graphs (mini-dot authoring, dense adjacency). Metadata is *not* edited here.
- **Graph-level ops:** representation-level only — convert whole graph, add/strip weights, densify↔sparsify, directed↔undirected normalization. No merge/diff/subgraph/collapse. Introspection: `graph_kinds()`, `reachable_from_kind()`, `sources_for_kind()` — a "what can this become" query over the meta-graph of formats.
- **Traversal ops:** mostly n/a as UI gestures; only MST + connected-components used *internally* to repair k-NN connectivity. (The router's shortest-path search runs over the format meta-graph, not user data.)
- **Import/export:** strong — every kind is an in/out format (NetworkX objects, pandas DataFrames, dense/sparse adjacency, numpy edge lists, D3 JSON, mini-dot text); `vectors` is one-way ingestion. GraphML/GEXF/full-DOT are noted as future, not implemented.
- **Best-fit UI:** hybrid / upstream-of-UI. Directly motivates the *table/matrix vs node-link* choice: the same graph is offered as edge-table (`edges_dataframe`), adjacency-matrix/heatmap (`adjacency_matrix`/`sparse_adjacency`), or node-link diagram (`nodes_and_links`) — a UI should let the user pick the lens. Structural CRUD / execution / provenance: **n/a**.

**Affordances**
- pick graph representation; switch to table view / matrix view / node-link view (same graph, different lens)
- convert graph to format; auto-detect source format; list available formats; preview reachable formats; tune conversion cost/route
- build k-NN graph from vectors; set neighbor count; choose distance metric; toggle approximate vs exact NN; ensure graph connectivity
- add / strip edge weights; toggle directed/undirected; densify to adjacency matrix; sparsify to sparse matrix
- author graph via mini-dot text; export to NetworkX / DataFrame / nodes_and_links JSON

#### dagapp

**Regime: executable-DAG (small-rich on values, read-only on structure).** A thin Streamlit facade over a fixed `meshed.dag.DAG`: it turns an already-wired computation DAG into an interactive calculator — set root inputs via typed widgets, watch computed/intermediate/output values propagate, with a static Graphviz picture of the graph alongside for orientation. The diagram is a read-only schematic; all interaction is form-based. ([dagapp (GitHub)](https://github.com/i2mint/dagapp) · [dagapp (PyPI)](https://pypi.org/project/dagapp/) · built on [meshed](https://pypi.org/project/meshed/)).

- **Graph semantics:** nodes = functions (`FuncNode`s) + their named value-nodes; edges = dataflow (an output feeds a named argument downstream). Roots are user-settable inputs, non-roots are computed, the leaf names the "Calculator". All graph semantics come from `meshed`; dagapp adds none.
- **Scale & density:** small-rich, but only on the *value* axis — tiny DAGs whose per-node values/types/ranges must be visible and editable. Structure is fixed at DAG-construction time in Python, not editable in-app.
- **Representation(s):** in-memory `meshed.dag.DAG` passed in Python; introspected via `dag.roots/leafs/var_nodes/func_nodes/graph/sig`. Visual form is a Graphviz DOT string (`dag.dot_digraph()`); live values live in `st.session_state` keyed by node name. No graph file format.
- **Structural CRUD:** none through the UI — no add/delete/edit of nodes/edges, no port wiring or connection validation. The only editing is of root-node *values*, via per-node widgets (number/slider/double-slider/text/list/dict-expander/checkbox); widget type comes from `configs.arg_types` (inferred from annotations, defaults to `num`), sliders need `configs.ranges`.
- **Graph-level ops:** multiple DAGs surface as separate sidebar-radio pages (navigation-level composition only). No merge/diff/compose, sub-graph extraction, or collapse/expand-to-node — even though `meshed` supports collapse/expand, dagapp does not surface it.
- **Traversal / graph-theory ops:** one real gesture — on a value change, `meshed.itools.successors` drives forward propagation to recompute only downstream nodes; a "Reload DAG from root nodes" button does a full recompute from roots. No path/cycle/reachability UI queries.
- **Execution / dynamics:** the core. Every widget edit fires an `on_change` callback that re-runs affected functions and writes results back, so intermediate and output values update live — a watch-the-values-flow calculator. `StaticPageFunc` shows non-roots as read-only computed displays; `VectorizePageFunc` sweeps a root over a `linspace` (double-slider range + count) and renders outputs as a DataFrame. No provenance/history.
- **Import / export:** n/a for the graph (live Python object in, no graph export). Value-level only: typed inputs, outputs as text / `st.write` / pandas tables; diagram emitted as Graphviz DOT.
- **Best-fit UI surface:** form-first hybrid — two-column Streamlit page (left = stack of input/output widgets per node, right = *static* Graphviz node-link picture for orientation, not interactive), plus a sidebar radio to switch DAGs. The operable surface is the widget form; the node-link view is a read-only schematic.

**Affordances**
- set node input value
- adjust slider input
- sweep input over range
- set input count for sweep
- edit list/dict input
- toggle boolean input
- view computed node value
- view node output as table
- watch values propagate downstream
- recompute downstream nodes on change
- reload DAG from root nodes
- view DAG diagram
- switch between DAG pages
- configure input widget type per node
- set slider min/max range

### Pipeline / workflow with graph aspects

#### aw

**Regime: executable-DAG (degenerate / linear) — graph relevance thin.** `aw` is an AI-agentic data-preparation *pipeline* library (ReAct loop, validate-and-retry, human-in-the-loop), not a graph tool. Its only graph-shaped surfaces are a strictly linear step chain and priority/mapping routers, and its cosmograph hook prepares a flat points DataFrame (no edges). Links: [aw (GitHub)](https://github.com/thorwhalen/aw) · [aw (PyPI)](https://pypi.org/project/aw/).

- **Graph semantics:** `AgenticWorkflow.steps` is an ordered list of named `AgenticStep`s; "edges" are just implicit artifact-passing between consecutive steps (output of N is input of N+1). `routing.py` adds priority/conditional/mapping *decision chains* (first-match short-circuit) for file-extension detection — dispatch logic, not a user graph.
- **Scale & density:** Tiny-and-rich on the pipeline side — a few steps, each with surfaceable metadata (success, retry attempts, validation result, context snapshot). Cosmograph data may be large, but that's the visualized payload, not aw's structure.
- **Representations:** In-memory list of named steps + a `Context` (MutableMapping) with `snapshot()` history; `run()` returns `(artifact, nested-metadata-dict)`. Cosmograph path is a flat pandas DataFrame with inferred params (`points_x_by`, `points_y_by`, `point_size_by`, `point_color_by`) — **no edge list / adjacency / NetworkX / source-target handling exists**.
- **Graph-level ops:** `run_partial(stop_after=name)` runs a prefix of the chain (sub-pipeline by truncation); factory functions compose canned chains. No merge/diff, no collapse-to-node/expand.
- **Execution / dynamics (the real strength):** Workflows are executable; each step runs a ReAct loop (Reason→Act→Observe→validate→retry to `max_retries`). Rich provenance per step (attempts, errors, validation_result, snapshots); `InteractiveWorkflow` adds per-step human approval gates with abort-and-reason.
- **Import / export:** Input = `source_uri` (CSV/file) → pandas DataFrame; output = prepared DataFrame + metadata. The cosmograph "export" is param inference (a kwargs dict), not graph serialization.
- **Best-fit UI:** A **linear pipeline / stepper** (steps left-to-right with status, retry count, validation badge, approval gate + per-step metadata drawer), plus a separate column→x/y/size/color *point-cloud config* view for the cosmograph hand-off. Not a free-form node-link editor.

**Affordances**
- Add step to pipeline
- View pipeline step sequence
- Run pipeline on input
- Run pipeline up to a step (partial run)
- Inspect step metadata
- View step validation result
- View step retry attempts
- Approve or reject step (human-in-loop)
- Abort pipeline at step
- View context snapshot
- Select x/y column for cosmograph
- Select size column for points
- Select color column for points
- Switch to point-cloud view

#### nw

**Provenance regime** — a per-project lacing/provenance graph that records what was made, from what, and why. Sections, shots, character/environment refs, decisions, and render-results are typed lacing `Annotation` nodes across multiple SQLite stores; the single edge type, `provenance.was_derived_from`, forms a DAG that powers lineage and freshness ("what's downstream of this change?") queries. ([nw (GitHub)](https://github.com/thorwhalen/nw), [lacing (PyPI)](https://pypi.org/project/lacing/))

- **Graph semantics**: nodes = typed annotations at tiers `section`/`shot`/`character-ref`/`environment-ref`/`decision`/`render-result`/`storyboard-panel`, each with a Provenance envelope and an interval-bearing `MediaRef`. The only edge is `was_derived_from` (per-node parent-UUID list); render-results and retry-decisions link back to the shot/node they acted on.
- **Scale & density**: small-to-moderate, rich. Tens-to-hundreds of nodes per project; per-node metadata (strategy, framing, cost, decision payload) is inspectable and lineage-facing, not free-form drag-edit.
- **Representation(s)**: one or more lacing `SqliteStore`s per project (project + storyboard + lyrics/alignment), walked as one logical graph; flat annotation list + on-demand parent→children index for closures; mirrored to `.nw/decisions.jsonl`.
- **Structural CRUD**: typed upserts with replace-by-stable-id (`upsert_shot`/`section`/`character_ref`/`environment_ref`); append-only `append_decision`. Edges are set programmatically at generation time — no hand-drawn port/connection editing.
- **Graph-level ops**: sub-graph extraction by tier (`annotations_at_tier`) and by lineage (`descendants_of`); `clone_project` forks a whole project graph with preserve/reset sets for sibling experiments. No merge/diff or collapse-to-node.
- **Traversal ops (with UI gesture)**: `derived_from` (one-hop ancestors), `descendants_of`/`stale_after` (transitive downstream closure), tier-lens — each maps to "select node → show lineage" or "mark changed → highlight stale set".
- **Execution / dynamics**: the graph is a provenance ledger, not an executable DAG, but it records the prepare→plan→execute render lifecycle (render-result + render-decision nodes capturing strategy, output, artifact id, cost). Freshness (`stale_after`) is the live surface: edit upstream → downstream renders flagged out of date.
- **Import/export**: idempotent migration of pre-graph/muvid projects into the graph; out via the SQLite stores + JSONL audit log. No node-link interchange format.
- **Best-fit UI**: hybrid, not an editable canvas — a lineage/provenance inspector (upstream sources + downstream-impacted set), a timeline of interval-anchored shots/sections/panels, and per-tier tables (shots, decision log); a read-only node-link diagram suits the `was_derived_from` DAG, with editing in forms.

**Affordances**
- inspect node provenance; show upstream sources of a node; trace render lineage to its shot
- highlight downstream-impacted nodes; flag stale derivatives after a change
- filter nodes by tier; switch to table view per tier; browse shots on a timeline
- view decision/audit log; open node detail form
- upsert node by stable id; append decision record
- fork project graph (clone experiment); diff sibling project graphs

#### muvid

**executable-DAG (pipeline, not a graph library).** Song-to-video orchestrator: a fixed linear chain of staged steps (init → transcribe → align → cast → environments → script → render → compose) with a per-shot fan-out at the render step, concatenated in timeline order by `compose`. Sibling packages (`falaw`, `lookbook`, `lacing`, `an`, `mixing`) are driven through a `muvid.contracts` adapter layer. [muvid (GitHub)](https://github.com/thorwhalen/muvid) · [PyPI](https://pypi.org/project/muvid/)

- **Graph semantics:** no explicit graph model — the "graph" is a hardcoded linear pipeline; stages and `ShotSpec`s are the de-facto nodes, their ordering is convention in code, not a stored edge set. Only fan-out: shots render independently, then concat.
- **Scale & density:** tiny and rich — a few stages plus a modest list of shots/characters/environments, each with heavy editable metadata (lyrics.md, character cards + curated images, env anchors, render params, USD cost). Small-rich, but a pipeline, not node-link.
- **Representation(s):** project folder + `project.json` (`ProjectSpec`/`ShotSpec`/`SectionSpec` dataclasses), content-addressed render cache, lacing interval annotations, falaw progress JSONL (`.muvid/fal_events.jsonl`). No edge-list/adjacency/NetworkX form.
- **Structural CRUD:** stage verbs + per-shot CRUD via `script.md ↔ ShotSpec` list; no node-to-node edge editing, no typed ports — adjacency is fixed by the pipeline.
- **Execution / dynamics:** the most graph-adjacent aspect — stage-by-stage run, content-addressed incremental re-render (only what changed), `--budget`/`estimate-cost` gating, falaw events streamed over SSE so `status`/UI show "currently running…" and per-shot timings; `log_decision` gives lightweight provenance.
- **Import / export:** in: song mp3 + user-edited `lyrics.md`/`script.md`; out: `output/final.mp4`, plus `status --json`. No graph-format I/O.
- **Best-fit UI:** a stage-progress checklist + a per-shot render table (fan-out), not a node-link editor. CLI, Claude skill, and a single-page FastAPI UI all dispatch to the same `muvid.facade` verbs.

**Affordances**
- show pipeline stage progress
- run next pipeline stage
- view per-shot render status
- edit shot parameters
- pick render strategy per shot
- estimate render cost
- gate render on budget
- watch live render progress
- re-render changed shots only
- concatenate shots into final video
- view structured project status
- replay curation decisions

#### coact

**Regime: executable-DAG (weak) / provenance — agent-stack glue that runs a single capability through a *linear* COMPLETE → REALIZE → PUBLISH state-transition pipeline (skill → agent definition → running agent / `.mcpb` / connector). No native graph model; multi-node topology is delegated to external runtimes.** [coact (GitHub)](https://github.com/thorwhalen/coact) · [coact (PyPI)](https://pypi.org/project/coact/)

- **Graph semantics (weak):** core artifact is a linear pipeline over one capability, not a graph. The only multi-node structure is delegated outward — a realized agent satisfies `aw.AgenticStep` and is *exposed* (`.agent`) to drop as a node into someone else's graph (LangGraph `StateGraph`, CrewAI `Crew`, aw workflow). coact never owns that graph (DECISIONS D8: "topology stays out").
- **Scale & density:** small-rich but not a graph — each unit is one `AgentDefinition` with editable metadata (persona, return-contract schema, tool allowlist, model, memory, MCP bindings); a "fleet" is a handful, via a user-owned `scaffold` shim.
- **Representations:** single `AgentDefinition` → `.claude/agents/*.md`, Agent SDK dict, aw `AgenticStep`; skills stay on disk as SSOT and are referenced, never copied. No edge-list / adjacency / NetworkX form.
- **Structural CRUD:** per-node CRUD on the extras envelope (persona, return schema, tools, model, memory) and tool bindings (`module:function` handlers; an unbound "proposed" tool won't run until bound — loosely like an unconnected typed port). No node-to-node edge CRUD.
- **Graph-level ops (adjacent only):** collapse-like packaging via PUBLISH (capability → reusable `.mcpb` / remote connector); `back` is a lossy inverse transition (agent → skill stub). Real graph composition is the host runtime's job.
- **Execution / dynamics (strong):** REALIZE makes a definition executable across backends (host, sdk, mcp, litellm, langgraph, crewai); `estimate()` is a cost gate before fan-out; `plan_completion`/`diff`/dry-run surface provenance (every synthesized field + source + warnings) before anything writes or runs.
- **Import / export:** in — `.claude/skills`, `module:function` refs, live callables, NL description (LLM draft); out — `.claude/agents/*.md`, SDK dict, aw spec, FastMCP server, Claude `.mcpb` extension, remote OAuth connector scaffold.
- **Best-fit UI:** not node-link. A per-definition **form/wizard** (persona, return schema, tools, model) + **provenance/diff panel** + a **linear pipeline-stage stepper** (COMPLETE → REALIZE → PUBLISH). A node-link view only appears once agents land in an external runtime's graph — out of scope here.

**Affordances**
- complete skill into agent definition
- preview completion plan with provenance (dry-run)
- edit agent persona / system prompt
- edit return-contract schema
- edit tool allowlist; set model; set memory scope
- bind tool to `module:function` handler; flag unbound (proposed) tool as not-runnable
- realize agent on a chosen backend
- estimate fan-out cost before running
- diff agent definition against skill; convert agent back to skill stub
- package capability as MCP bundle (`.mcpb`); scaffold remote OAuth connector
- draft agent from natural-language description
- step through COMPLETE → REALIZE → PUBLISH stages
- drop realized agent as node into external graph runtime

### Weak / conceptual link

#### lacing

**Regime: weak/none (table-or-matrix).** A standoff, interval-keyed annotation system: an `intervaltree`/SQLite-R\*Tree/Postgres-GiST collection of time intervals carrying typed `Annotation` envelopes, queried through **Allen's 13 interval relations**. The only graph here is *implicit and relational* -- Allen relations (before/meets/overlaps/during/contains/equals/...) form a directed labeled relation (with a 13x13 composition algebra) over interval pairs, plus explicit derivation/discussion edges (`AnnotationRef`, `Provenance.was_derived_from`) and a tier parent-child hierarchy. None of this is rendered as nodes-and-edges; the natural surfaces are a **timeline with tier tracks** and a **table**. Links: [GitHub](https://github.com/thorwhalen/lacing) - [PyPI](https://pypi.org/project/lacing/) - [docs](https://thorwhalen.github.io/lacing).

- **Graph semantics:** intervals + annotations, not nodes/edges; "edges" are Allen relations computed on demand, plus derivation/reference links and tier hierarchy.
- **Representation(s):** `intervaltree` (memory), SQLite R\*Tree `.annot`, Postgres `int8range`+GiST; Pydantic v2 -> JSON Schema -> Zod. No edge-list/adjacency/NetworkX -- relations are never materialized.
- **Structural CRUD:** full annotation/tier CRUD via a `MutableMapping` facade and REST (ETag/If-Match). No typed ports; nearest analog is **tier-stereotype constraints** (TIME_SUBDIVISION partitions parent, INCLUDED_IN lies within) validated on write.
- **Traversal (with a UI gesture):** pick a window, list intervals that **intersects / during / contains / overlaps / meets / starts / finishes / equals** it; `relate()` dispatches an arbitrary relation set. `compose()` (Allen constraint propagation) is a stub. No shortest-path/cycle/topo-sort UI.
- **Execution / dynamics:** not an executable DAG; instead an op-log with `/state-at` **time-travel**, **PROV-O provenance** inline on every annotation, a processor registry (Arq-backed), and annotator-agreement metrics.
- **Import / export:** rich -- eight round-trip adapters (TextGrid, WebVTT, W3C Web Annotation, `.annot`, ELAN EAF, JAMS, Label Studio, OpenTimelineIO) + JSON Schema. Annotation/timeline formats, not graph formats.
- **Best-fit UI:** **timeline + stacked tier tracks** and an annotation **table/grid**; a node-link diagram is the wrong surface. If relations ever need showing, a relation **matrix** (intervals x intervals colored by Allen relation) or a provenance/derivation DAG sidebar is the hybrid.

**Affordances**
- Select time window; filter intervals by Allen relation; list overlapping / contained intervals
- Add / edit-body / delete annotation; set annotation confidence
- Toggle tier-track visibility; filter annotations by tier; validate tier constraints
- Switch to table view; switch to timeline view; view relation matrix
- Import / export annotation file
- View provenance chain; follow derived-from link; replay state at time; compare annotator agreement

### Theme (no dedicated package yet)

#### graph_dbs (theme)

**Regime: graph-DB (large-sparse viz + small-rich inspection + table-or-matrix hybrid).** The defining trait of this regime is that the *real* graph lives in a backing database (Neo4j, Memgraph, Neptune, …) and is too big to render whole — so the UI is a **query-and-explore loop** (write Cypher/Gremlin → get a paged result frame → expand neighborhoods on click → accrete a working subgraph "scene"), not a hold-it-all canvas. Per-element metadata is rich and editable, but you only ever see the slice the query returned. Grounded in [Neo4j Bloom](https://neo4j.com/docs/bloom-user-guide/current/) / [Neo4j Browser](https://neo4j.com/docs/browser/operations/result-frames/), [Memgraph Lab](https://memgraph.com/docs/memgraph-lab), [Linkurious Ogma](https://linkurious.com/ogma/), [yWorks Data Explorer](https://www.yworks.com/products/data-explorer-for-neo4j), [Arrows.app](https://neo4j.com/labs/arrows/), and [Kineviz GraphXR](https://www.kineviz.com/graphxr).

- **Graph semantics:** Labeled property graph — nodes with one-or-more labels, typed directed relationships, arbitrary key/value properties on both; rendered to color/size/icon by label/type. (Triple/quad stores map the same patterns onto class/predicate.)
- **Scale & density:** Hybrid by necessity — large-sparse navigation (filter, aggregate, node caps, viewport) over a DB-resident graph, with small-rich inspection/editing of the visible result slice. Metadata must be both visible *and* operable.
- **Representations:** Server-side live DB; wire-level query result sets (nodes_and_links subgraphs, paged result frames); a client-side working subgraph accreted via expansion. Export to Cypher scripts, CSV/JSON, GraphML/GEXF, GXRF snapshots, images.
- **Structural CRUD:** Add/delete nodes & relationships, inline property editing, add/remove labels, retype relationships — committed back to the DB. Arrows.app is the pure-editor exemplar (drag-out-of-node to connect, double-click to edit, export Cypher). Connection-validation is schema/label-driven, **not** meshed-style typed ports.
- **Graph-level operations:** Subgraph extraction is the core op (every query/expansion = a scene); group/collapse selected nodes into a super-node (Bloom); save scenes/perspectives and saved-query favorites as reusable named subgraph generators; snapshot/diff (GraphXR).
- **Traversal ops (with UI gesture):** Expand-on-click neighborhood (selective by relationship type/direction — Bloom Advanced Expansion); shortest-path between two selected nodes (GraphXR / Cypher `shortestPath`); k-hop reachability via repeated expansion; centrality & community-detection run as an action then mapped to color/size; compound AND/OR attribute filters (Ogma). Topological order rarely applies (these graphs aren't DAGs).
- **Execution / dynamics:** Not an execution regime — the graph is data, not a program. The live dynamic is the query→result→expand→re-query loop; temporal/streaming variants (Ogma timeline, Memgraph real-time) let you watch the graph evolve; provenance is just another relationship.
- **Import / export:** Connect to a live Bolt/Gremlin/SPARQL endpoint, or drag-drop CSV/Excel/JSON with AI-assisted entity extraction (GraphXR); export Cypher CREATE scripts, CSV/JSON result frames, GraphML/GEXF, GXRF/snapshot archives, PNG/SVG.
- **Best-fit UI:** Query-driven hybrid — node-link scene for the working subgraph; a **co-equal results table** (Neo4j Browser/Memgraph Lab toggle — sometimes the table *is* the right view); a Cypher/Gremlin editor plus a no-code visual query/pattern builder; a schema/meta-graph panel (labels & types as their own little graph); and a property inspector/editor for the selected element.

**Affordances**
- run Cypher/Gremlin query; build visual query pattern; search by phrase (near-natural-language)
- switch table view / switch graph view; page through large results; limit result node count
- expand node neighborhood; expand by relationship type/direction; pan and zoom canvas; select node group
- inspect node properties; edit node property; add label to node
- add node; delete node; draw relationship; edit relationship type
- filter by property; compound filter nodes and edges; style by label
- find shortest path; run centrality algorithm; detect communities
- group nodes into super-node; collapse subgraph; snapshot subgraph; scrub temporal timeline
- save query as favorite; save scene as perspective
- view schema meta-graph; browse labels and types
- import from CSV; export as Cypher script; export result as CSV

### Special references (existing tools — mined for affordances)

#### cosmograph

**[large-sparse viz]** GPU-accelerated, force-directed visualizer for graphs and embeddings at hundreds-of-thousands-to-millions of points — the canonical large-sparse regime and already a polished UI, not a library to build one. Built on the `cosmos.gl` WebGL2/luma.gl engine (`@cosmos.gl/graph`), with React (`@cosmograph/react`) and app layers. Links: [cosmos.gl engine](https://github.com/cosmosgl/graph) · [@cosmos.gl/graph (npm)](https://www.npmjs.com/package/@cosmos.gl/graph) · [@cosmograph/react (npm)](https://www.npmjs.com/package/@cosmograph/react) · [cosmograph.app](https://cosmograph.app).

- **Graph semantics**: Points (entities or projected embeddings in xy) + links (typed only by index — *no ports, no connection validation*). Visual props per element: color, size, shape, image, cluster, opacity, pin; links: color, width, arrow, strength, curvature. Metadata-thin at the engine: elements are integer indices into Float32Arrays; rich attributes live in the app's DuckDB/Arrow tables and drive *encoding*, not inline editing.
- **Scale & density**: Extreme — real-time GPU force simulation + render of 100k–1M+ elements. Per-element metadata is deliberately not shown inline (only on hover/click or via aggregate color/size/cluster). The opposite extreme from meshed.
- **Representations**: Engine = flat Float32Array edge list + xy positions + per-attribute arrays; also pure xy point clouds (k-NN / projected embeddings) with optional links. App = columnar Arrow/Parquet/CSV/JSON in DuckDB-WASM; column→visual mapping is the binding step; view-state serialized as JSON snapshots.
- **Structural CRUD**: Bulk/declarative only — `setPointPositions` / `setLinks` / `setPoint{Colors,Sizes,Shapes}` / `setLink{Colors,Widths,Arrows}` / `setPointClusters` replace whole arrays; `setPinnedPoints` fixes nodes; `enableDrag` repositions one. No typed ports, no per-edge form editing.
- **Graph-level operations**: Sub-graph extraction by selection (rect/polygon/search → indices → `fitViewByPointIndices`); cluster/community grouping via `setPointClusters` + cluster force + labels. Snapshots save/restore/share a whole view (camera+selection+filters+config) as a reusable component. No merge/diff/DAG-collapse (out of regime).
- **Traversal ops (with UI gesture)**: Focus-and-highlight-neighbors via `getNeighboringPointIndices`; expand a 1-hop neighborhood via `getConnectedLinkIndices` / `getConnectedPointIndices`; `zoomToPointByIndex` to locate; `findPointsInRect` / `findPointsInPolygon` for spatial neighborhoods. No shortest-path/cycle/topo gestures.
- **Execution / dynamics**: The dynamics is the *layout simulation*, not data execution — `start`/`stop`/`pause`/`unpause`/`step` and live force-tuning via `setConfigPartial`, watching the graph relax (`onSimulationTick`, `progress`). Timeline drives temporal play/pause/stop animation; `trackPointPositionsByIndices` streams positions for overlays.
- **Import / export**: In: CSV/TSV/Parquet/Arrow/JSON (app) or Float32Arrays (engine). Out: PNG (`captureScreenshot`), snapshot JSON, published S3/Parquet projects, shareable run.cosmograph.app links, sampled point/link subsets for labels.
- **Best-fit UI surface**: GPU node-link canvas as primary, ringed by crossfiltered analytic panels — search, attribute histograms, categorical bars, temporal timeline, size/color legends, fit/zoom/play-pause/select-rect/select-polygon controls, hover popups, snapshot panel. Table view (DuckDB SQL) is the secondary surface when metadata must be read.

**Affordances**
- pan viewport; zoom in/out; fit view to all / to selected; zoom to a point; set zoom level
- run / pause / stop / step simulation; tune force (gravity, repulsion, link-spring, friction)
- drag a node; pin/unpin a node
- select by rectangle; select by polygon (lasso); search and locate a node
- highlight selected; grey out non-selected; focus a point (ring); focus a link (widen)
- highlight a node's neighbors; expand 1-hop neighborhood; highlight connected links
- color by attribute; size by attribute; set shape by attribute; color/width links; show link arrows
- cluster/community color; show cluster labels; show color legend; show size legend
- filter by histogram (brush range); filter by category bars; brush a time range; play/pause temporal animation
- hover for details popup; right-click context menu; show/hide labels; manage labels via sampled points
- sample points/links for huge-graph overlays
- capture screenshot; save / load / restore view snapshot; share view link; switch to table view

#### networkx

**large-sparse viz + executable-DAG (topology-only) + table-or-matrix — the canonical Python graph-theory library; its algorithm catalog is the authoritative source for which graph-theory ops can plausibly become UI gestures.** Pure-Python analysis/back-end layer: it computes (paths, components, ordering, centrality, communities) and exports to node-link / cytoscape JSON, then a real renderer (Gephi, Cytoscape.js, sigma, React Flow, cosmograph) draws and surfaces the gestures. Docs: [NetworkX](https://networkx.org/documentation/stable/), [Algorithms reference](https://networkx.org/documentation/stable/reference/algorithms/index.html), [Drawing/layout](https://networkx.org/documentation/stable/reference/drawing.html).

- **Graph semantics:** generic labelled (multi)graph — nodes/edges are hashables with free-form attribute dicts; no schema, no typed ports. `weight` is the one attribute with first-class algorithmic meaning. Graph/DiGraph/MultiGraph variants.
- **Scale & density:** spans the spectrum — large-sparse (millions of edges, pure topology) through small-rich DAGs. Being pure-Python, it is the compute layer behind a renderer, not the interactive canvas.
- **Representation(s):** edge list, adjacency matrix / SciPy sparse / NumPy, adjacency dict, node-link JSON, cytoscape JSON, pandas DataFrame, GraphML/GEXF/GML/Pajek. Node-link & cytoscape JSON are the direct bridge to web renderers.
- **Structural CRUD:** add/remove node & edge, attribute get/set, `subgraph`, `contracted_nodes`/`quotient_graph` (collapse). No typed ports and no connection-validation (an edge is just a node pair) — meshed-style port/type checking is a facade concern, not native.
- **Graph-level operations:** `compose`/`union`/`difference`/`symmetric_difference` (merge & diff), `subgraph`/`edge_subgraph` extraction, `contracted_nodes`/`quotient_graph` (the primitive for collapse-a-subgraph-to-one-node), `complement`, `line_graph`. No save-as-reusable-component, but contraction is the collapse primitive a UI would call.
- **Traversal / graph-theory ops (the core contribution; only UI-mappable ones listed):** `shortest_path`/`all_shortest_paths`/`dijkstra_path`/`astar_path` (path between two picked nodes); `dag_longest_path` (critical-path overlay); `descendants`/`ancestors`/`has_path`/`bfs_tree` (reachability + ancestor/descendant highlight); `neighbors`/`ego_graph` (k-hop ego expansion); `connected_components`/`weakly_`/`strongly_connected_components` (color-by-component); `topological_sort`/`topological_generations` (layered ordering); `find_cycle`/`simple_cycles` (highlight cycles); `articulation_points`/`bridges` (flag cut nodes/edges); `minimum_spanning_tree` (MST overlay); community — `louvain_communities`/`greedy_modularity_communities`/`girvan_newman` (color-by-community); centrality — degree/betweenness/closeness/eigenvector/pagerank (node size/color). *Excluded:* scalar metrics with no UI handle (diameter, density, assortativity).
- **Execution / dynamics:** none — operates on static structure; no DAG execution, no live dataflow, no provenance. DAG support is topology-only (ordering, longest path, ancestors). Execution belongs to meshed, not here.
- **Import / export:** GraphML, GEXF (Gephi), GML, Pajek, node-link/adjacency/cytoscape JSON, pandas, SciPy/NumPy adjacency — exactly the formats that feed the candidate renderers and graph DBs, making networkx a natural interchange hub.
- **Best-fit UI surface:** hybrid back-end — its layout module (`spring`/`kamada_kawai`/`spectral`, plus structure-revealing `multipartite_layout` for DAG layering, `bipartite_layout`, `planar_layout`) supplies node-link coordinates, while adjacency/pandas exports feed a matrix-or-table view. It is the computation layer behind whichever renderer is chosen.

**Affordances**
- highlight shortest path between two picked nodes
- highlight longest/critical path in a DAG
- highlight reachable nodes / ancestors / descendants from a node
- expand ego-graph (k-hop neighborhood) around a node; show immediate neighbors
- color nodes by connected (or strongly/weakly connected) component
- layer nodes by topological order
- highlight cycles
- flag articulation points (cut nodes) and bridges (cut edges)
- overlay minimum spanning tree
- color nodes by detected community
- size / color nodes by centrality
- extract selection as subgraph; collapse a node set into a super-node
- merge two graphs (union/compose); diff two graphs
- lay out as bipartite/multipartite (DAG layering)
- switch to adjacency-matrix view
- export to GraphML/GEXF/node-link/cytoscape JSON; import from edge list / adjacency matrix / pandas

---

## Cross-Cutting Synthesis — zodal graph-UI affordances

### How to read this
Twelve subjects span the full spectrum from a small-rich **executable-DAG editor** (meshed) through **provenance ledgers** (nw, lacing) to **large-sparse GPU viz** (cosmograph) and **graph-DB explorers** (graph_dbs). Several are *headless backends* that feed a UI rather than being one (linked, networkx). The synthesis below normalizes ~340 raw affordances into a stable catalog, maps which subject needs each, separates the load-bearing commons from the niche, and translates that into a concrete frontend-tooling shortlist.

The single most important structural finding: **affordances cleave by UI regime, not by subject.** A given subject usually lives in 1–2 regimes, and the affordances cluster tightly around those regimes. That is exactly what zodal wants — it means a *small number* of renderer families, selected by capability, can cover the whole fleet.

---

### 1. Consolidated affordance catalog

Normalized names, grouped by category. Each entry folds together synonymous per-subject affordances.

**A. Structural CRUD (per-element authoring)**
- `add-node` — add/insert a node (incl. "add function node from list", "wrap bare callable", "add step", "add annotation", Arrows draw-node)
- `delete-node`
- `edit-node-label` — rename / edit display label
- `set-node-type` — assign enum/stereotype/label to a node
- `edit-node-properties` — edit arbitrary metadata/property key-values (incl. inline DB property edit, agent persona/schema/tools, annotation body)
- `add-edge` — connect two nodes (untyped)
- `delete-edge`
- `edit-edge-label` / `set-edge-type` — label or retype a relationship
- `reverse-edge-direction`
- `upsert-by-stable-id` — replace-by-id write semantics (nw, lacing)

**B. Typed ports & connection validation (meshed-class)**
- `connect-to-specific-input-port` — out → a named argument/input port
- `rebind-argument-source` — repoint which source feeds an argument
- `validate-connection-by-type` — gate a connection on signature/type/schema/label compatibility
- `swap-node-function-with-check` — replace a node's function with signature compatibility
- `flag-unbound-port` — mark a proposed/unconnected typed port as not-runnable
- `edit-port-defaults-and-types`

**C. Graph-level composition**
- `extract-subgraph` — by inputs↔outputs, BFS-from-root+depth, tier, lineage closure, selection, or query
- `merge-or-compose-graphs` — union/compose two graphs or stores
- `diff-graphs` — added/removed/modified nodes & edges; scene/branch diff
- `collapse-to-super-node` — contract a node set / linear chain / cluster into one node
- `collapse-to-reusable-component` — collapse a sub-DAG into a saved, reusable callable node
- `expand-node-to-subgraph` — inverse of collapse
- `curry-or-partial-graph` — reduce a graph's signature
- `save-scene-or-perspective` — save a working subgraph/view/snapshot as reusable
- `fork-or-clone-graph` — fork a whole graph/project with preserve/reset
- `simplify-graph` — drop isolated nodes, dedupe edges, transitive reduction

**D. Traversal / graph-theory ops with a UI gesture**
- `find-path-between-two-nodes` — shortest/all simple paths between two picked nodes
- `highlight-critical-or-longest-path` — DAG longest/critical path
- `detect-and-highlight-cycles`
- `topological-order` — layered DAG ordering / execution order
- `highlight-ancestors-descendants` — reachability up/downstream of a node
- `highlight-neighbors` — immediate neighbors of a node
- `expand-ego-or-k-hop-neighborhood` — 1-hop / k-hop expansion (incl. expand-on-click in DB explorers)
- `mark-roots-and-leaves` — inputs/outputs of a DAG
- `color-by-connected-component`
- `flag-articulation-or-bridge` — cut nodes / cut edges
- `overlay-minimum-spanning-tree`
- `detect-and-color-communities`
- `run-centrality-to-size-or-color`
- `interval-relation-query` — Allen-relation queries over a time window (lacing-specific traversal analog)

**E. Execution / dynamics**
- `run-graph-on-input` — execute the DAG / pipeline on data
- `run-partial-or-prefix` — execute a prefix / up to a step / stop-after
- `step-through-execution` — node-by-node / stage-by-stage stepping
- `watch-values-flow` — live intermediate-value display as execution proceeds
- `recompute-downstream-on-change` — forward propagation along successors
- `inspect-execution-scope` — read all intermediate values / context snapshot
- `incremental-recompute` — re-run only what changed (content-addressed / stale-after)
- `estimate-cost-and-gate` — cost estimate + budget/approval gate before fan-out
- `human-in-the-loop-approval` — approve/reject/abort a step
- `view-step-status-and-retries` — per-step status, attempts, validation result
- `run-force-simulation` — start/stop/pause/step a layout simulation (viz dynamics)
- `tune-simulation-forces` — live gravity/repulsion/link-spring/friction

**F. Provenance / lineage / history**
- `inspect-node-provenance` — upstream sources of a node
- `highlight-downstream-impacted` — stale/affected set after a change
- `flag-stale-derivatives`
- `view-decision-or-audit-log`
- `follow-derived-from-link`
- `replay-state-at-time` — time-travel over an op-log / version history
- `browse-version-history` — diagram/scene history
- `view-provenance-with-dry-run` — show synthesized fields + where they came from before writing

**G. Navigation / viewport (large-sparse)**
- `pan-viewport`
- `zoom-in-out` / `set-zoom-level`
- `fit-view` — to all or to selected
- `zoom-to-element` — locate/center a node
- `select-by-rectangle` / `select-by-polygon-lasso`
- `drag-node` / `pin-unpin-node`
- `focus-element` — ring a node / widen a link
- `hover-for-details-popup`
- `context-menu-on-element`

**H. Filtering / search / aggregation**
- `filter-by-attribute` — single predicate
- `compound-filter` — AND/OR over nodes & edges
- `filter-by-node-type-or-tier`
- `search-and-locate` — search box / search-by-phrase
- `brush-histogram-or-category` — crossfilter on attribute distributions
- `brush-or-scrub-time` — temporal range brush / timeline scrub / animate
- `style-by-attribute` — color/size/shape/width by node or edge attribute
- `show-legend` — color/size legends
- `cluster-color` — color by cluster/community
- `show-hide-labels` / `manage-labels-at-scale`
- `sample-for-huge-graphs`
- `grey-out-non-selected`

**I. Representation & view-switching ("not-a-graph")**
- `switch-to-table-view`
- `switch-to-matrix-view` — adjacency matrix / relation matrix / heatmap
- `switch-to-node-link-view`
- `switch-to-timeline-view`
- `switch-to-form-or-widget-view` — per-node value-editing form
- `switch-to-point-cloud-view`
- `view-as-pipeline-stepper` — linear named-steps with status
- `pick-graph-representation` — choose edge-list / adjacency / NetworkX / nodes_and_links
- `convert-between-representations` — auto-routed format conversion
- `apply-layout` — hierarchical/force/circular/grid/bipartite/multipartite
- `switch-render-format` — Mermaid/PlantUML/D2/Graphviz

**J. Import / export**
- `import-from-format` — edge list / adjacency / pandas / CSV / annotation files / Python code / diagram-as-code
- `export-to-format` — GraphML/GEXF/node-link/cytoscape JSON / DataFrame / Cypher script / CSV / Python code
- `export-diagram-as-image` — PNG/SVG/screenshot
- `build-knn-graph-from-vectors` — construct graph from embeddings (set k, metric, approx/exact, connectivity)

**K. Graph-DB / query**
- `run-query` — Cypher/Gremlin/SPARQL
- `build-visual-query-pattern` — no-code pattern builder
- `page-and-limit-results`
- `view-schema-meta-graph` — labels & relationship types as their own graph
- `save-query-as-favorite`
- `commit-edits-to-db` — write working-slice edits back to the store

---

### 2. Subject-by-affordance matrix

Columns: **me**=meshed, **ij**=ij, **li**=linked, **da**=dagapp, **aw**=aw, **nw**=nw, **mu**=muvid, **co**=coact, **la**=lacing, **db**=graph_dbs, **cg**=cosmograph, **nx**=networkx. Cells: `✓` supported/needed, `~` partial/implicit, blank = n/a.

| Cluster / Affordance | me | ij | li | da | aw | nw | mu | co | la | db | cg | nx |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **A. Structural CRUD** | | | | | | | | | | | | |
| add-node | ✓ | ✓ | | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ |
| delete-node | ✓ | ✓ | | | | | | | ✓ | ✓ | ~ | ✓ |
| edit-node-label | ✓ | ✓ | | | | | | ✓ | ✓ | ✓ | | ✓ |
| set-node-type | ✓ | ✓ | | | | ✓ | | | ✓ | ✓ | | ✓ |
| edit-node-properties | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ |
| add-edge | ✓ | ✓ | | | ~ | ~ | | | | ✓ | ~ | ✓ |
| delete-edge | ✓ | ✓ | | | | | | | | ✓ | ~ | ✓ |
| edit-edge-label / type | ✓ | ✓ | | | | | | | | ✓ | | ✓ |
| reverse-edge-direction | | ✓ | ✓ | | | | | | | | | |
| upsert-by-stable-id | | | | | | ✓ | ✓ | | ✓ | ✓ | | |
| **B. Typed ports & validation** | | | | | | | | | | | | |
| connect-to-specific-input-port | ✓ | | | | | | | ~ | | | | |
| rebind-argument-source | ✓ | | | | | | | | | | | |
| validate-connection-by-type | ✓ | ~ | | | | | | ~ | ~ | ~ | | |
| swap-node-function-with-check | ✓ | | | | | | | ✓ | | | | |
| flag-unbound-port | | | | | | | | ✓ | | | | |
| edit-port-defaults-and-types | ✓ | | | ✓ | | | ✓ | ✓ | | | | |
| **C. Graph-level composition** | | | | | | | | | | | | |
| extract-subgraph | ✓ | ✓ | | | ~ | ✓ | | | ✓ | ✓ | ✓ | ✓ |
| merge-or-compose-graphs | ✓ | ✓ | ~ | | | | | | ✓ | ✓ | | ✓ |
| diff-graphs | | ✓ | | | | ✓ | | ✓ | ~ | ✓ | | ✓ |
| collapse-to-super-node | ~ | ✓ | | | | | | | | ✓ | ✓ | ✓ |
| collapse-to-reusable-component | ✓ | ~ | | | | | | ✓ | | ✓ | | |
| expand-node-to-subgraph | ✓ | ~ | | | | | | | | ✓ | | |
| curry-or-partial-graph | ✓ | | | | ~ | | | | | | | |
| save-scene-or-perspective | ✓ | | | | | | | | | ✓ | ✓ | |
| fork-or-clone-graph | | ~ | | | | ✓ | | | | | | |
| simplify-graph | | ✓ | | | | | | | | | | |
| **D. Traversal (UI gesture)** | | | | | | | | | | | | |
| find-path-between-two-nodes | ✓ | ✓ | | | | | | | | ✓ | | ✓ |
| highlight-critical-or-longest-path | ~ | ~ | | | | | | | | | | ✓ |
| detect-and-highlight-cycles | ✓ | ✓ | | | | | | | | | | ✓ |
| topological-order | ✓ | ✓ | | ~ | | | | | | ~ | | ✓ |
| highlight-ancestors-descendants | ✓ | ~ | | ~ | | ✓ | | | ~ | | | ✓ |
| highlight-neighbors | ✓ | ~ | | | | | | | | ✓ | ✓ | ✓ |
| expand-ego-or-k-hop | | | | | | | | | | ✓ | ✓ | ✓ |
| mark-roots-and-leaves | ✓ | | | ~ | | | | | | | | |
| color-by-connected-component | | ✓ | ~ | | | | | | | | | ✓ |
| flag-articulation-or-bridge | | ✓ | | | | | | | | | | ✓ |
| overlay-minimum-spanning-tree | | | ~ | | | | | | | | | ✓ |
| detect-and-color-communities | | | | | | | | | | ✓ | ✓ | ✓ |
| run-centrality-to-size-or-color | | | | | | | | | | ✓ | ~ | ✓ |
| interval-relation-query | | | | | | | | | ✓ | | | |
| **E. Execution / dynamics** | | | | | | | | | | | | |
| run-graph-on-input | ✓ | | | ✓ | ✓ | ~ | ✓ | ✓ | | | | |
| run-partial-or-prefix | ~ | | | | ✓ | | ✓ | | | | | |
| step-through-execution | ✓ | | | | ~ | | ✓ | ✓ | | | | |
| watch-values-flow | ✓ | | | ✓ | | | ✓ | | | | | |
| recompute-downstream-on-change | ✓ | | | ✓ | | | | | | | | |
| inspect-execution-scope | ✓ | | | ✓ | ✓ | | ✓ | | | | | |
| incremental-recompute | | | | ~ | | ✓ | ✓ | | | | | |
| estimate-cost-and-gate | | | | | ~ | | ✓ | ✓ | | | | |
| human-in-the-loop-approval | | | | | ✓ | | | ~ | | | | |
| view-step-status-and-retries | | | | | ✓ | | ✓ | | | | | |
| run-force-simulation | | | | | | | | | | ~ | ✓ | |
| tune-simulation-forces | | | | | | | | | | | ✓ | |
| **F. Provenance / history** | | | | | | | | | | | | |
| inspect-node-provenance | ✓ | ~ | | | ✓ | ✓ | ✓ | ✓ | ✓ | | | |
| highlight-downstream-impacted | ~ | | | ~ | | ✓ | | | | | | |
| flag-stale-derivatives | | | | | | ✓ | ✓ | | | | | |
| view-decision-or-audit-log | | | | | ✓ | ✓ | ✓ | | | | | |
| follow-derived-from-link | | | | | | ✓ | | | ✓ | | | |
| replay-state-at-time | | | | | | | | | ✓ | | | |
| browse-version-history | | ✓ | | | | ~ | | | ✓ | ✓ | | |
| view-provenance-with-dry-run | | | | | | | | ✓ | | | | |
| **G. Navigation / viewport** | | | | | | | | | | | | |
| pan-viewport | ~ | ~ | | | | ~ | | | ~ | ✓ | ✓ | |
| zoom / set-zoom | ~ | ~ | | | | | | | | ✓ | ✓ | |
| fit-view | | | | | | | | | | ✓ | ✓ | |
| zoom-to-element | | | | | | | | | | ✓ | ✓ | |
| select-by-rect / lasso | | | | | | | | | ✓ | ✓ | ✓ | |
| drag-node | ~ | ~ | | | | | | | | ~ | ✓ | |
| pin-unpin-node | | | | | | | | | | | ✓ | |
| focus-element | ✓ | | | | | | | | | ✓ | ✓ | |
| hover-for-details-popup | | | | | | | | | ✓ | ✓ | ✓ | |
| context-menu-on-element | | | | | | | | | | ✓ | ✓ | |
| **H. Filtering / search / aggregation** | | | | | | | | | | | | |
| filter-by-attribute | | ✓ | | | | ✓ | | | ✓ | ✓ | ✓ | |
| compound-filter | | ✓ | | | | | | | | ✓ | | |
| filter-by-node-type-or-tier | | ✓ | | | | ✓ | | | ✓ | ✓ | | |
| search-and-locate | | | | | | | | | | ✓ | ✓ | |
| brush-histogram-or-category | | | | | | | | | | ✓ | ✓ | |
| brush-or-scrub-time | | | | | | ~ | ~ | | ~ | ✓ | ✓ | |
| style-by-attribute | | ✓ | | | ✓ | | | | | ✓ | ✓ | ✓ |
| show-legend | | | | | | | | | | ✓ | ✓ | |
| cluster-color | | | | | | | | | | ✓ | ✓ | ✓ |
| show-hide / manage labels | | | | | | | | | ✓ | ✓ | ✓ | |
| sample-for-huge-graphs | | | | | | | | | | ✓ | ✓ | |
| grey-out-non-selected | | | | | | | | | | ✓ | ✓ | |
| **I. Representation & view-switch** | | | | | | | | | | | | |
| switch-to-table-view | ✓ | ✓ | ✓ | ✓ | | ✓ | ✓ | | ✓ | ✓ | ✓ | ✓ |
| switch-to-matrix-view | | | ✓ | | | | | | ~ | | | ✓ |
| switch-to-node-link-view | ✓ | ✓ | ✓ | ✓ | | ✓ | | | | ✓ | ✓ | ✓ |
| switch-to-timeline-view | | | | | | ✓ | | | ✓ | | ✓ | |
| switch-to-form-or-widget-view | ✓ | | | ✓ | | ✓ | ✓ | ✓ | | ✓ | | |
| switch-to-point-cloud-view | | | ~ | | ✓ | | | | | | ✓ | |
| view-as-pipeline-stepper | | | | | ✓ | | ✓ | ✓ | | | | |
| pick-graph-representation | | ~ | ✓ | | | | | | | | | ✓ |
| convert-between-representations | ✓ | ✓ | ✓ | | | | | ✓ | ✓ | | | ✓ |
| apply-layout | ~ | ✓ | | | | | | | | | ✓ | ✓ |
| switch-render-format | | ✓ | | | | | | | | | | |
| **J. Import / export** | | | | | | | | | | | | |
| import-from-format | ✓ | ✓ | ✓ | | | | | | ✓ | | ~ | ✓ |
| export-to-format | ✓ | ✓ | ✓ | | | | | ✓ | ✓ | ✓ | ✓ | ✓ |
| export-diagram-as-image | ✓ | ✓ | | | | | | | | ✓ | ✓ | |
| build-knn-graph-from-vectors | | | ✓ | | ~ | | | | | | ~ | |
| **K. Graph-DB / query** | | | | | | | | | | | | |
| run-query | | | | | | | | | ~ | ✓ | | |
| build-visual-query-pattern | | | | | | | | | | ✓ | | |
| page-and-limit-results | | | | | | | | | | ✓ | | |
| view-schema-meta-graph | | ~ | ✓ | | | | | | | ✓ | | |
| save-query-as-favorite | | | | | | | | | | ✓ | | |
| commit-edits-to-db | | | | | | ✓ | | | ✓ | ✓ | | |

---

### 3. Common patterns vs niche

**The universal spine (needed by almost everyone).**
- `switch-to-table-view` is the single most universal affordance: **12/12 subjects** want it, including the most diagram-centric ones. Every regime has a moment where the table *is* the right surface (graph_dbs and Neo4j Browser literally toggle table↔graph; linked offers the same graph as edge-table, matrix, or diagram). This is the strongest single signal that zodal's existing TanStack-Table backbone must be a first-class graph view, not an afterthought.
- `edit-node-properties` (**11/12**) and `add-node` (**~10/12**) are near-universal — but their *meaning* is regime-dependent: a node-editor gesture in editors (meshed, ij, graph_dbs), a form field in form-first apps (dagapp, coact, nw), a bulk array re-supply in viz (cosmograph). The affordance name is shared; the renderer is not.
- `export-to-format` / `import-from-format` and `convert-between-representations` recur across every backend that touches serialized graphs — this is where a shared **representation/codec layer** (linked- and networkx-style) pays off across all renderers.

**Recurs across regimes (the cross-regime affordances — highest design leverage).**
- `extract-subgraph` shows up in *every* regime: inputs↔outputs (meshed), BFS-from-root (ij), lineage closure (nw), query/expansion scene (graph_dbs), spatial selection (cosmograph), `subgraph()` (networkx). One declarative "scene/selection → subgraph" concept covers all six.
- `find-path-between-two-nodes` spans small-rich editor (meshed, ij) and graph-DB/large-sparse (graph_dbs, networkx). Same gesture ("pick two nodes → highlight path"), four backends.
- `highlight-neighbors` / `expand-ego-or-k-hop` spans editor, DB, and viz — the canonical "click a node, light up its neighborhood" gesture.
- `style-by-attribute`, `filter-by-attribute`, `switch-to-node-link-view` all recur across viz, DB, and editor regimes.
- `collapse-to-super-node` appears in editor (ij linear-chain), DB (Bloom grouping), viz (clusters), and networkx (`quotient_graph`) — but `collapse-to-reusable-component` (the meshed gold-standard round-trip) is *much* rarer.

**Niche / regime-defining affordances (1–3 subjects; these decide which renderer family is even applicable).**
- *Typed ports & connection validation* (cluster B) is essentially **meshed-only**, with weak echoes in coact (bind-tool-to-handler) and schema/label validation in graph_dbs/lacing. `connect-to-specific-input-port`, `rebind-argument-source`, `swap-node-function-with-check` are the defining luxury of the small-rich executable-DAG regime and the hardest thing to source off-the-shelf.
- *Execution dynamics* (cluster E) splits the fleet sharply: meshed/dagapp/muvid/aw/coact are executable; ij/linked/nw/lacing/graph_dbs/cosmograph/networkx are not. Within "executable," there are two sub-flavors: **dataflow value-watching** (meshed, dagapp — watch values flow on the canvas) vs **linear pipeline/agentic stepping** (aw, muvid, coact — stepper UI with status/retries/approval/cost gates). These want *different* UIs.
- *Force-simulation control* (`run-force-simulation`, `tune-simulation-forces`) is cosmograph-only — a property of GPU large-graph renderers, irrelevant elsewhere.
- *Provenance* (cluster F) is the defining axis for nw and lacing (and a strong secondary for aw/muvid/coact). The signature gesture — "mark a node changed → highlight the stale downstream set" — is niche but high-value, and notably it is *read-only over a DAG*, so it reuses the same ancestor/descendant traversal as executable DAGs.
- *Graph-DB/query* (cluster K) is graph_dbs-only (with a SPARQL/Allen echo in lacing). It implies a query editor + result paging + schema meta-graph that no other subject needs.
- *Interval/Allen-relation queries* and *timeline tracks* are lacing/nw-specific — a **timeline editor** regime that is genuinely "not-a-graph."

**Clustering by UI regime (which subjects, which signature affordances):**
- **large-sparse viz** (cosmograph; graph_dbs scene; linked k-NN; networkx layout) — viewport/nav, style-by-attribute, crossfilter, sampling, force sim, neighbor-expand. *Per-element editing rare.*
- **small-rich editor** (meshed, ij; graph_dbs edit-slice) — structural CRUD, typed ports (meshed), layout, path/cycle highlight, image export.
- **table-or-matrix / not-a-graph** (linked, lacing, dagapp form, nw tables) — table/matrix/timeline/form view-switching, representation conversion, value-editing forms.
- **executable-DAG** (meshed, dagapp, muvid, aw, coact) — run/step/watch-values, incremental recompute, cost-gate, status/retry, approval.
- **graph-DB** (graph_dbs) — query, expand-on-click, schema meta-graph, commit-to-store.
- **provenance** (nw, lacing; aw/muvid/coact secondary) — lineage inspect, stale-downstream highlight, audit log, time-travel replay.

---

### 4. Tooling implication

**Which clusters a frontend stack must cover (and with what):**

1. **A table/matrix backbone — non-negotiable.** `switch-to-table-view` is 12/12. zodal's existing **TanStack Table** config is the right home for the table lens, the result-frame lens (graph_dbs paging), the edge-list/adjacency lens (linked, networkx), the per-shot/per-step status tables (muvid, aw), and the synopsis view (meshed). A matrix/heatmap view (adjacency / Allen-relation) is a thin extension. **One backend (TanStack) covers the table needs of all 12 subjects.**

2. **A small-rich node-link *editor* — React Flow as the default.** Covers structural CRUD + layout + path/cycle highlight + collapse/expand for meshed, ij, the graph_dbs edit-slice, and as a render target for networkx's node-link/cytoscape JSON exporters. Critically, **React Flow is the only mainstream lib with first-class typed handles/ports** (`sourceHandle`/`targetHandle` + `isValidConnection`), which is what the meshed gold-standard *requires*; Rete.js is the more specialized dataflow-editor alternative. This one editor family plausibly serves meshed + ij + graph_dbs-editing + networkx-rendered DAGs.

3. **A large-sparse renderer — cosmograph (and/or sigma.js) for the viz regime.** GPU canvas, force-sim control, crossfilter side-panels, neighbor-expand, sampling. cosmograph is itself one of the subjects and already covers k-NN point-clouds (linked) and large query subgraphs (graph_dbs scenes). **sigma.js** is the lighter open alternative when WebGL-cosmograph is overkill; **Cytoscape.js** sits in between (good for medium graphs + built-in graph-theory algorithms, a natural render target for networkx). The viz regime is where ONE tool (cosmograph) most clearly serves several backends: cosmograph, linked, graph_dbs-large, networkx-large all collapse onto it.

4. **A graph-DB explorer surface (query editor + schema panel + expand loop)** is needed by exactly one subject (graph_dbs) but is heavyweight; it is best treated as its own renderer that *reuses* the node-link editor (React Flow/Cytoscape) for the scene and the table backbone for results, adding only a Cypher/Gremlin editor + paging + schema meta-graph.

5. **A pipeline/stepper + form renderer** covers the form-first executable and provenance subjects (dagapp, aw, muvid, coact, nw) without any node-link canvas at all — a named-steps stepper with status/retry/approval/cost badges, plus zodal's existing field/item form renderers for per-node value editing. This is **mostly already in zodal's collection-UI wheelhouse** (forms + state), not a graph problem.

6. **A timeline-track renderer** for lacing/nw (interval tiers, Allen-relation brushing) — a genuinely separate "not-a-graph" surface; off-the-shelf options are thinner here (vis-timeline, custom D3), so flag it as the regime most likely to need bespoke glue.

**The declarative/schema layer is the unifying glue.** The matrix above shows affordances are stable across subjects even when renderers differ — which is exactly the bet zodal makes. A **Zod-described affordance set + a RendererRegistry of ranked renderers keyed on `getCapabilities()`** lets the *same declaration* (e.g. "this collection is a DAG with typed ports, executable, with provenance") pick React Flow when ports+editing are present, fall back to Cytoscape/sigma/cosmograph as scale rises and editing drops, and degrade to TanStack-Table when node-link adds nothing. Provenance and traversal affordances (path/ancestors/descendants/stale-set) are renderer-agnostic *overlays* computed by a networkx-class backend and drawn as highlights on whatever node-link renderer is active — so they need to be modeled once, not per renderer.

**High-level takeaway for the tooling choice.** Cover **five renderer families** and you cover all twelve subjects: (1) **TanStack Table** (universal table/matrix lens), (2) **React Flow** (small-rich editor with typed ports — the meshed-class differentiator), (3) **cosmograph + sigma.js / Cytoscape.js** (large-sparse viz, one tool serving linked/graph_dbs-large/networkx-large), (4) a **stepper+form** renderer built on zodal's existing collection-UI primitives (executable-pipeline + provenance subjects), and (5) a **timeline-track** renderer (lacing/nw). The graph-DB explorer is a *composition* of (1)+(2), not a sixth tool. The two affordances that most constrain tool choice — and therefore deserve the deepest research — are **typed-port connection-with-validation** (only React Flow / Rete do it well) and **renderer-agnostic traversal/provenance overlays** (a networkx-class compute layer feeding highlights into any node-link renderer).

---

## Appendix — Quick Reference

### A. Priority affordances (ranked by recurrence × leverage)

| Affordance | Recurrence | Regimes |
|---|---|---|
| switch-to-table-view (table/matrix lens for graph data) | 12/12 subjects | table-or-matrix / not-a-graph, graph-DB / query explorer, large-sparse viz, small-rich editor, executable-DAG / pipeline dynamics, provenance / lineage / timeline |
| edit-node-properties (per-element metadata/property editing) | 11/12 subjects | small-rich editor (typed ports + execution), table-or-matrix / not-a-graph, graph-DB / query explorer, provenance / lineage / timeline |
| add-node | 10/12 subjects | small-rich editor (typed ports + execution), graph-DB / query explorer, table-or-matrix / not-a-graph |
| extract-subgraph (scene/selection -> subgraph, every extraction mode) | 9/12 subjects | small-rich editor (typed ports + execution), large-sparse viz, graph-DB / query explorer, provenance / lineage / timeline |
| export-to-format / import-from-format (codecs + convert-between-representations) | 9/12 subjects | table-or-matrix / not-a-graph, small-rich editor, graph-DB / query explorer, large-sparse viz |
| inspect-node-provenance / highlight-downstream-impacted (lineage + stale-set overlay) | 8/12 subjects | provenance / lineage / timeline, executable-DAG / pipeline dynamics, small-rich editor |
| switch-to-node-link-view | 8/12 subjects | small-rich editor (typed ports + execution), large-sparse viz, graph-DB / query explorer, provenance / lineage / timeline |
| find-path-between-two-nodes (pick two nodes -> highlight path) | 5/12 subjects (cross-regime) | small-rich editor (typed ports + execution), graph-DB / query explorer, large-sparse viz |
| highlight-neighbors / expand-ego-or-k-hop-neighborhood (click node -> light up neighborhood / expand) | 6/12 subjects | large-sparse viz, graph-DB / query explorer, small-rich editor |
| run-graph-on-input + watch-values-flow / step-through-execution | 5/12 subjects | executable-DAG / pipeline dynamics, small-rich editor (typed ports + execution) |
| style-by-attribute (color/size/shape/width by node or edge attribute) | 6/12 subjects | large-sparse viz, graph-DB / query explorer, small-rich editor |
| connect-to-specific-input-port + validate-connection-by-type (typed-port wiring, meshed gold standard) | 2/12 subjects (niche but tool-deciding) | small-rich editor (typed ports + execution) |
| collapse-to-super-node / collapse-to-reusable-component + expand-node-to-subgraph | 5/12 subjects (collapse) / 2-3 (reusable-component round-trip) | small-rich editor (typed ports + execution), graph-DB / query explorer, large-sparse viz |
| run-force-simulation + tune-simulation-forces | 1-2/12 subjects (regime-defining for viz) | large-sparse viz |
| run-query + view-schema-meta-graph (Cypher/Gremlin/SPARQL explorer) | 1-2/12 subjects (graph-DB only) | graph-DB / query explorer |

### B. Regime clusters → candidate existing tools

The six regimes the synthesis identifies, with the subjects they cover and the modern off-the-shelf tools that plausibly serve each. These ground the deep-research prompts in File 2.

| Regime cluster | Subjects | Candidate tools |
|---|---|---|
| **large-sparse viz** | cosmograph, graph_dbs, linked, networkx | cosmograph, sigma.js, Cytoscape.js, regraph (ReGraph), deck.gl / GraphGL, ngraph |
| **small-rich editor (typed ports + execution)** | meshed, ij, graph_dbs, coact | React Flow (XYFlow), Rete.js, Litegraph.js, Drawflow, baklavajs, Cytoscape.js (edgehandles) |
| **table-or-matrix / not-a-graph** | linked, lacing, dagapp, nw, networkx, graph_dbs | TanStack Table, AG Grid, Glide Data Grid, react-data-grid, regular-table (adjacency/matrix), shadcn form + react-hook-form + Zod |
| **executable-DAG / pipeline dynamics** | meshed, dagapp, muvid, aw, coact | React Flow + execution overlay, Rete.js (dataflow engine), XState / state-machine stepper UI, assistant-ui / agent-run timeline, custom shadcn stepper, Streamlit-style reactive form (current dagapp) |
| **graph-DB / query explorer** | graph_dbs, lacing | Neo4j Browser / NVL (Neo4j Visualization Library), Memgraph Lab / Orb, GraphXR, Cytoscape.js, Arrows.app (pure structural editor), Ogma |
| **provenance / lineage / timeline** | nw, lacing, aw, muvid, coact, ij | read-only React Flow / Cytoscape lineage diagram, vis-timeline (interval tiers), custom D3 timeline tracks, TanStack Table (decision/audit log), git-style diff UI, networkx-class traversal overlay backend |

**Why each regime matters:**

- **large-sparse viz** — Big, sparse graphs where per-element metadata is largely non-displayable: viewport navigation, attribute styling, crossfilter, sampling and force-layout dominate while structural editing is rare. This is the regime where ONE GPU/WebGL renderer can serve several backends (cosmograph point-clouds, graph_dbs large scenes, k-NN graphs, networkx-laid-out large graphs).
- **small-rich editor (typed ports + execution)** — Small graphs whose per-element metadata must be visible AND operable. The defining and hardest-to-source affordance is typed-port connection with type/signature validation (meshed gold standard) plus collapse/expand of a sub-DAG into a reusable component. This is the regime that forces React Flow (typed handles + isValidConnection) or Rete.js over plain node-link viewers.
- **table-or-matrix / not-a-graph** — For much graph data the correct operable surface is a table, adjacency/relation matrix, or per-node form — not a node-link diagram. The same graph is offered as edge-table, matrix, or diagram and the user picks the lens. switch-to-table-view is the single most universal affordance (12/12), so the table backbone is non-negotiable. Value-editing forms (dagapp) and property inspectors live here.
- **executable-DAG / pipeline dynamics** — Whether the graph is a program you run, watch values flow through, and gate on cost/approval. Splits into two sub-UIs: dataflow value-watching ON the canvas (meshed, dagapp) vs linear named-step pipeline steppers with status/retry/approval (aw, muvid, coact). These need different renderers; the second is mostly zodal collection-UI primitives, not a graph canvas.
- **graph-DB / query explorer** — Server-backed live graph explored via query then incremental expand-on-click; the working subgraph is accreted client-side. Needs a query editor (Cypher/Gremlin/SPARQL) + result paging + schema meta-graph panel + commit-to-store writes. This is best built as a COMPOSITION of the table backbone and the node-link editor rather than a sixth standalone tool.
- **provenance / lineage / timeline** — The graph is a read-mostly lineage ledger, not an executable program: select a node to see upstream sources and the downstream-impacted/stale set; replay state over an op-log; diff/fork sibling graphs. Signature gesture (mark changed -> highlight stale downstream) reuses ancestor/descendant traversal, so it is a renderer-agnostic OVERLAY plus a timeline-track surface (interval tiers, Allen relations) that is genuinely not-a-graph.
