/**
 * @zodal/graph-table — the table / matrix / form lenses for zodal-graphs (the "not-a-graph" surfaces).
 *
 * Renderer-agnostic data shaping: turn a canonical graph into table rows + columns, an adjacency
 * matrix with seriation, and the view-switching state that lets one graph move between lenses while
 * selection/filters stay shared. Pure and headless (no React / TanStack); a consumer renders the
 * shaped data with TanStack Table / a heat-cell grid / a shadcn form, and registers the lenses into
 * a `@zodal/graph-ui` registry via the entry factories here.
 */

export * from './rows.js';
export * from './matrix.js';
export * from './views.js';
export * from './capabilities.js';
