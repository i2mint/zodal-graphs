/**
 * The graphology adapter, exposed on its own entry point (`@zodal/graph-core/graphology`) so
 * the main barrel stays free of the optional `graphology` peer dependency. Import this only
 * when you need to bridge to graphology / sigma.js / `@zodal/graph-compute`.
 */

export { toGraphology, fromGraphology } from './adapters/graphology.js';
