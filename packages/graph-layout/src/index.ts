/**
 * @zodal/graph-layout — a renderer-agnostic layout engine.
 *
 * `layout(graph, spec)` turns a `GraphLayout` hint (from `@zodal/graph-core`'s presentation layer)
 * into node positions; `applyLayout` returns a `GraphLayout` with those positions filled. Layered
 * (DAG ranks), radial (ego rings), swimlane (lanes by a field) and circular are built in;
 * positions are renderer-agnostic so sigma / React Flow / etc. place nodes without reimplementing
 * layout. Dependency-free; reuses `@zodal/graph-compute` for ranking + ego rings.
 */

export * from './layout.js';
