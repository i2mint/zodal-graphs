# Prompt 6 — Execution / Stepper / Provenance / Timeline (Grounded Fit)

> **Version note.** Claude Code grounded — the (B) named-step stepper and (D) timeline-track LIBRARY surveys are DELEGATED to a parallel Claude AI deep-research run. This report covers (A) dataflow value-watching grounded in meshed/dagapp, (C) provenance/lineage presentation coordinated with the P2 overlay engine, and the grounded REQUIREMENTS specs for (B) and (D) to score the Claude AI surveys against.

---

## 0. Scope and the four needs, mapped to capabilities

This report covers the **execution / dynamics (cluster E)** and **provenance / lineage / timeline (cluster F + interval)** regimes of the affordance synthesis (`_grounding-brief.md` §a/§c, regimes 4 and 6). It is organized around four needs that the affordance synthesis separates and that map onto distinct `GraphCapabilities` (`04-...md` §5.1):

| Need | What it is | Driving capabilities | Renderer story |
|---|---|---|---|
| **(A)** | Dataflow value-watching on a small node-link canvas | `executable` + `watchesValues` (+ optional `canStep`), `scaleClass:'small'` | Reuses the **node-link editor** (React Flow), value-watch as presentation |
| **(B)** | Linear named-step pipeline stepper | `executable` + `canStep`, `!watchesValues`, linear topology | Reuses the **stepper + form backbone** (no node-link canvas) |
| **(C)** | Provenance / lineage presentation | `hasProvenance` (+ `canTimeTravel`), `traversal` | **Renderer-agnostic overlay** fed by the P2 backend, drawn on whatever node-link renderer is active |
| **(D)** | Interval-tier timeline track | `hasIntervals` | **Dedicated bespoke-glue renderer** — the one true new renderer in the fleet |

The single most important architectural distinction this report enforces is the one the verifier confirmed (CLAIM 2): **(A) is live dataflow that recomputes; (C) is inert presentation of lineage state that must NOT recompute.** They share traversal vocabulary (ancestor/descendant) but live on opposite sides of the compute boundary. Conflating them would double-own the traversal and break the P2-backend SSOT.

A second cross-cutting boundary (verifier CLAIM 1, confirmed) governs all of (A) and (B): **a TS/browser facade cannot execute a Python-backed `func` node.** The canonical model (`04-...md` §3.2) serializes only a `funcRef` string (`"mypkg.ops:add"`), never the callable, because `meshed`'s `FuncNode.func` is not JSON-serializable (`_grounding-brief.md` §5, lines 310, 316). So `executable` must split into **executable-in-browser** (pure-TS `funcRef` resolves to a JS function) vs **executable-via-backend** (Python runtime executes; the facade is editor/viewer + overlay only).

---

## (A) Dataflow value-watching — on-canvas value-watch overlay

### Recommendation

**Adopt React Flow's Computing Flows APIs (`updateNodeData` + `useNodeConnections` + `useNodesData`) as the on-canvas value-watch mechanism for `scaleClass:'small'` executable graphs, with execution kept in zodal's state layer — NOT in the renderer.** This is the survey's (A1) candidate, and its load-bearing API claims are verified against the primary React Flow docs:

- `updateNodeData(nodeId, data)` exists, is retrieved from `useReactFlow`, and **merges with the old data object by default** (`{replace: true}` opts out) [1]. This confirms the survey's partial-`{...data}` update claim.
- `useNodeConnections` reports which nodes are connected to a specific handle (target/source, optional handle id) [1].
- `useNodesData(nodeId)` returns the connected source node's current data object [1].
- The docs explicitly warn of **a delay in updating the data object** and recommend local state for input fields rather than binding directly to node data [1]. This is a material caveat the survey under-stated: var-node *input* fields should hold local state and push to node data on commit, not bind live.

React Flow is **MIT** (no copyleft flag) and very actively maintained (`@xyflow/react` 12.x line, 37k+ stars) [1][2]. These are the documented current-generation APIs, not deprecated handle-connection variants.

The survey also offered **(A2) Rete.js `rete-engine`** as the specialized dataflow alternative. Its primary-source claims are confirmed: `fetch(nodeId)` traverses dependencies and executes `data()` methods in dependency order; **node outputs are cached to avoid repetitive execution**; `reset(nodeId)` clears cached results so the next `fetch()` recomputes only affected downstream nodes while unaffected upstream nodes retain cached values [3]. Rete is MIT and actively maintained [3]. **However**, the precise wording the survey used — "`reset(nodeId)` invalidates the cache of that node AND its predecessors" — is *not* what the docs state; the docs describe reset clearing a node's (or all nodes') cache and `fetch` recursing predecessors. I treat the survey's predecessor-invalidation phrasing as **uncertain** and recommend against relying on it; the safe, documented model is "reset the changed input(s), refetch the leaves, caching skips unaffected nodes."

**Decision: React Flow (A1) is primary for (A).** It keeps execution in zodal's framework-agnostic state layer (the brief's `CollectionState` precedent) and uses the canvas purely for presentation. Rete.js (A2) is the alternate to register at a lower priority band when the consumer wants the engine to own recompute; its tighter dataflow fit is offset by Rete owning both editor and execution (heavier, less React-idiomatic, smaller ecosystem).

### Grounded sketch — value-watch as presentation over the canonical var/func model

The canonical model already gives every addressable surface this needs. Each `var` node (`kind:'var'`, `04-...md` §3.1) and each `func` node carries its current value in React Flow's `data` object. Per-handle value addressing comes directly from the canonical link's `targetPort`/`sourcePort` and the func node's `ports[]` block (`04-...md` §3.1–3.2) — the `targetPort` names exactly which named input an edge feeds, so `useNodeConnections` keyed per handle subscribes a func node to the right upstream `var`.

**Input projection (dagapp, form-first).** A `var` node's input widget is *derived*, not stored: its resolved port type maps to `{value, arg_type, widget, range}` via zodal's existing `getZodBaseType` / `getNumericBounds` / `getEnumValues` introspection (`_grounding-brief.md` substrate §1; `04-...md` §3.3 — "derivable from a var node's resolved port type ... a presentation projection, not stored state"). This is dagapp's `DFLT_ANNOT_ARGTYPE_MAP` → `ARG_TYPE_WIDGET_MAP` pipeline (`dagapp/utils.py:21-37`) realized on the canonical port type instead of a Python annotation.

**Recompute gesture.** dagapp recomputes downstream via `successors(dag.graph, changed_node)` + kind-aware `_compute_node_value` (`dagapp/utils.py:257-301`). The React Flow analog is structural, not hand-rolled: a func node reads upstream values with `useNodeConnections` (which handles are connected) + `useNodesData` (the connected source's data) keyed per handle, so when an upstream value changes, **only nodes whose `useNodesData` subscriptions changed re-render** [1]. Kind-awareness (positional vs `*args`/`**kwargs` splat) carries on the canonical port `kind` field (`positional_only | ... | var_positional | var_keyword`, `04-...md` §3.1), mirroring dagapp's kind-respecting call.

**The overlay is presentation only.** Run/step writes results back with `updateNodeData(nodeId, {value, status})` (merge semantics permit partial updates [1]). The value-watch overlay renders current value + a `status` role (`idle | stale | running | ok | error`) in each node body and decorates edges carrying a fresh value. This maps to `GraphCapabilities` `executable`, `watchesValues`, `canStep` (`04-...md` §5.1) and to renderer-selection rule **line 3** (`04-...md` §5.2): `executable && watchesValues && scaleClass==='small'` → React Flow with value-watch overlay.

**Execution boundary (the governing constraint).** Per verifier CLAIM 1 (confirmed), the facade is the editor/viewer + value-watch overlay; actual run/step for a Python-backed graph is delegated to a Python runtime (`meshed`'s `DAG.call_on_scope`, `_grounding-brief.md` lines 210-211; dagapp's session-state-as-scope). The overlay protocol:

```
facade ships {graph, input bindings}
  → Python executor runs (full OR successor-only recompute, matching dagapp's update_nodes)
  → returns { nodeId → { value, status, error } }
  → facade merges via updateNodeData and renders
```

Only **pure-TS** func graphs (where `funcRef` resolves to a JS function) run fully in-browser. Therefore `getGraphCapabilities()` must report **executable-in-browser vs executable-via-backend** — a refinement the canonical `GraphCapabilities` does not yet carry (verifier CLAIM 1 notes the vocab has `executable`/`canStep`/`watchesValues` but does not yet split `executable`), and `canStep` requires the executor expose a **step** endpoint, not merely run-all. This split is presented as a grounded design assumption to confirm, not settled fact.

---

## (B) Named-step pipeline stepper — REQUIREMENTS spec (library survey DELEGATED)

The (B) library survey (which off-the-shelf stepper/wizard primitive to adopt) is delegated to the parallel Claude AI deep-research run. This section is the **grounded requirements spec to score that survey against**.

### Backbone reuse vs dedicated renderer

**(B) reuses the stepper + form backbone, NOT a node-link renderer.** The affordance synthesis is explicit that the executable-DAG regime splits into *dataflow value-watching on-canvas* (need A) vs *linear pipeline steppers* (need B) (`_grounding-brief.md` §a regime 4), and that the linear-stepper subjects — **aw, muvid, coact, nw, dagapp** — are served by "a stepper + form renderer built on zodal's existing collection-UI primitives (forms + state) ... with no node-link canvas — mostly already in zodal's wheelhouse, not a graph problem" (`_grounding-brief.md` §e, family 4). Renderer-selection rule line 3 routes here: `executable && !watchesValues && canStep && linear topology → stepper + form` (`04-...md` §5.2).

So (B) is a **backbone-reuse case**: the stepper is a thin orchestration shell over zodal's existing `FormFieldConfig` generator (`toFormConfig`) and the framework-agnostic state store. It is **not** the bespoke-glue case (that is (D)).

### Requirements the delegated Claude AI survey MUST satisfy

A scored (B) candidate must support:

1. **Named, ordered steps over a linear topology.** Steps map to a linear chain of `func` nodes (or staged phases — coact's `COMPLETE→REALIZE→PUBLISH`, muvid's fixed staged chain, aw's linear stages; `_grounding-brief.md` §c). Step identity = node name / phase label, not a position index.
2. **Per-step status with retry.** Each step carries a status role aligned with the value-watch roles: `idle | running | ok | error` plus `retrying` (aw/coact "status/retry"; `_grounding-brief.md` §a cluster E lists step-status/retries, human-approval). Maps to `canStep`.
3. **Human-approval / cost-gate hooks.** Cluster E includes `cost-gate` and `human-approval` (`_grounding-brief.md` §a). The stepper must allow a step to block on user confirmation before advancing.
4. **Per-step form input via the existing generator.** A step's inputs are var-node values projected through `toFormConfig` (the same dagapp form projection as (A)) — the survey candidate must accept externally-supplied field configs, not impose its own form model.
5. **Per-step fan-out.** muvid's per-shot fan-out (`_grounding-brief.md` §c) means a single named step may expand into N sub-items rendered as a render table (reusing the TanStack-Table backbone) — the stepper must compose with the table view, not exclude it.
6. **Execution-boundary compliance.** Same as (A): for Python-backed pipelines the stepper drives a backend step endpoint; `canStep` is only honest if such an endpoint exists (verifier CLAIM 1).
7. **License + maintenance gate (health bar).** Permissive (MIT/Apache-2.0/BSD); copyleft flagged; actively maintained; reasonable bundle.

### Anti-requirements (where a candidate over-reaches)

- A candidate that **forces a node-link canvas** for linear pipelines is wrong for this regime — the node-link diagram "adds nothing" here (renderer-selection fallback, `04-...md` §5.2 line 5).
- A candidate that **owns its own form/field model** rather than consuming `FormFieldConfig` breaks the SSOT reuse and should be down-scored.

The Claude AI survey should report whether the strongest candidate is a generic wizard/stepper component or whether zodal's collection-UI primitives already cover it with only an orchestration wrapper (the brief's expectation).

---

## (C) Provenance / lineage presentation — renderer-agnostic overlay coordinated with the P2 engine

### Recommendation

**Adopt the survey's (C1): provenance is `hasProvenance` lineage presented as renderer-agnostic `GraphOverlays.highlights` layers, computed once by the P2 networkx-class backend and drawn on whatever node-link renderer is active. It is PRESENTATION, never RECOMPUTE.** The verifier confirmed both the presentation-not-recompute boundary and the hard P2 dependency (CLAIM 2, confirmed):

- `_grounding-brief.md` (b) line 46: "The signature provenance gesture (mark changed → highlight stale downstream) reuses the SAME ancestor/descendant traversal as executable DAGs."
- `_grounding-brief.md` §e line 86 and `04-...md` §5.2 lines 313-314: traversal & provenance overlays "are computed once by a networkx-class backend and emitted as highlight/style data ... modeled once, never per renderer."

The provenance ledger is a **read-mostly lineage ledger** (`_grounding-brief.md` regime 6, line 34; nw line 59), backed by lacing's PROV-O subset `was_derived_from` and `stale-after` freshness (`_grounding-brief.md` line 286; `lacing/model.py:71-96`). This is an **inert lineage ledger**, structurally distinct from (A)'s live dataflow.

### Grounded sketch — provenance arm of the central overlay bet

The lacing/nw provenance affordances (`inspect-node-provenance`, `highlight-downstream-impacted`, `flag-stale-derivatives`, `follow-derived-from-link`, `replay-state-at-time`, `browse-version-history`; `_grounding-brief.md` (b) Provenance F list) map onto the **P2 overlay config** (`04-...md` §6, `GraphOverlays`) as highlight layers:

- **`upstream sources`** = `ancestors(selected)` → `{ layer: 'ancestors', nodes: Record<nodeId, 'primary'|'related'> }`
- **`downstream stale / impacted`** = `descendants(changed)` → `{ layer: 'descendants' | 'stale', nodes: Record<nodeId, 'stale'|'dimmed'> }`
- **`derivation path`** = lacing `was_derived_from` chain → `{ layer: 'critical-path', edges: Record<edgeId, 'primary'> }`

These reuse the `GraphOverlays.highlights` shape exactly (`04-...md` §6): `{ layer, nodes: Record<nodeId, HighlightRole>, edges?: Record<edgeId, HighlightRole> }` with roles `primary | related | dimmed | stale | ...`. Critically, **the facade does not recompute the stale-set** — it consumes the ancestor/descendant traversal the P2 backend computed once. Staleness is a **visual role** sourced from lacing's `stale-after` / PROV-O `was_derived_from`, not a recompute trigger. `canTimeTravel` (`04-...md` §5.1, `replay-state-at-time`) is a presentation of a prior ledger snapshot, again no recompute.

**Coordination with P2 is a hard dependency, not an option.** Because the same traversal feeds both executable DAGs (A) and provenance (C), it must be owned in exactly one place (the P2 networkx-class backend). The (C) renderer is a *consumer* of P2 overlay output; if (C) re-derived ancestors/descendants it would double-own the traversal and violate the SSOT — the exact failure the verifier flagged.

### Backbone reuse

(C) **reuses the node-link editor backbone** (the highlights are drawn on the active node-link renderer — React Flow at small scale, Cytoscape/sigma/cosmograph as scale rises) **plus the table backbone** (nw's per-tier provenance tables; `_grounding-brief.md` line 59). It is **not** a dedicated renderer — it is overlay data plus a provenance inspector panel (which is itself a form/table view of a node's `Provenance` envelope: `was_generated_by`, `was_attributed_to`, `was_derived_from`, `generated_at_time`, `activity`; `lacing/model.py:71-96`).

### Scale caveat (verifier CLAIM 3, confirmed)

`GraphOverlays.highlights` as `Record<nodeId, role>` JSON is **infeasible at `scaleClass:'huge'`** (100k–1M nodes; `04-...md` Risk 5). Provenance ledgers are *usually* small/medium (nw per-project lineage, lacing PROV-O derivation), so this risk is mostly confined to value-watch-on-huge, not provenance-on-huge — but a huge provenance ledger would need a columnar / typed-array / compute-on-renderer representation, a different mechanism than the small-graph JSON record. Documented as a known scaling limit, not a blocker for the common case.

---

## (D) Interval-tier timeline track — REQUIREMENTS spec (library survey DELEGATED, BESPOKE-GLUE case)

The (D) library survey (vis-timeline vs custom D3 vs GEXF `<spells>` etc.) is delegated to the parallel Claude AI deep-research run. This section is the **grounded requirements spec to score it against** — and it flags (D) as **the bespoke-glue case**: the single renderer in the whole fleet most likely to require a dedicated build.

### Backbone reuse vs dedicated renderer — (D) is the bespoke renderer

The affordance synthesis names the timeline-track renderer as renderer family 5 and flags it explicitly: "off-the-shelf options thinnest here (vis-timeline, custom D3) — flagged as most likely to need bespoke glue" (`_grounding-brief.md` §e family 5). For lacing the node-link diagram is the *wrong* surface (`_grounding-brief.md` §c lacing line 62). So (D) is **not** a backbone-reuse case like (A)/(B)/(C):

- It does **not** reuse the node-link editor (node-link is the wrong surface for interval data).
- It **partially** reuses the table backbone (lacing's per-tier tables, `_grounding-brief.md` line 62), but the *track* visualization — interval tiers + Allen-relation brushing — has no first-class backbone.
- It requires a **dedicated timeline-track renderer** registered behind renderer-selection rule line 1 (`04-...md` §5.2): `views excludes node-link && hasIntervals → Timeline-track renderer`, `OVERRIDE` band.

### Why it is bespoke glue (the grounded gap, verifier CLAIM 4, confirmed)

No off-the-shelf timeline library speaks lacing's model. The verifier confirmed against primary sources, and my own checks corroborate:

- **vis-timeline** (Apache-2.0 OR MIT, latest 8.5.1, 2026-05-07 per verifier) models items with `start`/`end` as JS `Date`/`number`/`moment`. It has **no Allen's-13-relations concept and no rational `{v,r}` exact-fraction time**; searches for vis-timeline + Allen / rational-time return only academic Allen-algebra papers, not library support [4][5].
- **GEXF `<spells>`** (`04-...md` §1 line 32) carries intervals/timestamps for dynamic graphs but uses plain numeric/date timestamps — no Allen relations, no rational time.

lacing's model is bespoke (`_grounding-brief.md` §3): `RationalTime` wire format `{v:int, r:int}` with `DEFAULT_RATE 24000` (`lacing/time.py:22, 245-250`), **half-open `[start, end)`** `TimeInterval` where `start == end` is a valid point annotation (`lacing/time.py:271-363`), the canonical **13 Allen relations** as a str-Enum with `inverse()` (`lacing/allen.py:40-79`), and ELAN's **five tier stereotypes** (`NONE`, `TIME_SUBDIVISION`, `INCLUDED_IN`, `SYMBOLIC_SUBDIVISION`, `SYMBOLIC_ASSOCIATION`) with pure constraint validation (`lacing/tier.py:15-34, 129-227`).

### Requirements the delegated Claude AI survey MUST satisfy

A scored (D) candidate (or the decision to build) must address:

1. **Rational `{v,r}` time, not float.** The renderer must accept exact-fraction time and only escape to float at the pixel-projection boundary (`lacing/time.py:168-170` is a one-way `to_seconds`). A candidate that forces `Date`/`number` at the model layer fails the fidelity requirement (it may still be acceptable as a *projection* target).
2. **Half-open `[start, end)` interval semantics, including zero-measure point annotations** (`start == end`). Allen `meets` is `a.end == b.start` with zero shared measure (`lacing/allen.py:6-9`) — a candidate using closed intervals or treating `start==end` as degenerate is wrong.
3. **Tier/track lanes with parent linkage and the five ELAN stereotypes.** Tiers are named layers with `parent`, `stereotype`, `metadata` (`lacing/tier.py:37-127`); stereotype constraints (partition vs gaps-allowed vs symbolic) drive validation and rendering.
4. **Allen-relation brushing / interval-relation query.** Cluster D includes `interval-relation-query` and cluster H includes `brush/scrub time` (`_grounding-brief.md` §a). The renderer must expose the 13 relations as a query/brush vocabulary — none exists off the shelf, so this is the glue layer.
5. **Annotation envelope binding.** Each track item is a lacing `Annotation` (`id`, `tier`, `reference: MediaRef|NodeRef|AnnotationRef`, typed `body`, `provenance`, `confidence`; `lacing/model.py:102-131`). `NodeRef.scene_path` is the bridge that lets a timeline item attach to a graph node — so (D) coordinates with (C)'s provenance overlay and the canonical node model.
6. **License + maintenance gate (health bar).** vis-timeline's dual Apache-2.0 OR MIT is clean; any custom-D3 build inherits D3's BSD-3-Clause. No copyleft in the candidate set surveyed so far — the delegated survey must confirm for whatever it recommends.

### Build vs adopt guidance for the survey

The grounded expectation: **adopt a generic timeline core for the lane/track rendering and time-axis (vis-timeline or a D3 axis), then build the lacing-specific glue on top** — rational-time projection, half-open semantics, ELAN stereotype validation, and the Allen-relation brush. The `{v,r}`→state-set addressing and the Allen query layer are zodal-bespoke regardless of which core is chosen. The survey should rank cores by how little glue they force and how cleanly they accept an external time model.

---

## Risks / unknowns

1. **`executable` is not yet split in the canonical vocab (A/B).** `GraphCapabilities` carries `executable`/`canStep`/`watchesValues` but not the executable-in-browser vs executable-via-backend distinction the meshed/dagapp reality demands (verifier CLAIM 1). This is a grounded design assumption to confirm with the canonical-model owner, plus a `canStep`-requires-a-step-endpoint contract. **Open — confirm.**

2. **React Flow data-update delay (A).** The docs warn of a delay updating `data` and recommend local state for input fields [1]. Binding var-node inputs live to node data will feel laggy; the value-watch overlay must hold local input state and commit on change. **Known caveat, design accordingly.**

3. **Rete.js reset-predecessor wording is uncertain (A2).** The survey claimed `reset` invalidates a node *and its predecessors*; the primary docs describe reset clearing cache and `fetch` recursing predecessors [3]. Do not rely on the predecessor-invalidation phrasing; use the documented "reset changed input, refetch leaves, caching skips unaffected" model. **Caveated per verifier-preference rule.**

4. **Overlay scale at `huge` (A/C).** `Record<nodeId, role>` JSON overlays are infeasible at 100k–1M nodes (verifier CLAIM 3); mostly confined to value-watch-on-huge since provenance ledgers are usually small, but a huge ledger needs a different (columnar/compute-on-renderer) mechanism. **Known limit.**

5. **Timeline is the largest bespoke-build risk (D).** No off-the-shelf library speaks `{v,r}` rational time or Allen's 13 relations (verifier CLAIM 4); the timeline-track renderer plus the rational-interval→state-set addressing and Allen brush are zodal-bespoke glue on a generic core. **Highest bespoke-build risk in the cluster-E/F fleet.**

6. **P2 dependency is hard for (C).** The provenance overlay cannot ship before the P2 networkx-class traversal backend; if P2 slips, (C) has no stale-set/ancestor data to present. **Sequencing dependency.**

7. **(B) backbone sufficiency unverified.** The brief expects zodal's collection-UI primitives to cover the stepper with only an orchestration wrapper; whether a generic stepper is needed at all is exactly what the delegated Claude AI (B) survey must determine. **Delegated-open.**

---

## REFERENCES

[1] [React Flow — Computing Flows guide (`updateNodeData`, `useNodeConnections`, `useNodesData`)](https://reactflow.dev/learn/advanced-use/computing-flows). MIT. Confirms default-merge `updateNodeData`, per-handle connection subscription, and the data-update delay caveat.

[2] [React Flow / xyflow — React Flow instance API reference](https://reactflow.dev/api-reference/types/react-flow-instance). `@xyflow/react` 12.x, MIT, ~37k stars, very actively maintained.

[3] [Rete.js — Dataflow processing guide (`rete-engine`: `fetch`, `reset`, output caching)](https://retejs.org/docs/guides/processing/dataflow/). MIT. Confirms dependency-order `fetch`, output caching, and cache-reset recomputation; the "reset invalidates predecessors" phrasing is not stated and is treated as uncertain.

[4] [vis-timeline — npm package](https://www.npmjs.com/package/vis-timeline). Dual Apache-2.0 OR MIT; latest 8.5.1 (2026-05-07). Models items as `start`/`end` Date/number/moment; no Allen relations, no rational time.

[5] [vis-timeline — GitHub repository (visjs/vis-timeline)](https://github.com/visjs/vis-timeline). Generic interactive 2D timeline/range visualization; confirms no native Allen-interval-algebra or rational-time support.

[6] [Allen's Interval Algebra (reference)](https://ics.uci.edu/~alspaugh/cls/shr/allen.html). The canonical 13 distinct, exhaustive interval relations that lacing's `AllenRelation` str-Enum implements and that no surveyed timeline library exposes natively.
