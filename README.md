# zodal-graphs

> A declarative layer where graph *affordances* are expressed once and mapped — in many ways, against many targets — to UIs, storage, and graph databases. The graph specialization of `zodal`.

This repository currently holds the **research & design phase** for zodal-graph — there is no implementation code yet. The goal of the research was to choose and design the modern, well-maintained tooling for a Zod-v4 schema-driven, renderer-agnostic graph-UI facade, with a strong bias toward reusing existing libraries rather than building from scratch.

## Contents

- [`docs/zodal-graph-concept.md`](docs/zodal-graph-concept.md) — the concept: what zodal-graph is and its three-layer model (Model → Affordances → Targets).
- [`docs/graph-affordances-analysis.md`](docs/graph-affordances-analysis.md) — the affordance analysis across twelve graph/timeline subjects ("File 1").
- [`docs/graph-zodal-deep-research-prompts.md`](docs/graph-zodal-deep-research-prompts.md) — the six deep-research prompts (P1–P6).
- [`docs/research/`](docs/research/) — the research reports and decisions.

## Start here

**[`docs/research/README.md`](docs/research/README.md)** is the entry point: the file-naming convention, a status table, and the consolidated tool-decision table (the "money summary"). For the merge rationale and conflict resolutions, see [`docs/research/_reconciliation.md`](docs/research/_reconciliation.md); for shared grounding, [`docs/research/_grounding-brief.md`](docs/research/_grounding-brief.md).

Reports are named `zgraph_NN<a|b>` — `a` = Claude AI deep-research survey, `b` = Claude Code grounded report. P1/P2 are `b`-only; P3 is `a`-only (grounded during reconciliation); P4/P5/P6 have both.

See the [issues](../../issues) for the design/build backlog and [discussions](../../discussions) for decision records.
