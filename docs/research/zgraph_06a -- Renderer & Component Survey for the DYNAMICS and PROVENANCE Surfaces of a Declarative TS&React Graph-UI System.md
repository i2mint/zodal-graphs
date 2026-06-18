# Renderer & Component Survey for the DYNAMICS and PROVENANCE Surfaces of a Declarative TS/React Graph-UI System

**Author: Thor Whalen**
**Date: June 18, 2026**

## TL;DR

- **Reuse your node-link canvas for three of the four needs.** Dataflow value-watching (A) and provenance/lineage + time-travel (C) are both overlay problems on a graph you already render — drive React Flow (`@xyflow/react`, MIT) from a headless reactive engine (Observable runtime or Rete.js `DataflowEngine`) for (A), and from a read-mostly op-log/lineage store for (C). The agentic stepper (B) should reuse your **table backbone plus a headless shadcn/Radix stepper**, with XState as the optional schema-driven state core.
- **The timeline-track surface (D) is the one genuine bespoke-glue case.** No maintained JS/TS library renders ELAN/Praat-style multi-tier interval annotations with Allen-relation queries. Use `vis-timeline` for a fast start, but expect to build a custom D3/visx (`@visx/brush`) track renderer for many tiers + half-open intervals, backed by `@thi.ng/intervals` or `@flatten-js/interval-tree` for the interval math.
- **Bias toward headless engines + your own renderers, not standalone apps.** Marquez, LangSmith, Temporal/Inngest/Trigger.dev dashboards and the Stately Visualizer are full applications — mine them for UX conventions, but don't adopt them as embeddable components. The reusable, schema-friendly primitives are: React Flow, Rete.js engine, `@observablehq/runtime`, XState, shadcn/Radix steppers, TanStack Table, and the interval/timeline libraries.

---

## Key Findings

1. **A value/execution overlay on a node-link renderer is a solved pattern.** React Flow ships a first-party "Computing Flows" guide and a `DataEdge` UI component that renders a value from the source node's data; the recompute loop is `useNodesData` + `updateNodeData`. For real incremental/reactive recompute you layer a headless engine underneath: Rete.js `DataflowEngine` (pull-based `fetch` with per-node caching and `reset(id)` for downstream invalidation) or `@observablehq/runtime` (spreadsheet-style dirty propagation, computes only observed variables). Keep React Flow as the *view*; keep the DAG/recompute in the engine.

2. **For agentic steppers, "full app vs embeddable component" is the key axis.** assistant-ui (MIT, TS/React, Radix-style composable primitives, shadcn/Tailwind, human-in-the-loop approvals) is genuinely embeddable but chat-shaped. XState (MIT) is the right schema-driven core for status/retry/approval/abort as explicit states; its Stately Visualizer and `@xstate/inspect` are dev tools, not production widgets. Temporal/Prefect/Dagster/Airflow/Inngest/Trigger.dev run views are dashboards of full orchestration platforms — reuse their *conventions* (step list, per-step status/timing/cost, replay), not their UIs. The embeddable answer is a headless shadcn/Radix stepper over your table backbone.

3. **Lineage + time-travel is a presentation overlay on the same canvas.** OpenLineage/Marquez, DataHub, dbt docs DAG, and dbt "lineage diff" tools all converge on the same conventions: upstream-left/downstream-right DAG, node selection focuses immediate parents/children, and a *changed/impacted/stale* set is highlighted with color/badges (dbt's `modified+` selector, PipeRider/Recce "impacted nodes" coloring). Time-travel is the Redux DevTools / event-sourcing pattern: an op-log you replay deterministically. All of this can ride on your existing node-link renderer in a read-mostly mode.

4. **The timeline-track surface has no turnkey winner.** `vis-timeline` (Apache-2.0/MIT dual) is the most capable maintained option for stacked groups/tiers with brushing, but it is vis.js-DOM, has awkward React 18+ integration, and is not headless. `react-calendar-timeline` does endless-scroll groups well but is calendar/scheduling-shaped. Audio-tier libraries (wavesurfer.js, peaks.js, waveform-playlist) cover *audio* region tiers but not generic annotation tiers. OpenTimelineIO has no official JS/TS package — only WASM viewers (Raven). Allen interval algebra has no maintained 13-relation JS package; you compose it from `@thi.ng/intervals` (half-open intervals + classification) or an interval tree.

---

## Details

Evaluation criteria applied to every candidate: maintained & modern (active releases, TS-native/strong types, React-compatible, ESM); license (permissive preferred, GPL/AGPL/commercial flagged); headless/config-driven & Zod-schema-friendly; extensibility (custom overlays/renderers/plugins); clean composition with a node-link editor and a table backbone.

A note for the Python architect reading this: think of each "need" as a **facade over a headless engine**. The renderer is a pluggable view; the engine (recompute, state machine, op-log, interval store) is your single source of truth, ideally described by a Zod schema and held in a zustand store with immer updates. The recommendations below consistently favor *separating the logic SSOT from the rendering*, which is exactly the headless pattern React Flow, Rete.js, XState and TanStack Table are built around.

### (A) Dataflow value-watching on a canvas

**Survey.** The cleanest architecture is a **headless reactive DAG engine + a thin value overlay on your node-link renderer**. React Flow itself does not compute anything — its docs are explicit that data normally lives outside the library — but it provides the exact hooks to surface values: `useNodesData`, `useNodeConnections`, and `updateNodeData`, plus a `DataEdge` component that displays one field from the source node's data on the edge. That gives you "show each node's current value" almost for free; the missing piece is *incremental recompute*.

Three engine families provide that:

- **Rete.js `rete-engine`** is TypeScript-first and offers both a `DataflowEngine` (pull-based: `engine.fetch(nodeId)` traverses predecessors, caches output per node, `engine.reset(id)` invalidates a node so only downstream recomputes) and a `ControlFlowEngine` (UE4-Blueprints-style `execute`/`forward` for step-by-step control). The two can be combined (e.g. `exec` ports for control, data ports for values). This is the closest match to "set inputs, run, step node-by-node, recompute only downstream."
- **`@observablehq/runtime`** (ISC license — permissive) is the reactive dataflow runtime behind Observable notebooks: variables form a dependency graph, recompute is spreadsheet-style and demand-driven (a variable is only computed if a transitive output is observed). The npm package is at **v6.0.0 (released November 6, 2024)**, with the source repo still receiving commits in 2026. It is renderer-agnostic — you'd map its variables to your node-link nodes and use its dirty propagation as the recompute core.
- **Node-editor toolkits with built-in engines:** Rete.js (above), Baklava.js (TS-native, Vue-rendered, `@baklavajs/engine`), Flume (React, JSON-graph, MIT) and LiteGraph.js (original `jagenjo/litegraph.js` has a classic `basic/watch` node and `graph.runStep()` per-node `onExecute`; the Comfy-Org fork was archived and folded into the ComfyUI frontend monorepo in August 2025). These bundle the engine *and* a renderer; for your purposes they are mainly references, since you already have a node-link backbone.

**How live values + downstream recompute are typically shown:** a per-node value badge/inspector (LiteGraph's "watch" node, ComfyUI's value passing), value-on-edge labels (React Flow `DataEdge`), and a "dirty/stale" visual state on nodes pending recompute (mirrors the lineage convention in C). The overlay is a custom node/edge renderer reading from the engine's current values, plus a thin "run/step" controller.

| Candidate | Maintenance | License | TS/React fit | Headless/schema fit | Extensibility | Notes |
|---|---|---|---|---|---|---|
| React Flow (`@xyflow/react`) | Actively maintained by xyflow (Berlin); v12 line | MIT | Excellent — TS-native, React-first | View-only; pairs with external engine | Custom nodes/edges, `DataEdge`, hooks | Your likely renderer SSOT for (A); no compute of its own |
| Rete.js (`rete` + `rete-engine`) | Active; TS-first framework | MIT | Strong TS; React via `rete-react-plugin` | Headless engine separable from render | Plugin system, dataflow+control flow | Best match for incremental downstream recompute |
| `@observablehq/runtime` | v6.0.0 (Nov 6, 2024); repo active into 2026 | ISC | TS types; framework-agnostic | Fully headless reactive core | Builtins, modules, custom observers | Spreadsheet-style demand-driven recompute |
| Baklava.js | Maintained (newcat) | MIT (BSD-style) | TS-native; Vue renderer | Engine separable; schema-ish node defs | Plugin system | Vue rendering is a mismatch for React stack |
| Flume | Low recent activity | MIT | React; TS types partial | JSON-graph config-driven | Port/node type config | Nice declarative config; check maintenance |
| LiteGraph.js | Original archived/folded into ComfyUI frontend (Aug 2025) | MIT | JS-first; types incomplete | Engine + canvas bundled | Node registration, live mode | Reference for value-watch UX; canvas2D |

**Primary recommendation:** Keep **React Flow as the renderer** and drive it from **Rete.js `DataflowEngine`** (or a thin engine of your own modeled on it) as the headless recompute SSOT. This cleanly separates view from computation, supports step-by-step and downstream-only recompute, and is fully MIT/TS.
**Fallback:** **`@observablehq/runtime`** as the recompute core if you prefer spreadsheet-style reactive semantics over an explicit pull engine, still rendering through React Flow.

### (B) Linear pipeline / agentic steppers

**Survey.** This need splits cleanly into *state logic* and *presentation*, and the right answer is to keep them separate.

- **State logic (schema-driven core):** **XState** (MIT, 29.7k GitHub stars, latest release `xstate@5.31.1` on May 10, 2026, TS-first) models each step's status, retries/attempts, validation gates, cost/budget gates and human-in-the-loop approve/reject/abort as explicit states and transitions. This is the most "Zod/SSOT/plugin"-aligned choice: the machine *is* the declarative config. The Stately Visualizer and `@xstate/inspect` are excellent dev/inspection tools but are not production UI components.
- **Embeddable agent-UI components:** **assistant-ui** (MIT, TS/React, Y-Combinator-backed) is the standout — Radix-style composable primitives (Thread, Message, Composer, ActionBar), built on shadcn/ui + Tailwind, with generative UI, tool-call rendering and **inline human approvals**. It integrates with Vercel AI SDK and LangGraph runtimes. As of January 2026 it reported roughly 50,000 monthly npm downloads and over 7,900 GitHub stars. Caveat: it is chat/assistant-shaped; for a named-step pipeline you'd use its primitives unconventionally.
- **Steppers (the embeddable presentation layer):** there is no official stepper in base shadcn/ui, but several copy-and-own shadcn/Radix steppers exist (Dice UI `@diceui/stepper`, ReUI, shadcn-expansions Interactive Stepper, Creative Tim) with pending/active/loading/completed/error states, orientation variants, per-step validation (`onValidate`), and React Hook Form integration. MUI Stepper and Radix primitives are alternatives. These are headless-ish and Tailwind-styled — exactly your stack.
- **Workflow-run dashboards (reference only, not embeddable):** LangSmith (agent trace timeline, run tree), Temporal UI, Prefect, Dagster, Airflow, Inngest and Trigger.dev run views all render named-step pipelines with per-step status, timing, token/cost, retries and replay. Inngest and Trigger.dev in particular show the step-level model (each `step.run` is a durable, retriable unit with input/output/timing/cost in the dashboard) that matches your requirements — but they are platform dashboards, not components you embed.

| Candidate | Maintenance | License | TS/React fit | Headless/schema fit | Extensibility | Notes |
|---|---|---|---|---|---|---|
| XState (`xstate`) | Very active; 29.7k stars; v5.31.1 (May 2026) | MIT | Excellent TS; `@xstate/react` | Machine = declarative SSOT | Actors, guards, plugins, inspect | Best status/retry/approval/abort core |
| assistant-ui | Active (YC-backed); ~50k monthly downloads, 7.9k stars (Jan 2026) | MIT | Excellent TS/React | Composable primitives; runtime-agnostic | Custom renderers, tool UI, approvals | Embeddable but chat-shaped |
| shadcn/Radix steppers (Dice UI, ReUI, etc.) | Active community | MIT | TS/React; Tailwind | Copy-own, config-driven, RHF/Zod-friendly | Fully customizable (you own source) | Best embeddable presentation layer |
| MUI Stepper | Active | MIT | TS/React | Component-driven (less headless) | Theming | Heavier; off your shadcn stack |
| LangSmith trace viewer | Active (LangChain) | Commercial/SaaS | N/A (hosted) | No | No | Reference UX only; not embeddable |
| Temporal/Prefect/Dagster/Airflow UIs | Active platforms | Apache-2.0 (apps) | N/A (full apps) | No | Plugins within platform | Reference conventions only |
| Inngest / Trigger.dev run views | Active | Trigger.dev Apache-2.0; Inngest proprietary cloud | N/A (dashboards) | No | No | Step/retry/cost model worth copying |

**Primary recommendation:** **XState (logic SSOT) + a shadcn/Radix headless stepper rendered over your table backbone (presentation).** The state machine carries status/attempts/validation/cost/approval as a Zod-describable config; the table backbone naturally shows per-step rows with status, retries, cost and budget columns; the stepper provides the linear progress affordance and approve/reject/abort controls.
**Fallback:** **assistant-ui** if the pipeline is genuinely agent/LLM-conversational and you want human-in-the-loop approvals and tool-call rendering out of the box.

### (C) Provenance / lineage + time-travel

**Survey.** This is explicitly a *presentation* problem coordinated with a renderer-agnostic overlay engine — not a recompute engine. Two sub-capabilities:

- **Lineage / impact overlay.** The mature reference implementations all use the same visual grammar: **OpenLineage + Marquez** (LF AI & Data; reference UI renders job/dataset dependency DAGs with run history), **DataHub/Amundsen** lineage UIs, and **dbt docs** (AngularJS + graphlib DAG; vertical "mini-map" shows a node's immediate parents/children, horizontal view shows full lineage, `--select`/`--exclude` filter the graph). The "stale downstream after a change" overlay is the **impact-analysis** pattern: dbt's `modified+` selector and tools like PipeRider/Recce "lineage diff" highlight the *added + impacted/stale* nodes with distinct coloring/badges on the same DAG, comparing two states (e.g., PR branch vs main). Build-graph tools (Bazel/Buck `query`/`rdeps`) express the same upstream/downstream + dirty-set idea textually.
- **Time-travel.** The canonical web pattern is **Redux DevTools**: every action is recorded, state is replayed by re-applying the action log from the initial state, and you can jump/skip/reorder actions (jump, skip, reorder, dispatch, import/export are configurable features). This is event sourcing — an **op-log you replay deterministically** — which maps directly onto "browse version history, replay state over an op-log, diff/fork." Replay.io generalizes this to full time-travel debugging.

**Reusing the node-link editor for lineage.** Yes — strongly recommended. Lineage is a read-mostly DAG, which is exactly what your node-link renderer already draws. Put React Flow into a non-editable mode (disable connect/drag), add a custom overlay that color/badges nodes by lineage role (selected, upstream source, downstream-impacted, stale/dirty), and drive selection-focuses-neighborhood from your lineage store. The op-log/version history is a separate timeline control (which can reuse surface D or a simple slider) that sets the "current revision" the overlay reads from. There exist concrete precedents for React-rendered lineage on a node graph (e.g., a community LineageViewer using Cytoscape.js against Marquez), confirming the overlay-on-graph approach is well-trodden.

| Candidate / pattern | Maintenance | License | TS/React fit | Headless/schema fit | Extensibility | Notes |
|---|---|---|---|---|---|---|
| React Flow read-mostly + overlay | Active | MIT | Excellent | Overlay reads from lineage store | Custom node/edge styling, badges | **Reuse target** for lineage view |
| OpenLineage / Marquez | Active (LF AI & Data) | Apache-2.0 | Java/React app | Standard lineage *model* (Job/Run/Dataset) | API/integrations | Reference UX + a lineage event schema to mirror |
| dbt docs DAG | Active (dbt Labs) | Apache-2.0 | AngularJS app | DAG via graphlib | Selectors (`modified+`) | Canonical impact/stale conventions |
| DataHub / Amundsen lineage | Active | Apache-2.0 | Full apps | Metadata model | Plugins | Enterprise lineage UX references |
| Redux DevTools / event-sourcing | Active | MIT | TS/React | Op-log replay = SSOT | jump/skip/reorder/import/export | Time-travel pattern to implement, not embed |
| Replay.io | Active | Commercial | N/A | No | No | Reference for full time-travel debugging |

**Primary recommendation:** **Reuse the node-link canvas in a read-mostly mode with a renderer-agnostic lineage overlay** (color/badge dirty-set + selection-focuses-neighborhood), backed by an **event-sourced op-log** (Redux-DevTools-style replay) for version history/time-travel/diff/fork. Mirror the OpenLineage Job/Run/Dataset model in your Zod schema so the overlay is schema-driven.
**Fallback:** If you need column-level or cross-system lineage at enterprise scale beyond what your own overlay covers, integrate **Marquez** as a backend lineage store and still render through your own React Flow overlay rather than adopting the Marquez UI wholesale.

### (D) Timeline-track surface

**Survey.** This is the genuinely non-node-link surface and the likeliest bespoke-glue case. Requirements: many interval "tiers"/tracks over a time axis (Praat/ELAN-style), range brushing, half-open intervals, and Allen interval-relation queries, with good performance and clean React/TS integration. No single library satisfies all of these.

- **`vis-timeline` (vis.js):** the most capable maintained general timeline. Supports `groups` (stacked tiers), items as point or *range* (start/end) intervals, drag/zoom/select with a `rangechange` event for brushing, and millisecond-to-year scales. Weaknesses: it renders via vis.js DOM (not headless, not TS-native — community React wrappers like `react-vis-timeline` exist but React 18+ template rendering is awkward since `ReactDOM.render` is deprecated). Good for *many tiers*; intervals are inclusive by default (half-open is your convention to enforce).
- **`react-calendar-timeline`:** modern React, endless-scroll canvas, groups = rows/tiers, `onTimeChange`/selection handlers, prop-getter extensibility. Calendar/scheduling-shaped and Moment/dayjs-oriented; works for tiers but less neutral than vis-timeline.
- **`react-chrono`:** MIT, TS, zero-dependency, healthy maintenance (v3.3.3, 16,086 weekly npm downloads). But it is a *storytelling* timeline (horizontal/vertical/alternating event cards), **not** an interval-tier/track surface — wrong tool for Allen-interval work.
- **Gantt libraries:** `gantt-task-react`/`react-gantt-task`, `frappe-gantt` (MIT, lightweight, dependency-typed bars), `dhtmlx-gantt` (GPLv2 free edition / commercial PRO — flag licensing), Syncfusion (commercial), Bryntum (commercial), `wx-react-gantt`. These render tasks-as-intervals across rows and support dependencies, but they are project-scheduling-shaped (work calendars, dependencies, drag-reschedule) and heavyweight for annotation tiers.
- **D3 / visx (bespoke):** `@visx/brush` over `scaleTime` + `scaleBand` gives a clean React/TS brushable interval-tier chart in ~100 lines, with full control over half-open semantics, many tiers, and custom overlays. This is where bespoke D3 becomes *unavoidable but cheap* for a precise annotation-tier surface.
- **Audio-tier libraries (from focused research):** **wavesurfer.js** (BSD-3-Clause, full TS rewrite in v7, very active — v7.12.8 published ~mid-June 2026, with an official `@wavesurfer/react` v1.0.12 wrapper; Regions plugin gives draggable segment overlays + `dragSelection` brushing, but a single instance = one tier); **peaks.js** (BBC R&D; **LGPL-3.0 — flag copyleft**; TS `.d.ts` bundled; segment/point markers but not arbitrary tiers); **waveform-playlist** (MIT; new React+Tone.js rewrite split into `@waveform-playlist/*` scoped packages with full TS types and a dedicated `@waveform-playlist/annotations` package — the closest thing to *genuine stacked multi-track + annotations*, but audio-DAW oriented).
- **OpenTimelineIO / otio:** core is **Apache-2.0** (Academy Software Foundation) but **Python/C++ only — no official JS/TS/npm package**. In-browser viewing is WASM-only: the official **Raven** viewer (Emscripten/ImGui canvas, not a React component) or the community **otio-wasm** (Pyodide, experimental). Not a usable React timeline component.
- **Annotation timelines / ELAN-Praat:** **no maintained JS/TS multi-tier annotation timeline component exists.** Praat (C) and ELAN (Java) are desktop; TextGrid/EAF parsing lives mainly in Python (`tgt`). This confirms the bespoke-glue verdict.
- **Allen interval algebra & interval math:** **no maintained 13-relation Allen-algebra JS/TS package.** Compose it from **`@thi.ng/intervals`** (Apache-2.0, TS-native, supports half-open/semi-open intervals plus classification like `isBefore`/`isAfter`/`classify`) or an interval tree — **`@flatten-js/interval-tree`** (MIT, TS, best-maintained: v2.0.3 published ~December 2025, ~125,480 weekly downloads), `node-interval-tree` (MIT, TS), or `intervaltree` (hexsprite, TS, explicit half-open `[start,end)`). The 13 named relations are a small, well-specified layer you implement yourself on top.

| Candidate | Maintenance | License | TS/React fit | Headless/schema fit | Extensibility | Notes |
|---|---|---|---|---|---|---|
| `vis-timeline` | Active (visjs) | Apache-2.0 / MIT (dual) | DOM-based; community React wrappers; types ok | Not headless; config object | Templates, events, custom CSS | Most capable many-tier option; React 18 friction |
| `react-calendar-timeline` | Active (namespace-ee) | MIT | React; TS types | Prop-getter config | Custom renderers | Scheduling-shaped tiers |
| `react-chrono` | Healthy (v3.3.3; 16k weekly dl) | MIT | Excellent TS/React, zero-dep | Item config | Custom card components | Event storytelling, **not** interval tiers |
| `frappe-gantt` | Active | MIT | JS; community React wrappers | Config object | Views, dependency types | Lightweight; project-shaped |
| `dhtmlx-gantt` | Active | GPLv2 (free) / commercial | React wrapper, TS | Config | Rich API | **Flag GPL/commercial** |
| visx (`@visx/brush`) + D3 | Active (Airbnb) | MIT | Excellent TS/React | Fully headless primitives | Total control | Bespoke but precise; brushing built-in |
| wavesurfer.js | Very active (v7.12.8, Jun 2026) | BSD-3-Clause | TS rewrite; `@wavesurfer/react` v1.0.12 | Plugin config | Regions/Timeline plugins | One tier per instance; audio-focused |
| peaks.js | Active (BBC R&D) | **LGPL-3.0** | TS `.d.ts`; Konva dep | Config | Segment/point markers | Copyleft — flag for commercial |
| waveform-playlist | Active (React/Tone.js rewrite) | MIT | New TS packages | Scoped `@waveform-playlist/*` | Annotations package, tracks | True stacked tracks; audio-DAW shaped |
| OpenTimelineIO (otio) | Active (ASWF) | Apache-2.0 | **No JS/TS pkg** (WASM only) | N/A | Raven WASM viewer | Not a React component |
| `@thi.ng/intervals` | Very active (umbrella) | Apache-2.0 | Excellent TS | Functional, half-open intervals | Set ops, classification | Interval math SSOT for Allen relations |
| `@flatten-js/interval-tree` | Active (v2.0.3, ~Dec 2025; ~125k weekly dl) | MIT | TS generics | Tree API | Custom Interval subclasses | Best-maintained interval tree |

**Primary recommendation:** **Bespoke D3/visx track renderer** (`@visx/brush` over `scaleTime`×`scaleBand`) for the interval-tier surface, with **`@thi.ng/intervals`** (or `@flatten-js/interval-tree` for large datasets) as the half-open interval + Allen-relation engine, and a thin Zod schema describing tiers and intervals. This is the only path that cleanly meets many-tier + half-open + Allen + clean React/TS.
**Fallback:** **`vis-timeline`** for a fast initial implementation (real stacked groups + range brushing out of the box), accepting the React-18 integration friction and adding the Allen-relation layer separately; migrate to the bespoke renderer if tier count/performance or half-open semantics become limiting.

---

## Reuse vs Dedicated

**Reuse the node-link editor (React Flow) — needs (A) and (C).**
Both are overlay problems on a DAG you already render. (A) adds a *value/execution* overlay (per-node value badges, value-on-edge, run/step controller) driven by a headless recompute engine. (C) adds a *read-mostly lineage/impact* overlay (dirty-set coloring/badges, selection-focuses-neighborhood) driven by an event-sourced op-log. In both cases React Flow stays the view SSOT and the engine/store holds the truth — the textbook headless/facade split.

**Reuse the table backbone (+ a stepper) — need (B).**
A named-step pipeline is naturally a table: one row per step with columns for status, attempts/retries, validation result, cost estimate and budget gate, plus an actions cell for approve/reject/abort. Add a headless shadcn/Radix stepper for the linear progress affordance, and use XState as the schema-driven state core. No standalone workflow app needed.

**Dedicated renderer — need (D), the bespoke-glue case.**
The timeline-track surface cannot reuse either backbone: it is neither a node-link graph nor a table, and no maintained library covers many ELAN/Praat-style tiers + half-open intervals + Allen-relation queries. This is the one place to build a dedicated D3/visx renderer, isolated behind a clean component facade and a Zod-described tier/interval schema so the rest of the system treats it as just another pluggable surface.

**Shared spine.** All four surfaces should read from Zod-validated config, hold runtime state in zustand, and apply immutable updates via immer — so each renderer is a swappable view over a schema-defined SSOT, and the timeline's bespoke internals stay hidden behind the same facade contract as the reused surfaces.

---

## Recommendations

**Stage 1 — Prove the headless split (weeks, not months).**
1. Stand up **React Flow** as the shared canvas. Implement (A) with a minimal Rete.js-style `DataflowEngine` (or Rete.js directly): set inputs → `fetch` outputs → `reset(id)` for downstream-only recompute → render value badges + `DataEdge`. Benchmark: changing one input recomputes only its downstream set, visibly.
2. Implement (B) as a TanStack-Table step list + shadcn stepper, with **XState** holding step status/retry/approval/abort. Benchmark: a rejected approval gate halts the machine and the table reflects it without a reload.

**Stage 2 — Add provenance and the op-log.**
3. Add the (C) read-mostly lineage overlay on the same React Flow canvas (dirty-set coloring + neighborhood focus). Back it with an **event-sourced op-log** (Redux-DevTools-style replay) for version history/time-travel/diff/fork. Mirror the **OpenLineage** Job/Run/Dataset model in your Zod schema. Benchmark: selecting a node highlights upstream sources and the downstream stale set; a revision slider replays state deterministically.

**Stage 3 — Build the timeline only when needed.**
4. If timeline needs are light, prototype with **`vis-timeline`**. The moment you need many tiers, strict half-open intervals, or Allen queries, switch to the **visx/D3 bespoke renderer + `@thi.ng/intervals`/`@flatten-js/interval-tree`**. Keep it behind a facade so the swap is invisible to the rest of the app.

**Thresholds that change these recommendations:**
- If recompute is *not* incremental-critical (small DAGs, cheap nodes), drop the engine and use React Flow's `useNodesData`/`updateNodeData` directly — simpler SSOT.
- If the pipeline is genuinely conversational/LLM-agentic with rich tool calls, switch (B)'s presentation to **assistant-ui**.
- If lineage must be column-level or cross-system at enterprise scale, adopt **Marquez** as a backend store (still render through your own overlay).
- If the timeline stays simple (few tiers, no Allen queries), **`vis-timeline`** may be the permanent answer — don't build bespoke prematurely.

---

## Risks / Unknowns

- **React Flow performance at scale.** Overlays and frequent value updates can stress re-renders; React Flow re-renders only changed nodes, but value-watching at high frequency needs memoization discipline. Validate with your expected node counts.
- **vis-timeline + React 18/19.** The template-rendering path relied on the now-deprecated `ReactDOM.render`; community wrappers vary in quality. This is a real integration risk if you lean on vis-timeline long-term.
- **Licensing flags.** `peaks.js` is **LGPL-3.0** (copyleft — fine if dynamically linked/unmodified, but flag for legal review); `dhtmlx-gantt` free edition is **GPLv2** with a commercial PRO tier; Syncfusion/Bryntum are commercial. Everything else recommended is MIT/Apache-2.0/BSD/ISC.
- **No off-the-shelf Allen algebra.** The 13-relation layer is yours to build and test; it's small and well-specified, but it is custom code with correctness risk around half-open boundary conditions.
- **OTIO on the web is immature.** If you ever need true OpenTimelineIO interchange in-browser, there is no React-native path today — only WASM viewers. Treat OTIO as an import/export format handled server-side, not a UI dependency.
- **Engine/renderer coupling drift.** The headless split is only as good as the discipline keeping logic out of renderers. Without a strict facade + Zod contract, value/lineage overlays can accrete business logic and erode the SSOT.
- **Observable runtime semantics.** Its demand-driven "only compute observed variables" model is powerful but can surprise teams expecting eager evaluation; confirm it matches your "watch all intermediate values" expectation (you may need to observe every node).
- **assistant-ui shape mismatch.** It is optimized for chat threads; forcing a named-step pipeline into it may cost more than a table+stepper. Validate before committing.

---

## References

[1] [Computing Flows — React Flow](https://reactflow.dev/learn/advanced-use/computing-flows)
[2] [Data Edge — React Flow](https://reactflow.dev/ui/components/data-edge)
[3] [useReactFlow() — React Flow](https://reactflow.dev/api-reference/hooks/use-react-flow)
[4] [Node-Based UIs in React — React Flow](https://reactflow.dev/)
[5] [xyflow/xyflow — GitHub](https://github.com/xyflow/xyflow)
[6] [Open Source — xyflow](https://xyflow.com/open-source)
[7] [Dataflow — Rete.js](https://retejs.org/docs/guides/processing/dataflow/)
[8] [Engine — Rete.js](https://retejs.org/docs/concepts/engine/)
[9] [Rete.js — GitHub](https://github.com/retejs)
[10] [observablehq/runtime — GitHub](https://github.com/observablehq/runtime)
[11] [@observablehq/runtime — npm](https://www.npmjs.com/package/@observablehq/runtime)
[12] [BaklavaJS — GitHub](https://github.com/newcat/baklavajs)
[13] [Flume — flume.dev](https://flume.dev/)
[14] [litegraph.js — GitHub](https://github.com/jagenjo/litegraph.js/)
[15] [Comfy-Org/litegraph.js (archived) — GitHub](https://github.com/Comfy-Org/litegraph.js/)
[16] [assistant-ui — GitHub](https://github.com/assistant-ui/assistant-ui)
[17] [assistant-ui — react chat UI](https://www.assistant-ui.com/)
[18] [XState Visualizer — Stately](https://stately.ai/viz)
[19] [Inspector — Stately](https://stately.ai/docs/xstate-v4/tools/inspector)
[20] [Stately — GitHub](https://github.com/statelyai)
[21] [Stepper — Dice UI](https://diceui.com/docs/components/radix/stepper)
[22] [Shadcn Stepper — ReUI](https://reui.io/components/stepper)
[23] [Getting Started — OpenLineage](https://openlineage.io/getting-started/)
[24] [Marquez — GitHub](https://github.com/MarquezProject/marquez)
[25] [Graph Visualization — dbt-docs (DeepWiki)](https://deepwiki.com/dbt-labs/dbt-docs/3.4-graph-visualization)
[26] [dbt Lineage Diff — Impact analysis, visualized (Medium)](https://medium.com/inthepipeline/dbt-data-lineage-diff-impact-analysis-visualized-bec9927b0c4e)
[27] [Time Travel in React Redux apps using Redux DevTools (Medium)](https://medium.com/the-web-tub/time-travel-in-react-redux-apps-using-the-redux-devtools-5e94eba5e7c0)
[28] [Redux DevTools: Time Travel Debugging (ReactLibs)](https://reactlibs.dev/articles/redux-devtools-time-travel-symphony/)
[29] [LineageViewer (Marquez + Cytoscape) — GitHub](https://github.com/DataVisuals/LineageViewer)
[30] [vis-timeline docs — vis.js](https://visjs.github.io/vis-timeline/docs/timeline/)
[31] [react-vis-timeline — npm](https://www.npmjs.com/package/react-vis-timeline)
[32] [react-calendar-timeline — GitHub](https://github.com/namespace-ee/react-calendar-timeline)
[33] [react-chrono — npm](https://www.npmjs.com/package/react-chrono)
[34] [react-chrono — GitHub](https://github.com/prabhuignoto/react-chrono)
[35] [frappe-gantt — npm](https://www.npmjs.com/package/frappe-gantt)
[36] [Best JavaScript Gantt Chart Libraries 2025–2026 (AnyChart)](https://www.anychart.com/blog/2025/11/05/best-javascript-gantt-chart-libraries/)
[37] [Brushable Timeline with Visx (lloydrichards.dev)](https://www.lloydrichards.dev/labs/028-brushable-timeline)
[38] [peaks.js — GitHub](https://github.com/bbc/peaks.js/)
[39] [wavesurfer.js — npm](https://www.npmjs.com/package/wavesurfer.js)
[40] [waveform-playlist — GitHub](https://github.com/naomiaro/waveform-playlist)
[41] [OpenTimelineIO — GitHub (ASWF)](https://github.com/AcademySoftwareFoundation/OpenTimelineIO)
[42] [@thi.ng/intervals — npm](https://www.npmjs.com/package/@thi.ng/intervals)
[43] [@flatten-js/interval-tree — npm](https://www.npmjs.com/package/@flatten-js/interval-tree)
[44] [Inngest — Durable Execution for Workflows & AI](https://www.inngest.com/)
[45] [Trigger.dev — Build and deploy AI agents and workflows](https://trigger.dev/)
[46] [LangSmith: AI Agent & LLM Observability](https://www.langchain.com/langsmith/observability)

---

*This report is provided as Markdown suitable for saving as a `.md` file (e.g., `dynamics-provenance-renderer-survey.md`). Progressive disclosure is applied: the TL;DR and Key Findings give the decision-ready summary; the per-need Details sections and comparison tables provide the deeper survey; the Reuse-vs-Dedicated, Recommendations, and Risks sections translate the findings into staged action.*