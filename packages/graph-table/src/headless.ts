/**
 * The React-free core of @zodal/graph-table, importable without React or TanStack.
 *
 * Renderer-agnostic data shaping: turn a canonical graph into table rows + columns, an adjacency
 * matrix with seriation, and the view-switching state that lets one graph move between lenses while
 * selection/filters stay shared. Use `@zodal/graph-table/headless` for the shaping + registry entry
 * factories without pulling React; the root entry adds the `<GraphTable>` / `<GraphMatrix>` components.
 */

export * from './rows.js';
export * from './matrix.js';
export * from './views.js';
export * from './capabilities.js';
