# Research Guide — when to read what

**Purpose.** This is a *routing index* for the zodal-graphs design corpus. It tells an
agent (or human) **which document to open for a given task** — and, just as
importantly, which ones to skip — so you never have to read all ~340 KB of research to
make one decision. Each row is `doc → what it settles → read it when`.

> **If you read only one thing:** [`docs/research/README.md`](research/README.md) — the
> index + the consolidated decision table (the "money summary": one chosen tool per
> fleet role, with primary + fallback + license). Start there; come back here to find
> the *deep* doc behind any single decision.

## How the corpus is organized

The work proceeded **concept → affordance analysis → six deep-research prompts →
twelve research reports → reconciliation → decision table**. Three layers:

1. **Design intent** (`docs/*.md`) — what zodal-graphs *is* and which affordances it
   must cover. Stable; rarely changes.
2. **Research reports** (`docs/research/zgraph_NN{a,b}*.md`) — the tool surveys and
   grounded designs, one pair per regime (P1–P6). Consulted per-regime when building.
3. **Consolidation** (`docs/research/README.md`, `_reconciliation.md`,
   `_grounding-brief.md`) — the merged, fleet-wide decisions. The SSOT for "what did we
   decide and why."

`zgraph_NN<a|b>`: **`a`** = Claude-AI deep-research *survey* (broad over the JS/TS
landscape); **`b`** = Claude-Code *grounded* report (pinned to the zodal/meshed/linked/
lacing substrate, primary-source verified). When both exist, **`b` wins on integration,
`a` wins on external facts it surfaced** — but the *reconciled* decision in
`_reconciliation.md` supersedes both.

---

## Tier 1 — Design intent (read once, to orient)

| Doc | What it settles | Read it when |
|---|---|---|
| [`docs/zodal-graph-concept.md`](zodal-graph-concept.md) | The thesis: graph **affordances declared once → mapped to many targets** (UI / storage / graph-DB). The three layers: **Model → Affordances → Targets**. Design commitments (Facade+SSOT, open-closed adapters, declarative, progressive disclosure, don't-reinvent). | You need the *why* / the elevator pitch, or you're deciding whether something belongs in the affordance layer vs. a target adapter. |
| [`docs/graph-affordances-analysis.md`](graph-affordances-analysis.md) | The **affordance catalog** (categories A–K), the **subject × affordance matrix** (12 backends), and the headline finding: *affordances cleave by UI regime, not by subject* → **5 renderer families cover all 12 subjects**. | You're naming/scoping an affordance, deciding which regime a feature lives in, or checking whether a backend (meshed, linked, lacing, graph_dbs, cosmograph, networkx…) needs a given capability. The **matrix** (§2) is the lookup table. |
| [`docs/graph-zodal-deep-research-prompts.md`](graph-zodal-deep-research-prompts.md) | The six research prompts (P1–P6), each mapped to a File-1 regime, with the **priority ordering** and the **coverage check** (prompts × regimes). | You want to know *what question each report was answering*, or you're about to commission new research and want the house format (Vancouver refs, comparison-table + recommendation + risks). |

**Key crosswalk (memorize this):** the six prompts/regimes are
**P1 typed-port editor · P2 traversal+provenance overlay · P3 large-sparse GPU viz ·
P4 declarative facade + canonical data model · P5 table/matrix/form ("not-a-graph") ·
P6 execution/stepper/provenance/timeline.** The two *tool-deciding* affordances are
**typed-port connect-with-validation (P1)** and **renderer-agnostic traversal/provenance
overlays (P2)**.

---

## Tier 2 — Consolidation (the SSOT for decisions)

Read these **before** opening any individual report — they tell you the *final* answer
and point you to the deep doc only if you need the rationale.

| Doc | What it settles | Read it when |
|---|---|---|
| [`research/README.md`](research/README.md) | **The money summary.** Per-fleet-role decision table (primary + fallback + license), the status table, the two genuinely-new modules to build, and the recommended implementation order. | **Always start here.** Any "what tool did we pick for X?" question. |
| [`research/_reconciliation.md`](research/_reconciliation.md) | How every a/b twin disagreement was resolved into one fleet-wide decision; cross-regime architectural commitments (single JSON node-link hub; three physically-separate layers; capability-ranked selection); version pins; build-order rationale. | You hit a conflict between two reports, or you need the *rationale* behind a decision-table entry, or you're tempted to revisit a settled pick. |
| [`research/_grounding-brief.md`](research/_grounding-brief.md) | The **substrate facts** the facade must honor: how zodal works (`defineCollection`, `affordanceRegistry`, `RendererRegistry`, `getCapabilities`), and the real backends it must round-trip — **meshed** (FuncNode/bind/typed ports), **linked** (`nodes_and_links` + 12 representations), **lacing** (intervals/Allen/provenance). | You're designing anything that must stay compatible with the Python backends, or you need to know what `defineGraph` is extending. |

---

## Tier 3 — Per-regime deep dives (open the one you're building)

Open these **only** when implementing that regime and the decision table / reconciliation
didn't give you enough depth. Each "read when" is a build trigger.

### P1 — Typed-port node-link editor  ·  **decision: React Flow (`@xyflow/react`, MIT)**, Rete.js v2 fallback
- [`research/zgraph_01b -- typed-port-editors.md`](<research/zgraph_01b -- typed-port-editors.md>)
- **Read when:** building the small-rich editor; wiring **typed handles + `isValidConnection`**; designing the `portTypeCompatible` Zod-subtyping module; implementing collapse↔expand of a sub-DAG into a reusable component; deciding controlled/serializable `{nodes,edges}` state.
- **Don't read for:** large-graph viz (→ P3), non-editing lineage views (→ P2/P6C).

### P2 — Traversal + provenance overlay  ·  **decision: graphology + graphology-\* (MIT)** in-browser, networkx server tier, ~50-line custom Tarjan
- [`research/zgraph_02b -- traversal-provenance-overlay.md`](<research/zgraph_02b -- traversal-provenance-overlay.md>)
- **Read when:** building the renderer-agnostic compute hub; defining the `GraphOverlays` result shape (`{nodeId/edgeId → role}`); the one reachability primitive (forward/reverse BFS) that powers both descendants/stale **and** ancestors/provenance; the browser-vs-server boundary; the huge-scale columnar-overlay fork.
- **Pairs with:** P6C (this computes overlays; P6C *presents* them — never re-derive traversal in the presentation layer).

### P3 — Large-sparse / GPU renderers  ·  **decision: `@cosmos.gl/graph` (MIT, huge) / sigma+graphology (large) / Cytoscape (medium) / deck.gl (point-cloud)**
- [`research/zgraph_03a -- Large-Sparse Graph & Point-Cloud Renderers for a Declarative TypeScript&React Graph-UI System.md`](<research/zgraph_03a -- Large-Sparse Graph & Point-Cloud Renderers for a Declarative TypeScript&React Graph-UI System.md>)
- **Read when:** building a large-sparse renderer adapter; setting scale thresholds; force-sim control; crossfilter/lasso; the **editor↔viz capability-threshold handoff** (what swaps, what stays when a graph crosses the size/edit boundary).
- **License trap:** `@cosmograph/react` is **CC-BY-NC-4.0** (non-commercial). Use the MIT `@cosmos.gl/graph` engine; isolate any Cosmograph-wrapper decision to a single stage-2 adapter so the rest stays license-clean.

### P4 — Declarative facade + canonical data model  ·  **THE KEYSTONE.** decision: `nodes_and_links` superset hub + typed `ports[]` + ELK-JSON port-aware adapter
- [`research/zgraph_04b -- declarative-facade-and-data-model.md`](<research/zgraph_04b -- declarative-facade-and-data-model.md>) (grounded — primary)
- [`research/zgraph_04a -- A Declarative Facade and Canonical Graph Data Model for a Schema-Driven Graph-UI System.md`](<research/zgraph_04a -- A Declarative Facade and Canonical Graph Data Model for a Schema-Driven Graph-UI System.md>) (survey — external prior art)
- **Read when:** building *anything* in the first checkpoint. This defines the contracts every other regime consumes: `CanonicalGraph`/`GraphNode`/`GraphPort`/`GraphEdge`, the serialized wire shape, the **`GraphCapabilities`** vocabulary, **`RendererCapabilities`**, `GraphOverlays`/`GraphSelection`/`GraphStyling`/`GraphLayout`, `defineGraph`, the adapter contract, and the **Zod-v4 gotchas** (pin ≥4.1.13; `z.toJSONSchema()` representable subset; register-before-wrap).
- **Build gate it dictates:** round-trip a port-rich fixture through every adapter; if any adapter drops port-level edges, the hub's port contract is wrong — **stop and fix before adding more adapters.**

### P5 — Table / matrix / form ("not-a-graph")  ·  **decision: TanStack Table + thin heat-cell matrix; react-hook-form + zodResolver + shadcn forms**
- [`research/zgraph_05b -- table-matrix-form-surfaces.md`](<research/zgraph_05b -- table-matrix-form-surfaces.md>) (grounded — primary)
- [`research/zgraph_05a -- Choosing Components for the NOT-A-GRAPH Surfaces -- Matrix, Form, and View-Switching.md`](<research/zgraph_05a -- Choosing Components for the NOT-A-GRAPH Surfaces -- Matrix, Form, and View-Switching.md>) (survey — the Perspective alternative)
- **Read when:** building the table/edge-list lens, the per-node form lens, the matrix/heatmap, or the **view-switching store extension** (`activeView` + shared selection/filters across lenses).
- **Open decision flagged here:** matrix = **build-thin-on-TanStack** (preserves the cross-lens selection bridge) *vs.* **FINOS Perspective** (off-the-shelf, but forks the data pipeline). The twins disagree — see [§Decisions to confirm](#decisions-still-open) and `_reconciliation.md`.

### P6 — Execution / stepper / provenance / timeline  ·  **decision: React Flow value-watch (A) · TanStack+shadcn+XState stepper (B) · overlay (C) · bespoke `@visx/brush` timeline (D)**
- [`research/zgraph_06b -- execution-stepper-provenance-timeline.md`](<research/zgraph_06b -- execution-stepper-provenance-timeline.md>) (grounded — primary)
- [`research/zgraph_06a -- Renderer & Component Survey for the DYNAMICS and PROVENANCE Surfaces of a Declarative TS&React Graph-UI System.md`](<research/zgraph_06a -- Renderer & Component Survey for the DYNAMICS and PROVENANCE Surfaces of a Declarative TS&React Graph-UI System.md>) (survey)
- **Read when:** building (A) dataflow value-watch on the canvas, (B) the named-step pipeline stepper, (C) provenance/lineage presentation (**gated on P2**), or (D) the ELAN-style **interval-tier timeline + Allen relations** (the single largest bespoke build).
- **Governing constraint:** the **`funcRef` execution boundary** — a TS/browser facade cannot run a Python-backed func node, so it is editor/viewer/overlay only. Pure-TS `funcRef` graphs *may* execute via a minimal engine. (See [§Decisions to confirm](#decisions-still-open).)

---

## Task → doc quick lookup

| If your task is… | Open (in order) |
|---|---|
| "What tool did we pick for X?" | `research/README.md` decision table → the regime's deep doc only if you need rationale |
| Designing the canonical model / `defineGraph` / capabilities | P4b → P4a → `_grounding-brief.md` |
| Wiring typed ports + connection validation | P4b (port model) → P1b (`isValidConnection`) |
| Building the traversal/provenance compute hub | P2b → P4b (`GraphOverlays` shape) |
| Adding a large-graph renderer | P3a → P4b (`RendererCapabilities`, selection rule) |
| Table / matrix / form lens | P5b → P5a (matrix alt) → P4b (`views`, `GraphStyling`) |
| Execution overlay / stepper / timeline | P6b → P6a → P2b (for provenance compute) |
| Resolving a conflict between two reports | `_reconciliation.md` |
| Staying compatible with meshed / linked / lacing | `_grounding-brief.md` → the affordance analysis per-subject section |
| Scoping/naming a new affordance | `graph-affordances-analysis.md` (§1 catalog + §2 matrix) |

---

## Decisions still open

These are flagged across the research as **the user's call**; until resolved, the dev
plan proceeds on the noted default. See [`docs/dev-plan.md`](dev-plan.md) for how each
gates the build.

1. **Executor boundary** — Is the TS facade ever the *executor* of a meshed DAG, or
   editor/viewer/overlay only? *Default:* viewer/overlay for Python-backed (`funcRef`)
   graphs; optional minimal engine for pure-TS graphs. Affects P1 validation + P6A.
2. **Matrix surface** — build-thin-on-TanStack vs. FINOS Perspective. *Default:*
   build-thin-on-TanStack (preserves cross-lens selection). Far-horizon (P5); non-blocking.
3. **`portTypeCompatible` subtyping depth** — how rich the Zod-v4 connect-time rule is.
   *Default:* start conservative (exact base-type match + wildcard), widen later.

---

*Maintenance: when a research-backed decision changes, update `research/README.md`'s
decision table and `_reconciliation.md` first (they are the SSOT), then fix the affected
row here. This guide indexes; it does not duplicate the decisions.*
