# @zodal/graph-timeline

> The bespoke **ELAN-style interval-tier timeline** for zodal-graphs — rational time, half-open
> intervals, and Allen's 13 relations.

The research's other genuinely-new module (alongside `portTypeCompatible`): **no JS/TS library**
renders multi-tier interval annotations with Allen-relation queries, and none implements the 13
Allen relations natively. This is the hand-written glue — a rational-time interval model + the
relation algebra + ELAN tier stereotypes — with a thin visx shell on top.

## Install

```bash
pnpm add @zodal/graph-timeline @visx/scale react
```

`@zodal/graph-core` and `@zodal/graph-ui` come transitively; `@visx/scale` and `react` are peers.

## Headless core (no React/visx) — `@zodal/graph-timeline/headless`

```ts
import { interval, allen, intersects, relate } from '@zodal/graph-timeline/headless';

allen(interval(0, 3), interval(3, 6));          // 'meets'  (half-open: touching, no overlap)
allen(interval({ v: 0, r: 48000 }, { v: 1234, r: 48000 }), interval({ v: 1234, r: 48000 }, { v: 2000, r: 48000 }));
//                                              // sample-accurate rational time → 'meets'
intersects(interval(5, 5), interval(3, 8));     // true — an instant at 5 is inside [3, 8)

import { toTimeline, annotationsInWindow, annotationsRelated, validateTiers } from '@zodal/graph-timeline/headless';

const model = toTimeline(graph);                 // nodes with data { tier, start, end } → tiers + annotations
annotationsInWindow(model, interval(2, 7));      // brushing
annotationsRelated(model, interval(0, 5), ['during']); // Allen-relation query
validateTiers(model.tiers, model.annotations);   // ELAN stereotype checks (included-in / subdivision)

registry.register(createTimelineRendererEntry(TimelineView)); // wins by OVERRIDE for an interval graph
```

## React shell (thin)

```tsx
import { TimelineView } from '@zodal/graph-timeline';

<TimelineView graph={graph} window={interval(2, 7)} width={800} height={300} />;
```

Tiers become lanes (`scaleBand`), annotations become time-positioned rects (`scaleLinear`); the
optional `window` marks intersecting annotations.

## Scope (this checkpoint)

**Built + tested:** rational `{v,r}` time, half-open intervals, **Allen's 13 relations** (+ `inverse`,
`relate`, instant-correct `intersects`), the five ELAN tier stereotypes + containment/disjointness
validation, timeline data shaping + window / relation queries + extent, and the OVERRIDE registry
entry. **Thin shell:** `TimelineView` (typecheck + build only). **Deferred:** real brushing
(`@visx/brush`), zoom, tier labels + the rational-time axis, large-dataset interval-tree indexing
(currently a linear scan), and Allen-relation composition.

## Status

Pre-1.0, under active development. Part of the zodal-graphs monorepo.
