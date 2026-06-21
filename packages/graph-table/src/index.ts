/**
 * @zodal/graph-table — the table / matrix / form lenses for zodal-graphs (the "not-a-graph" surfaces).
 *
 * Renderer-agnostic data shaping (rows + columns, adjacency matrix with seriation, view switching)
 * PLUS the React components that render them: `<GraphTable>` (TanStack Table) and `<GraphMatrix>`
 * (heat-cell grid). Register the lenses into a `@zodal/graph-ui` registry with the entry factories.
 *
 * This root entry pulls React + TanStack. For the React-free shaping core, import
 * `@zodal/graph-table/headless`.
 */

export * from './headless.js';
export * from './components.js';
