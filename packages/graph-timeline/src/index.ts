/**
 * @zodal/graph-timeline — the bespoke ELAN-style interval-tier timeline for zodal-graphs.
 *
 * The genuinely-new module the research flagged: no JS/TS library renders multi-tier interval
 * annotations with Allen-relation queries, and none implements the 13 Allen relations natively. This
 * provides rational `{v,r}` time, half-open intervals, the 13 Allen relations, ELAN tier stereotypes
 * + validation, timeline data shaping from a canonical graph, and the graph-ui registry entry
 * (timeline wins by OVERRIDE for an interval graph). Register it with `createTimelineRendererEntry`.
 *
 * This root entry pulls React + visx (the `TimelineView` shell). For the React-free core, import
 * `@zodal/graph-timeline/headless`.
 */

export * from './headless.js';
export * from './components.js';
