# @zodal/graph-ui

> The renders + schema↔render mappings registries for **zodal-graphs** — capability-ranked,
> rank-and-degrade renderer selection. Headless.

`@zodal/graph-ui` decides *which* renderer should draw a graph, given what the graph declares it
needs (`GraphCapabilities`) and what each renderer honestly supports (`RendererCapabilities`). It
stores opaque renderer payloads (e.g. React components) and never inspects them — concrete
renderers live in their own packages (`@zodal/graph-react-flow`, `@zodal/graph-sigma`, …) and
register here.

## Install

```bash
pnpm add @zodal/graph-ui
```

`@zodal/graph-core` comes transitively (it's a regular dependency). If you also call
`defineGraph` from `@zodal/graph-core` directly, install its peers too: `@zodal/core` and `zod`.

## The idea

One registry serves both the **renders** registry and the **schema↔render mappings** — the
mappings *are* the testers you register. A tester scores how well a renderer fits the graph; the
registry picks the highest score and **degrades honestly**, reporting what the winner can't do.

```ts
import { createGraphRendererRegistry, makeTester, PRIORITY, isTypedPortGraph, wantsEditing, scaleAtMost, scaleAtLeast } from '@zodal/graph-ui';

const registry = createGraphRendererRegistry<MyComponent>();

registry.register({
  name: 'react-flow',
  renderer: ReactFlowView,
  capabilities: { renderer: 'react-flow', typedPorts: true, editing: true, maxComfortableNodes: 2000, /* … */ },
  tester: makeTester({
    eligible: scaleAtMost(2000),
    base: PRIORITY.DEFAULT,
    bonuses: [[isTypedPortGraph, PRIORITY.LIBRARY], [wantsEditing, PRIORITY.LIBRARY]],
  }),
});

registry.register({
  name: 'sigma',
  renderer: SigmaView,
  capabilities: { renderer: 'sigma', typedPorts: false, editing: false, maxComfortableNodes: 100_000, /* … */ },
  tester: makeTester({ base: PRIORITY.DEFAULT, bonuses: [[scaleAtLeast(2000), PRIORITY.LIBRARY]] }),
});

const sel = registry.select(graphDef.getCapabilities(), { nodeCount: 50_000, intent: 'explore' });
// → { renderer: SigmaView, score: …, degraded: ['typedPorts', 'editing'] }
//   (a huge graph forces the viz renderer; editing + typed ports are honestly dropped)
```

## API

| Export | What it does |
|---|---|
| `createGraphRendererRegistry<T>()` | factory → `{ register, resolve, select, explain, entries }` |
| `makeTester({ eligible, base, bonuses })` | author a tester declaratively |
| predicates: `isTypedPortGraph`, `wantsEditing`, `isExecutable`, `hasProvenance`, `hasIntervals`, `scaleAtMost(n)`, `scaleAtLeast(n)`, `viewIs(v)`, `supportsView(v)` | compose with `allOf` / `anyOf` / `not` |
| `PRIORITY` | named bands (`FALLBACK` → `OVERRIDE`); `INELIGIBLE` = -1 |
| `computeGaps` / `CapabilityGap` | the degrade report |

`resolve()` returns the renderer payload; `select()` adds the `degraded` report; `explain()`
returns the full ranking (why a renderer won). Ties resolve to the first-registered entry.

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo. Mirrors zodal's `@zodal/ui`
renderer-registry pattern.
