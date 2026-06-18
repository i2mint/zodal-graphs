# zodal-graph Research — Index & Decisions

This directory holds the research phase for **zodal-graph**: a declarative, schema-driven, renderer-agnostic graph-UI facade that extends the zodal ecosystem from collections to graphs (node-link, table/matrix, form, dataflow, provenance, timeline). The work spans six regimes (P1–P6), each researched twice — once as a Claude-AI deep-research survey and once as a Claude-Code grounded report pinned to the zodal/meshed/linked/lacing substrate — then reconciled into a single set of fleet-wide decisions. Start with the [grounding brief](<_grounding-brief.md>) for context and the [reconciliation record](<_reconciliation.md>) for the full decision rationale; this README is the entry point and money summary.

## File-naming convention

`zgraph_NN -- <slug>.md`, where `NN` is the regime/prompt number and the suffix letter is the research mode:

- **`a`** = Claude-AI deep-research survey (literature-broad over the JS/TS landscape).
- **`b`** = Claude-Code grounded report (design-deep, pinned to the zodal substrate, adversarially verified against primary sources).
- **`_grounding-brief.md`** and **`_reconciliation.md`** are meta docs (consolidated context and the merged decisions).
- **P1 and P2 are `b`-only** — the survey was done inside Claude Code, so there is no separate `a` twin.
- **P3 is `a`-only** — no grounded twin existed; it was grounded and primary-source verified during the reconciliation pass.
- P4, P5, P6 have both an `a` survey and a `b` grounded report.

## Status table

| Regime | Prompt | Files | How researched | FINAL pick |
|---|---|---|---|---|
| P1 | Typed-port node-link editor | [P1 grounded](<zgraph_01b -- typed-port-editors.md>) | grounded-only (b) | **React Flow / `@xyflow/react`** (MIT); Rete.js v2 fallback |
| P2 | Traversal + provenance overlay | [P2 grounded](<zgraph_02b -- traversal-provenance-overlay.md>) | grounded-only (b) | **graphology + graphology-\*** (MIT) hub + custom Tarjan; networkx server tier |
| P3 | Large-sparse WebGL/GPU renderers | [P3 survey](<zgraph_03a -- Large-Sparse Graph & Point-Cloud Renderers for a Declarative TypeScript&React Graph-UI System.md>) | survey-only, now grounded + verified | **`@cosmos.gl/graph`** (MIT, huge) / **sigma+graphology** (large) / Cytoscape (medium) |
| P4 | Declarative facade + data model | [P4 grounded](<zgraph_04b -- declarative-facade-and-data-model.md>), [P4 survey](<zgraph_04a -- A Declarative Facade and Canonical Graph Data Model for a Schema-Driven Graph-UI System.md>) | both-merged | **linked `nodes_and_links` superset hub** + ELK JSON port-aware adapter |
| P5 | Table / matrix / form surfaces | [P5 grounded](<zgraph_05b -- table-matrix-form-surfaces.md>), [P5 survey](<zgraph_05a -- Choosing Components for the NOT-A-GRAPH Surfaces -- Matrix, Form, and View-Switching.md>) | both-merged | **TanStack Table** + thin heat-cell matrix; **react-hook-form + shadcn** forms |
| P6 | Execution / stepper / provenance / timeline | [P6 grounded](<zgraph_06b -- execution-stepper-provenance-timeline.md>), [P6 survey](<zgraph_06a -- Renderer & Component Survey for the DYNAMICS and PROVENANCE Surfaces of a Declarative TS&React Graph-UI System.md>) | both-merged | React Flow + zodal state (A); TanStack+shadcn+XState stepper (B); overlay (C); **bespoke `@visx/brush` timeline** (D) |

## The consolidated decision table

The money summary — chosen tool per fleet role, with primary + fallback + license, drawn from the final recommendations across all six regimes.

| Fleet role | Primary | Fallback / alternate | License |
|---|---|---|---|
| Node-link editor (typed ports) | **React Flow / `@xyflow/react`** (12.11.0) | Rete.js v2 (executable-dataflow branch only) | MIT / MIT |
| Large-sparse / GPU viz | **`@cosmos.gl/graph`** (v3, huge) — optionally via `@sqlrooms/cosmos` | sigma.js + graphology (large); Cytoscape.js (medium); deck.gl (point-cloud) | MIT / MIT / MIT / MIT. (`@cosmograph/react` CC-BY-NC-4.0 — opt-in, non-commercial only) |
| Graph-algorithm compute | **graphology + graphology-\*** in-browser + ~50-line custom Tarjan | networkx (Python, server tier); ngraph.path (fast pathfinding only) | MIT / BSD-3 / MIT |
| Table | **TanStack Table** + TanStack Virtual | Glide Data Grid (canvas, billion-cell ceiling) | MIT / MIT. (Avoid AG Grid Enterprise — commercial) |
| Matrix viewer | **Thin heat-cell renderer ON TanStack Table** (build) + seriation module | FINOS Perspective (optional standalone heatmap pane only) | (own) / Apache-2.0 |
| Per-node forms | **react-hook-form + @hookform/resolvers `zodResolver` + shadcn Form** | vantezzen AutoForm (accelerator only) | MIT / MIT |
| Dataflow-on-canvas | **React Flow** (renderer) + execution in zodal state layer | Rete.js DataflowEngine (pure-TS funcRef case only) | MIT / MIT |
| Pipeline stepper | **TanStack Table backbone + shadcn/Radix stepper (Dice UI / ReUI) + XState (orchestration only)** | assistant-ui (conversational LLM agent loops only) | MIT / MIT |
| Interval timeline | **Bespoke renderer: `@visx/brush` + `@thi.ng/intervals` + `@flatten-js/interval-tree`** (build) | vis-timeline (fast-start prototype only); waveform-playlist / wavesurfer.js (audio sub-case) | MIT / Apache-2.0 / MIT. (Avoid peaks.js LGPL-3.0) |
| Canonical data model | **linked `nodes_and_links` superset** (bipartite kind + typed `ports[]` + `sourcePort`/`targetPort`) | graphology `SerializedGraph` (first-class near-identity adapter); ELK JSON (port-aware interchange); GraphML (XML archival) | — |

## Genuinely-new modules to build

The facade's guiding principle is **wrap, don't rebuild** — it renders nothing and runs no layout engine; almost everything above is reuse/wrap of best-of-breed libraries. Only two pieces have no off-the-shelf precedent and must be built from scratch:

1. **`portTypeCompatible` — the Zod-v4 subtyping rule.** No serialization format and no library defines connect-time *type validity* (carrying *which* port an edge binds to is solved via `targetPort`; deciding *whether* a connection is type-valid is not). This is the predicate the facade generates from Zod port types and feeds to React Flow's `isValidConnection`. It must define a subtyping relation over Zod v4 types (e.g. is `z.number()` connectable into `z.number().min(0)`? into a union? into `z.string()`?). Until specified, keep it conservative (exact base-type match + wildcard) rather than claim full structural subtyping. (P1 §4.3 / P4 Risk #2.)
2. **The bespoke interval-timeline renderer.** Web-verified across P6: no maintained JS/TS library renders ELAN/Praat-style multi-tier interval annotations with Allen-relation queries, and no JS/TS package implements the 13 Allen relations natively. Build it on `@visx/brush` (over `scaleTime × scaleBand`), with interval math backed by `@thi.ng/intervals` (half-open boundaries) and large-dataset indexing by `@flatten-js/interval-tree`. Must honor rational `{v,r}` time at the model layer, half-open `[start,end)` incl. zero-measure points, the five ELAN tier stereotypes + parent linkage, Allen-relation brushing, and lacing Annotation binding (`NodeRef.scene_path`). The Allen-relation layer itself is hand-written glue.

Two smaller build items support these but are bounded glue, not new modules: a ~50-line custom **Tarjan** pass (articulation/bridge — P2) and a **seriation** module (optimal-leaf / Cuthill–McKee for matrix cluster reveal — P5).

## What's next

**Implementation order — P4 unblocks everything.** The canonical data model (P4) is the keystone: the `nodes_and_links` superset hub, the typed/kinded `ports[]` block, the `GraphCapabilities` vocabulary, the `GraphOverlays` shape, and the `RendererRegistry` testers are the contracts every other regime consumes. Build P4 first.

Suggested sequence:

1. **P4 — canonical model + capabilities + serializer/adapters** (incl. ELK JSON and the first-class graphology adapter). Pin Zod ≥4.1.13 if `z.toJSONSchema()` is emitted. Confirm the `funcRef` execution boundary (editor/viewer vs executor) and the `executable`-in-browser-vs-via-backend split — these gate P1's validation and P6's (A).
2. **P1 — typed-port editor** (React Flow) + the `portTypeCompatible` module. Depends on P4's port model + `GraphCapabilities`.
3. **P2 — traversal/provenance compute hub** (graphology + Tarjan + server boundary). Emits P4's `GraphOverlays`. Resolve the huge-scale overlay-shipping fork (columnar/typed-array projection) before claiming huge `scaleClass`.
4. **P3 — large-sparse renderers** (cosmos.gl / sigma / Cytoscape / deck.gl adapters). Consume P4's data model + P2's overlays unchanged; encode the cosmos read-only / 250k-link constraints in the selection testers.
5. **P5 — table/matrix/form lenses** (reuse `zodal-ui-shadcn` + `@zodal/ui`; build the thin heat-cell matrix + seriation). Add react-hook-form + @hookform/resolvers to `zodal-ui-shadcn`.
6. **P6 — dynamics & provenance surfaces**: (A) dataflow value-watch and (B) stepper can proceed in parallel; **(C) provenance presentation has a hard dependency on P2's traversal backend**; **(D) the bespoke interval timeline** is the largest standalone build and can start anytime since it shares only the lacing model.
