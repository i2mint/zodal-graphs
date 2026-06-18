---
name: zodal-graphs-dev-registries
description: Use when working on any of the THREE zodal-graphs plugin registries — affordances/schemas, renders, and schema↔render mappings — or how in-house and third-party/agent-authored plugins register against them. Triggers when adding or changing a node/edge/port affordance, a renderer entry, a capability-ranked renderer tester, the PRIORITY bands, the affordance registry (WeakMap/identity-keyed/register-before-wrap), the rank-and-degrade selection rule, or defineGraph's getCapabilities wiring. Read BEFORE adding a renderer or affordance so it plugs into the open-closed registration API instead of hard-coding.
metadata:
  audience: developers
---

# zodal-graphs · the three registries

zodal-graphs is built on **three plugin registries with one registration discipline**, so
in-house, third-party, and agent-authored plugins all extend the system without modifying
it (SSOT + open-closed). All three follow zodal's proven patterns — **mirror them, don't
reinvent.** The reference implementations live in the `zodal` monorepo (files routed below).

## The three registries

| Registry | What it holds | Extends zodal's | Selection key |
|---|---|---|---|
| **Affordances / schemas** | per-node/edge/port field affordances + graph-level capabilities | `affordanceRegistry` (`@zodal/core`) | object identity (WeakMap) |
| **Renders** | renderer entries (a renderer + a tester) | `RendererRegistry` (`@zodal/ui`) | max tester score |
| **Schema ↔ render mappings** | the graph-aware **testers** that map declared `GraphCapabilities` + runtime signals → a renderer | the testers IN `RendererRegistry` | PRIORITY band returned by the tester |

> The third registry is **not** a separate data structure — it is the population of
> graph-aware **testers** registered into the renders registry. "Mapping" = "which tester
> fires for which capability profile." Keep this framing; it's why one registration API
> serves all three concerns.

## Pattern 1 — capability-ranked renderer registry (renders + mappings)

`createGraphRendererRegistry<TComponent>()` closes over a private `entries[]`.
`register(entry)` only **pushes** (order-independent → adding a renderer never edits
existing ones). `resolve(graphCaps, context)` runs **every** tester and keeps the single
highest score; ties resolve to the **first-registered** entry (strict `>`). `explain(...)`
returns all `{renderer, score, name}` sorted desc for debugging *why* a renderer won.

```ts
RendererEntry<T> = { tester: (caps, context) => number, renderer: T, name?: string }
```

- **Testers are pure functions** returning a **PRIORITY band**, never a magic number:
  `PRIORITY = { FALLBACK:1, DEFAULT:10, LIBRARY:50, APP:100, OVERRIDE:200 } as const`.
- Compose with `and()` (SUMS scores; `-1` if any sub-tester fails) and `or()` (MAX). A
  compound match can exceed a single band (e.g. `DEFAULT+LIBRARY=60`) — keep band
  arithmetic in mind so compounds don't accidentally outrank an `OVERRIDE`.
- **Rank-and-degrade:** specialization outscores generics. The graph selection rule:
  React Flow when `typedPorts && validatesConnections && canEditNode && scaleClass==='small'`
  (OVERRIDE/APP band); fall back to sigma/cosmos as `scaleClass` rises and editing drops;
  degrade to TanStack-Table when node-link adds nothing. When forced to a massive-scale
  renderer, **drop editing** (it can't draw ports) — report that honestly via
  `RendererCapabilities`.
- Always register a **FALLBACK** entry (`tester: () => PRIORITY.FALLBACK`) — `resolve()`
  returns `null` if nothing scores `> -1`.
- The registry is **user-supplied, not a forced global singleton** (avoids singleton
  conflicts). A default convenience instance is fine; private instances must be possible.
- Make the registry **generic over the node/edge component type** — it stores opaque
  `TComponent` and never inspects it.

Renderer-selection rules to seed (from the research):
- `hasIntervals && view!=='node-link'` → Timeline renderer (OVERRIDE).
- `executable && watchesValues && scaleClass==='small'` → React Flow value-watch.
- `executable && !watchesValues && canStep && linear` → stepper + form.

## Pattern 2 — identity-keyed affordance registry (affordances/schemas)

`createGraphAffordanceRegistry()` closes over a `WeakMap<z.ZodType, Partial<…>>`, keyed by
**object identity** (two `z.string()` calls are different keys). `get()` peels
`optional/nullable/default` wrappers via `schema._zod.def.innerType` to find metadata
registered on the inner schema. This is the mechanism that lets `.meta()` metadata survive
wrapping — **register on the inner schema BEFORE wrapping** (see
`zodal-graphs-dev-canonical-model` for the Zod-v4 gotchas). `clear()` is a documented no-op
on a WeakMap — to reset, make a fresh registry.

## Satellite registration (how a plugin package preloads)

A satellite (e.g. a third-party renderer pack) exports a `create<Lib>GraphRegistry()`
factory that instantiates the core registry, spreads pre-authored `RendererEntry[]` arrays,
and `register()`s each — and also exports the individual arrays for selective use. Mirror
this two-tier shape: **core defines the registry + tester contract; satellites author entry
arrays + a preload factory.** This is the open-closed seam that lets agents author plugins.

## Conventions (non-negotiable, from zodal)

- **Factory functions, never classes.** `createGraphRendererRegistry()` returns a plain
  object literal over a closure. No `new`, no `class`.
- Named PRIORITY bands, not literals. Mode-discriminated `context` for runtime signals
  (e.g. `mode: 'node'|'edge'|'layout'`), with an open `[key:string]: unknown` index for
  extension. Typos in open keys fail silently (`-1`) — consider a typed accessor.
- ESM `.js` extensions on all internal imports; `import type` for type-only (verbatimModuleSyntax).

## Docs & files routed into this skill

- **Reference implementations to copy** (in the `zodal` repo):
  - `zodal/packages/ui/src/registry/tester.ts` — PRIORITY bands + composable predicates + `and()/or()`.
  - `zodal/packages/ui/src/registry/registry.ts` — `createRendererRegistry` with `resolve()`/`explain()`.
  - `zodal/packages/core/src/registry.ts` — the identity-keyed affordance registry (WeakMap + `unwrapAndFind`).
  - `zodal-ui-shadcn/src/registry.ts` — how a satellite preloads `create<Lib>Registry()`.
- **Capability vocabularies + selection rule:** `docs/research/zgraph_04b…md` (P4).
- Find anything else via `/zodal-graphs-dev-research-lookup`.

## Maintenance

When you add a new capability to `GraphCapabilities` or a new renderer, add/adjust the
tester here and in the code together, and update the selection-rule list above. Keep this
skill in sync with the actual testers — drift here causes wrong renderer selection.
