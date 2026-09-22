# zodal-graphs

> A declarative layer where graph *affordances* are expressed once and mapped — in many ways, against many targets — to UIs, storage, and graph databases. The graph specialization of `zodal`.

This repository started as the **research, design, and development-planning phase** for
zodal-graph. That phase chose and designed the modern, well-maintained tooling for a Zod-v4
schema-driven, renderer-agnostic graph-UI facade, with a strong bias toward reusing existing
libraries rather than building from scratch, and the planning layer turned that research into
an executable, AI-agent-driven build plan.

**The build itself has since shipped.** Nine `@zodal/graph-*` packages are built, tested, and
published to npm at `0.1.0`:

| Package | What it is |
|---|---|
| [`@zodal/graph-core`](packages/graph-core) | Canonical graph data model, capabilities vocabulary, serializer, pure adapters, `defineGraph` |
| [`@zodal/graph-ui`](packages/graph-ui) | Schema↔render mapping registries with capability-ranked, rank-and-degrade renderer selection |
| [`@zodal/graph-layout`](packages/graph-layout) | Renderer-agnostic layout engine (layered-by-rank, radial/ego, swimlane, circular) |
| [`@zodal/graph-runtime`](packages/graph-runtime) | In-browser dataflow execution engine for func graphs (topo run, step, incremental recompute) |
| [`@zodal/graph-compute`](packages/graph-compute) | Renderer-agnostic graph-theory and provenance overlay engine (computed once on the graphology hub) |
| [`@zodal/graph-sigma`](packages/graph-sigma) | Large-sparse WebGL viz renderer (sigma.js over the graphology hub) |
| [`@zodal/graph-react-flow`](packages/graph-react-flow) | React Flow typed-port editor renderer (connection validation driven by canonical port types) |
| [`@zodal/graph-table`](packages/graph-table) | Table / matrix / form lenses — data shaping + TanStack table + heat-cell matrix |
| [`@zodal/graph-timeline`](packages/graph-timeline) | ELAN-style interval-tier timeline — rational time, half-open intervals, Allen's 13 relations |

See [`docs/dev-plan.md`](docs/dev-plan.md) for what's built vs. planned per horizon, and the
[issues](../../issues) for what's next (e.g. cross-lens brushing/selection, #30).

## Contents

**Design intent**
- [`docs/zodal-graph-concept.md`](docs/zodal-graph-concept.md) — the concept: what zodal-graph is and its three-layer model (Model → Affordances → Targets).
- [`docs/graph-affordances-analysis.md`](docs/graph-affordances-analysis.md) — the affordance analysis across twelve graph/timeline subjects ("File 1").
- [`docs/graph-zodal-deep-research-prompts.md`](docs/graph-zodal-deep-research-prompts.md) — the six deep-research prompts (P1–P6).
- [`docs/research/`](docs/research/) — the research reports and decisions.

**Planning & toolkit**
- [`docs/research_guide.md`](docs/research_guide.md) — routing index: *when to read which* research doc (doc → purpose → trigger).
- [`docs/dev-plan.md`](docs/dev-plan.md) — the phased, horizon-graded development plan (living).
- [`.claude/CLAUDE.md`](.claude/CLAUDE.md) + [`skills/`](skills/) — the agent dev guide and the `zodal-graphs-dev-*` skills that drive the build.

## Start here

**[`docs/research/README.md`](docs/research/README.md)** is the entry point: the file-naming convention, a status table, and the consolidated tool-decision table (the "money summary"). To find the right deep doc for a task, use **[`docs/research_guide.md`](docs/research_guide.md)**; to see what gets built next, read **[`docs/dev-plan.md`](docs/dev-plan.md)**. For the merge rationale and conflict resolutions, see [`docs/research/_reconciliation.md`](docs/research/_reconciliation.md); for shared grounding, [`docs/research/_grounding-brief.md`](docs/research/_grounding-brief.md).

Reports are named `zgraph_NN<a|b>` — `a` = Claude AI deep-research survey, `b` = Claude Code grounded report. P1/P2 are `b`-only; P3 is `a`-only (grounded during reconciliation); P4/P5/P6 have both.

See the [issues](../../issues) for the design/build backlog and [discussions](../../discussions) for decision records.
