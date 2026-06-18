# zodal-graphs — Development Plan

> **Living document, horizon-graded.** The near horizon is detailed (named packages,
> modules, functions, files, acceptance tests); the far horizon is deliberately coarse — we
> *learn as we build* and sharpen later horizons as earlier ones land. This plan co-evolves
> with the dev toolkit (`.claude/skills/zodal-graphs-dev-*`) and the build: revise both
> whenever the work teaches us something.
>
> **Audience: AI agents.** Each near-term task is scoped so an agent can pick it up from an
> issue + the routed skill and execute largely independently. Decisions are pre-made with
> rationale; the few genuinely-open ones are flagged with a working default so building is
> never blocked.

**Status (2026-06-18):** design complete; pre-implementation; first checkpoint not yet
started. Branch: design work on `design-and-bootstrap`; implementation will branch per
checkpoint.

---

## 1. North star (one picture)

```
                 Zod v4 schemas  ──defineGraph──▶  GraphDefinition
                       │                               │ getCapabilities()
   ┌───────────────────┴───────────┐                   ▼
   │  CANONICAL MODEL (3 layers)    │           GraphCapabilities
   │  • topology  (nodes/edges/ports)│                  │
   │  • schema+affordances (Zod)     │     ranked RendererRegistry  ◀── RendererCapabilities
   │  • presentation (overlays/style)│                  │   (honest, per renderer)
   └───────────────┬─────────────────┘                  ▼
       serializer + pure adapters            pick & DEGRADE a renderer
   graphology │ react-flow │ ELK │ …                     │
        │                                ┌───────────────┼───────────────┐
   COMPUTE (overlays)                React Flow      cosmos/sigma     TanStack
   graphology + networkx tier      (typed ports)   (large-sparse)   (table/matrix/form)
```

**Three registries, one registration API** (SSOT, open-closed): affordances/schemas ·
renders · schema↔render mappings. In-house and third-party/agent-authored plugins all
register the same way. **Wrap, don't rebuild.** Only two new modules: `portTypeCompatible`
and the bespoke interval timeline.

---

## 2. Package map (monorepo → many tree-shakeable `@zodal/graph-*` packages)

Develop all in-house in one monorepo; publish each separately under the **`@zodal` npm org**.
Names are provisional until the first package lands.

| Package | Role | Depends on | Horizon |
|---|---|---|---|
| **`@zodal/graph-core`** | canonical model, `ports[]`, capabilities vocab, `GraphOverlays/Styling/Selection/Layout` types, `defineGraph`, serializer (`nodes_and_links`), **pure** adapters (graphology / react-flow-shape / ELK), `portTypeCompatible`. **No renderer deps.** | `zod` (peer), `@zodal/core` (peer) | **1 (now)** |
| **`@zodal/graph-ui`** | renders + mappings registries, `RendererCapabilities`, graph-aware testers + PRIORITY bands, capability-ranked **selection rule**, headless generators | `@zodal/graph-core`, `@zodal/ui` (peer) | **2** |
| **`@zodal/graph-compute`** | traversal + provenance overlay engine (graphology-*), ~50-line Tarjan, reachability primitive, `GraphOverlays` emit, server-boundary contract | `@zodal/graph-core`, `graphology` | **2** |
| **`@zodal/graph-react-flow`** | React Flow typed-port **editor** renderer; `makeIsValidConnection` wiring; collapse↔expand | `@zodal/graph-core`, `@zodal/graph-ui`, `@xyflow/react`+`react` (peer) | **2–3** |
| `@zodal/graph-sigma`, `@zodal/graph-cosmos`, `@zodal/graph-deck` | large-sparse / GPU / point-cloud renderers | core + ui + the lib (peer) | **3** |
| `@zodal/graph-table` (or reuse `zodal-ui-shadcn`) | table / matrix / form lenses + `activeView` switching | core + ui + TanStack + RHF/shadcn | **3** |
| `@zodal/graph-timeline` | bespoke ELAN-style interval-tier timeline + Allen relations | core + `@visx/brush` + interval libs | **4 (bespoke)** |

**Hard rule (inherited):** a renderer package depends on `@zodal/graph-ui`; never on another
renderer package. Shared logic belongs in `@zodal/graph-core`.

---

## 3. Build order & why

**P4 (canonical model) is the keystone — it unblocks everything**, so it is the entire first
checkpoint. The remaining order follows the dependency graph and de-risks the hardest things
first (typed-port fidelity before scale before overlays):

**P4 → P1 → P2 → P3 → P5 → P6.** Rationale lives in
[`docs/research/README.md` §What's next](research/README.md) and `_reconciliation.md`.

---

## 4. Horizon 1 — THE FIRST CHECKPOINT (detailed)  ·  `@zodal/graph-core` + monorepo

**Goal:** prove the riskiest contract — a typed-**port** graph round-trips through every
adapter with zero port-edge loss — and stand up the monorepo + CI so packages can build
(not publish). This is the natural "prove the keystone" checkpoint.
**Owning skills:** `/zodal-graphs-dev-canonical-model`, `/zodal-graphs-dev-monorepo`.

### 4.1 Tasks (each ≈ one issue)

1. **Monorepo scaffold.** `package.json` (private, turbo scripts, `packageManager: pnpm@9.x`),
   `pnpm-workspace.yaml` (`packages/*`), `turbo.json`, `tsconfig.base.json`, root README.
   *Model on:* `zodal/` root files. *Acceptance:* `pnpm install` + `pnpm build` (no packages
   yet) succeeds.
2. **`@zodal/graph-core` package skeleton.** `package.json` (`@zodal/graph-core`, dual
   CJS/ESM exports map, `peerDependencies.zod: ">=4.1.13"`, `@zodal/core` peer), `tsup.config.ts`,
   `tsconfig.json`, `vitest.config.ts`, `src/index.ts` barrel. *Acceptance:* `pnpm build`
   emits `dist/index.{js,cjs,d.ts}`; `pnpm typecheck` clean.
3. **Canonical model types** (`src/model.ts`): `CanonicalGraph`, `GraphNode` (`kind:
   'var'|'func'|'entity'`), `GraphPort`, `GraphEdge` (with `sourcePort`/`targetPort`),
   `GraphMeta`, branded ids (`NodeId`/`PortId`/`EdgeId`). *Acceptance:* a portless entity
   graph and a meshed-style bipartite func graph both type-check as `CanonicalGraph`.
4. **Capabilities vocab** (`src/capabilities.ts`): `GraphCapabilities`,
   `DEFAULT_GRAPH_CAPABILITIES`, `RendererCapabilities`, `GraphView`, `TraversalKind`.
5. **Presentation layer types** (`src/presentation.ts`): `GraphOverlays` (`{nodeId/edgeId →
   role}`), `GraphStyling`, `GraphSelection`, `GraphLayout`. Kept physically separate from
   topology.
6. **Serializer** (`src/serialize.ts`): `CanonicalGraph ↔ nodes_and_links` superset JSON
   (bipartite `kind` + `ports[]` + link `sourcePort`/`targetPort` + `graph.zodal` block).
7. **Pure adapters** (`src/adapters/`): `toGraphology`/`fromGraphology` (near-identity),
   `toReactFlow`/`fromReactFlow` (plain `{nodes,edges}` objects — **no `@xyflow/react`
   import**; `fromReactFlow` strips position/selection back into the presentation layer),
   `toELK`/`fromELK` (port-aware ELK JSON).
8. **⛔ PORT-FIDELITY BENCHMARK** (`tests/round-trip.test.ts`) — **the checkpoint gate.**
   A port-rich fixture (meshed-style func nodes, typed ports, port-level edges) round-trips
   `canonical → X → canonical` through graphology, react-flow, ELK. **Any dropped
   port-level edge fails the build.** If it fails, the model is wrong — fix before proceeding.
9. **`defineGraph` skeleton** (`src/define-graph.ts`): `defineGraph({ nodeTypes, edgeTypes,
   affordances })` → `GraphDefinition` with `getCapabilities()`. Reuse zodal's affordance
   inference; extend the affordance registry (WeakMap, register-before-wrap) with graph keys.
10. **`portTypeCompatible` v0** (`src/port-type.ts`): conservative Zod-v4 rule (exact
    base-type match + wildcard). Pure; no renderer dep. Unit-tested as facade logic.

### 4.2 Checkpoint acceptance criteria

- [ ] Port-fidelity benchmark green across all three adapters (zero port-edge loss).
- [ ] `defineGraph` returns honest `GraphCapabilities` for a portless graph and a typed-port
      executable graph.
- [ ] `pnpm build && pnpm typecheck && pnpm test` green; dual CJS/ESM + `.d.ts` emitted.
- [ ] CI `validate` job runs on PR (publish job present but **never triggered** — no `[publish]`).
- [ ] `portTypeCompatible` v0 unit-tested; `toJSONSchema()` stays in the representable subset.
- [ ] Adversarial critic pass applied (Phase-4 protocol below).

### 4.3 Checkpoint exit → next

Once green, PR + merge (CI publishes **nothing** until the owner approves the first release).
Then re-open the plan: Horizon 2 tasks get detailed; toolkit skills get revised against what
the build taught us.

---

## 5. Horizon 2 — soon (named, medium detail)

- **`@zodal/graph-ui` — registries + selection.** Port zodal's `RendererRegistry` to
  `createGraphRendererRegistry`, graph-aware testers, PRIORITY bands, the rank-and-degrade
  selection rule, `RendererCapabilities`, generators. Seed two paper renderers (React Flow
  caps vs sigma caps) and unit-test that selection + degrade picks correctly across scale/edit
  thresholds. → `/zodal-graphs-dev-registries`.
- **`@zodal/graph-compute` — traversal/provenance (P2).** graphology import from canonical;
  the ONE reachability primitive (forward/reverse BFS) powering descendants/stale AND
  ancestors/provenance; capability-gated `GraphOverlays` emit; `GraphDataProvider` honest
  capability reporting; custom Tarjan. Defer the huge-scale columnar-overlay fork. → P2b doc.
- **`@zodal/graph-react-flow` — typed-port editor (P1).** Custom func-node component (shows
  arg names/types/defaults), `<Handle>` per port (`id = port name`), `makeIsValidConnection`
  driven by `portTypeCompatible`, controlled `{nodes,edges}` state, collapse↔expand. → P1b doc.

---

## 6. Horizon 3+ — later (coarse, sharpen when reached)

- **P3 large-sparse renderers** — sigma+graphology (MIT explore), then `@cosmos.gl/graph`
  (MIT GPU), then deck.gl point-cloud. Isolate the `@cosmograph/react` CC-BY-NC decision to a
  single stage-2 adapter. Editor↔viz capability-threshold handoff.
- **P5 table/matrix/form** — reuse TanStack Table; `activeView` store extension with shared
  selection/filters; RHF+zodResolver+shadcn forms; **build** thin heat-cell matrix + seriation
  (the matrix surface is an open decision — see §8).
- **P6 dynamics & provenance** — (A) React Flow value-watch; (B) XState+shadcn stepper on
  TanStack; (C) provenance presentation (**hard dep on P2**); (D) **bespoke interval timeline**
  (largest standalone build; can start anytime — shares only the lacing model).
- **graph-DB explorer** — a *composition* of the editor (P1) + table (P5) + a query editor;
  not a new package until a graph-DB product becomes a near-term target.

---

## 7. Cross-cutting workstreams (run alongside)

- **CI/publish** — scaffold `validate` + `publish` jobs in checkpoint 1; the `publish` job
  stays dormant until the owner approves the first release (`[publish]` marker). → `/zodal-graphs-dev-monorepo`.
- **Testing** — contract tests per package (mirror `zodal-store-fs`'s `describe.each` contract
  suite); the port-fidelity benchmark is the flagship.
- **Work tracking** — one GitHub issue per near-term task; issues as the dev journal; design
  rationale → discussions; this plan + skills stay the durable map.
- **Docs** — keep `research_guide.md`, the decision table, and this plan as the SSOT; update
  on every decision change.

---

## 8. Decisions — baked in vs. open

**Baked in (with rationale; proceed unless the owner overrides):**
- Canonical hub = `nodes_and_links` superset + typed `ports[]` (P4 reconciled).
- Renderer picks per the decision table (React Flow / graphology / cosmos.gl / TanStack / …).
- Monorepo + `pnpm -r publish`, `[publish]`-gated CI, **no changesets**, manual version bumps
  (modeled on zodal).
- Publish under the `@zodal` org; packages named `@zodal/graph-*`.

**Open — working default lets building proceed; owner's call to change:**
1. **Executor boundary.** *Default:* the TS facade is **editor/viewer/overlay only** for
   Python-backed (`funcRef`) graphs; an optional minimal engine may execute **pure-TS**
   graphs. Affects P1 validation depth and P6A. *Does not block checkpoint 1.*
2. **Matrix surface.** *Default:* **build thin heat-cell on TanStack** (preserves the
   cross-lens selection bridge) over adopting FINOS Perspective (forks the data pipeline).
   Far-horizon (P5); non-blocking.
3. **`portTypeCompatible` depth.** *Default:* start conservative (exact base-type + wildcard),
   widen toward covariance/refinements/unions only when a real case demands it.

---

## 9. Risks & gates

| Risk | Mitigation / gate |
|---|---|
| Typed-port contract wrong → expensive rework | **Port-fidelity benchmark is the checkpoint-1 gate.** Fix the model before adding adapters. |
| Zod v4 codegen drops nested `graph.*` meta | Verify against zodal `codegen.ts`; add to `extractAffordancesFromMeta` whitelist + `FIELD_PROP_ORDER`. |
| Huge-scale overlays infeasible as `Record<id,role>` | Don't promise `scaleClass:'huge'` until the columnar/typed-array projection is designed (P2/P3). |
| `@cosmograph/react` CC-BY-NC non-commercial trap | Use MIT `@cosmos.gl/graph`; isolate any Cosmograph wrapper to one stage-2 adapter. |
| Interval timeline has no off-the-shelf option | Budget P6D as the single largest bespoke build; prototype with vis-timeline, swap behind a facade. |
| Accidental npm publish | CI is `[publish]`-gated; never publish from a laptop; first publish needs owner approval. |

---

## 10. How an agent executes a near-term task

1. Read the issue + open the routed `/zodal-graphs-dev-<skill>` (it routes the research docs).
2. Branch (`feat/<task>`); report the starting branch.
3. Build to the task's acceptance criteria; write the contract/benchmark test first where one
   is specified.
4. Run `pnpm build && pnpm typecheck && pnpm test`.
5. For a checkpoint: spawn an adversarial critic subagent, apply fixes, open a PR, merge.
6. Update this plan + the affected skill if the work changed a contract. **Never** publish.
