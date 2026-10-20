/**
 * @zodal/graph-ui — the renders + schema↔render mappings registries for zodal-graphs.
 *
 * Headless and renderer-agnostic: it ranks and selects an opaque renderer payload from a graph's
 * declared `GraphCapabilities` (via `defineGraph`) and a renderer's honest `RendererCapabilities`,
 * degrading gracefully and reporting what was dropped. Concrete renderers (React Flow, sigma,
 * TanStack table, …) live in their own packages and register here.
 *
 * Exports:
 *  - `createGraphRendererRegistry` + entry/selection types — the capability-ranked registry
 *  - `makeTester` + composable predicates — author the schema↔render mappings declaratively
 *  - `PRIORITY` bands, `GraphRenderContext`, `computeGaps` / `CapabilityGap` — the supporting vocabulary
 *  - `createGraphViewStore` + pure transitions/projections — the shared view state (active view,
 *    selection, per-owner filters, hover) that links every lens, and `linkedOverlays` to draw it
 */

export * from './priority.js';
export * from './context.js';
export * from './testers.js';
export * from './gaps.js';
export * from './registry.js';
export * from './view-state.js';
