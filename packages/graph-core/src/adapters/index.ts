/**
 * Dependency-free adapters barrel. The graphology adapter is exposed separately (via the
 * `@zodal/graph-core/graphology` subpath) so importing the canonical model never pulls in
 * graphology. React Flow and ELK adapters are pure object transforms with no runtime deps.
 */

export * from './react-flow.js';
export * from './elk.js';
