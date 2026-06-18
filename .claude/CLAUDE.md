# zodal-graphs — Agent Dev Guide

> **Stage:** design complete, **pre-implementation**. The repo currently holds research +
> design + this toolkit. No package code yet. The first build checkpoint is the **canonical
> data model (P4)**. See [`docs/dev-plan.md`](../docs/dev-plan.md) for the phased plan.

This file is the **index/map** for agents developing zodal-graphs — it routes you to the
skill or doc you need. It is *not* the content store: behavioral rules live here and in
skills; context and decisions live in named docs referenced from them. (Placement test:
*"if I deleted this sentence, would behavior change? If not, it belongs in a file."*)

## What zodal-graphs is

The **graph specialization of `zodal`**: declare a graph's shape + affordances once (Zod
v4), then map those affordances — many ways, against many targets — to UIs, storage, and
graph databases. Three layers: **Model → Affordances → Targets**. It **wraps** best-of-breed
libraries (React Flow, graphology, cosmos.gl, TanStack Table, …); it renders nothing and
runs no layout engine itself. See [`docs/zodal-graph-concept.md`](../docs/zodal-graph-concept.md).

It is part of the `_zodals` ecosystem — read the workspace guide at
`_zodals/.claude/CLAUDE.md` and the zodal architecture at `_zodals/zodal/.claude/CLAUDE.md`
for the substrate this extends.

## Architecture you must respect (SSOT, open-closed)

1. **One canonical model, three separate serializable layers** — topology /
   Zod-schema+affordances / presentation (overlays·styling·selection·layout). Never fuse
   presentation into topology. → skill `zodal-graphs-dev-canonical-model`.
2. **Three plugin registries, one registration API** — affordances/schemas, renders, and
   schema↔render mappings. In-house and third-party/agent-authored plugins register the same
   way (factory + tester + PRIORITY band). → skill `zodal-graphs-dev-registries`.
3. **Capability-ranked renderer selection** — `defineGraph` declares `GraphCapabilities`;
   renderers report `RendererCapabilities`; a ranked registry picks the renderer and
   **degrades honestly** (drop editing at large scale; fall back to table when node-link
   adds nothing). Mirrors zodal's `RendererRegistry` exactly.
4. **Monorepo, many lightweight packages** — develop all in-house affordances/renders/
   mappings in one monorepo; publish each as a separate tree-shakeable `@zodal/graph-*`
   package. → skill `zodal-graphs-dev-monorepo`.
5. **Wrap, don't rebuild** — only two genuinely-new modules: `portTypeCompatible` (Zod-v4
   subtyping → `isValidConnection`) and the bespoke interval timeline (visx + Allen relations).

## Zod v4 gotchas (apply everywhere)

- Pin **`zod` ≥ 4.1.13** (`z.union`→`anyOf`, `z.discriminatedUnion`→`oneOf`). Use
  `z.discriminatedUnion` for type tags.
- `z.toJSONSchema()` throws on unrepresentable types — keep the model in the representable subset.
- **Register-before-wrap:** `.meta()` returns a NEW instance; register on the inner schema
  via the affordance registry (WeakMap, object identity) before `.optional()/.array()/…`.
- Read internals via `schema._zod.def` (not `.shape`/`._def`).

## Dev skills (read the one that matches your task)

Skills live in repo-root `skills/<name>/` and are symlinked into `.claude/skills/`. Invoke
as `/zodal-graphs-dev-<name>`.

| Task | Skill |
|---|---|
| Canonical model / `defineGraph` / capabilities / adapters / Zod modeling | `zodal-graphs-dev-canonical-model` |
| The three registries / adding an affordance or renderer / selection rule | `zodal-graphs-dev-registries` |
| Repo structure / adding a package / build / **npm publish & CI** | `zodal-graphs-dev-monorepo` |
| Finding the right research doc / "what did we pick for X" | `zodal-graphs-dev-research-lookup` |

Each skill **routes the task-specific research docs into itself** — open the skill, not the
whole `docs/research/` tree.

## Key docs

- [`docs/dev-plan.md`](../docs/dev-plan.md) — the phased, horizon-graded development plan (living).
- [`docs/research_guide.md`](../docs/research_guide.md) — routing index for the research corpus.
- [`docs/research/README.md`](../docs/research/README.md) — the consolidated decision table.
- [`docs/zodal-graph-concept.md`](../docs/zodal-graph-concept.md) · [`docs/graph-affordances-analysis.md`](../docs/graph-affordances-analysis.md) — design intent.

## The skill-maintenance loop (keep doing this)

Dev skills are **living artifacts**, not write-once docs. Every session that develops
zodal-graphs is expected to keep the toolkit in sync with the plan and the build:

- **Create** a new `zodal-graphs-dev-<topic>` skill when a recurring dev task emerges that
  isn't covered above (author with `skill-creator`; follow `dev-skills-workflow`).
- **Revise** a skill the moment the code it describes changes — in the *same* change. Skill
  hygiene is part of the work.
- **Prune** an obsolete skill with a reversible marker: add `metadata.delete-after: <milestone>`
  to its frontmatter, then remove it once the milestone passes. (Find slated ones:
  `rg -l 'delete-after:' -g SKILL.md`.) Mark, don't hard-delete unilaterally.
- **Verify discoverability** after adding the first skill in a *new* skills dir: it only
  becomes invocable as `/zodal-graphs-dev-<name>` after a **session restart** (a newly
  created `.claude/skills/` isn't watched until restart; edits inside an already-watched dir
  hot-reload).
- Keep **this CLAUDE.md** as the map: route new task-specific docs *into* the skill that
  needs them; add a row to the skills table for each new skill; don't dump content here.

When the plan (`docs/dev-plan.md`) and the toolkit disagree, reconcile them — they evolve
hand-in-hand.

## Working conventions (from the zodal ecosystem)

- **Factory functions, never classes.** Headless: emit plain config objects, never DOM.
- Every module opens with a top-level docstring (auto-extracted for docs).
- ESM `.js` extensions on all internal imports; `import type` for type-only.
- **Branch discipline:** work on a branch; report the current branch at the start of work;
  switch back to the original branch when done unless told otherwise. Use a worktree when
  parallelizing.
- **Never publish to npm from your machine.** Publishing is CI-driven (`[publish]` commit
  marker on `main`) and gated on the owner's explicit approval for the first publish.
- **Privacy:** never write absolute local paths, secrets, or machine names into committed
  files, issues, PRs, or commit messages.
