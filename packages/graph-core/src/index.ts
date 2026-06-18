/**
 * @zodal/graph-core — the canonical graph data model and declarative facade for zodal-graphs.
 *
 * Exports, by layer:
 *  - **topology**: `CanonicalGraph`, `GraphNode`, `GraphPort`, `GraphEdge`, branded ids, `FuncRef`/`FuncRefResolver`
 *  - **schema + affordances**: `defineGraph`, `GraphCapabilities`, `RendererCapabilities`, `portTypeCompatible`
 *  - **presentation**: `GraphOverlays`, `GraphStyling`, `GraphSelection`, `GraphLayout`
 *  - **serialization**: `toNodesAndLinks` / `fromNodesAndLinks` (the wire format)
 *  - **adapters**: React Flow + ELK (pure, dependency-free). The graphology adapter lives at
 *    the `@zodal/graph-core/graphology` subpath so the main entry stays graphology-free.
 */

export * from './model.js';
export * from './port-type.js';
export * from './capabilities.js';
export * from './presentation.js';
export * from './serialize.js';
export * from './define-graph.js';
export * from './adapters/index.js';
