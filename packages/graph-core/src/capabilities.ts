/**
 * Capability vocabularies — the honest-reporting contracts that drive renderer selection.
 *
 * `GraphCapabilities` is declared by a graph definition (and reported by a data provider):
 * "what is this graph and what can you do with it". `RendererCapabilities` is the mirror on
 * the renderer side: "what can I actually honor". A capability-ranked registry (see
 * `@zodal/graph-ui`, Horizon 2) compares the two and picks — and *degrades* — a renderer.
 *
 * Honesty is the rule (mirrors zodal's `ProviderCapabilities`): a renderer that cannot draw
 * ports MUST report `typedPorts: false` even if it scales to a million nodes —
 * `typedPorts` and `scaleClass` are orthogonal.
 */

/** The lenses a graph can be shown through. Reused as the `activeView` state field (P5). */
export type GraphView = 'node-link' | 'table' | 'matrix' | 'timeline' | 'form';

/** Graph-theory / provenance overlays a graph supports (computed by `@zodal/graph-compute`). */
export type TraversalKind =
  | 'path'
  | 'ancestors'
  | 'descendants'
  | 'stale'
  | 'critical-path'
  | 'cycles'
  | 'topological'
  | 'components'
  | 'community'
  | 'centrality';

/** Coarse size band. Device- and graph-shape-dependent — a default to benchmark, not a guarantee. */
export type ScaleClass = 'small' | 'medium' | 'large' | 'huge';

/**
 * Declared capabilities of a graph. Every flag defaults to the conservative (read-only,
 * portless, not-executable) value via {@link DEFAULT_GRAPH_CAPABILITIES}.
 */
export interface GraphCapabilities {
  // structural CRUD
  canAddNode: boolean;
  canDeleteNode: boolean;
  canEditNode: boolean;
  canAddEdge: boolean;
  canDeleteEdge: boolean;
  canReverseEdge: boolean;
  // typed ports
  typedPorts: boolean;
  validatesConnections: boolean;
  // composition
  canExtractSubgraph: boolean;
  canCollapseToComponent: boolean;
  // execution / dynamics
  executable: boolean;
  canStep: boolean;
  watchesValues: boolean;
  // provenance
  hasProvenance: boolean;
  canTimeTravel: boolean;
  // overlays & views
  traversal: TraversalKind[];
  views: GraphView[];
  scaleClass: ScaleClass;
  hasIntervals: boolean;
}

/** Conservative defaults — a read-only, portless, non-executable small graph shown as node-link/table. */
export const DEFAULT_GRAPH_CAPABILITIES: GraphCapabilities = {
  canAddNode: false,
  canDeleteNode: false,
  canEditNode: false,
  canAddEdge: false,
  canDeleteEdge: false,
  canReverseEdge: false,
  typedPorts: false,
  validatesConnections: false,
  canExtractSubgraph: false,
  canCollapseToComponent: false,
  executable: false,
  canStep: false,
  watchesValues: false,
  hasProvenance: false,
  canTimeTravel: false,
  traversal: [],
  views: ['node-link', 'table'],
  scaleClass: 'small',
  hasIntervals: false,
};

/** Where a renderer draws and where compute happens. */
export type RenderTech = 'svg' | 'canvas' | 'webgl';
export type RenderSide = 'client' | 'server' | 'hybrid';

/**
 * A renderer's honest self-description. The registry ranks these against a graph's
 * {@link GraphCapabilities} to pick (and degrade) a renderer — so every graph capability that a
 * renderer might fail to honor has a mirror field here, letting the degrade report be complete.
 */
export interface RendererCapabilities {
  renderer: string;
  typedPorts: boolean;
  /** Can enforce connect-time type validation (mirrors `GraphCapabilities.validatesConnections`). */
  validatesConnections: boolean;
  editing: boolean;
  compoundNodes: boolean;
  directed: boolean;
  undirected: boolean;
  multigraph: boolean;
  provenanceOverlay: boolean;
  /** Can show live dataflow values on the canvas (mirrors `watchesValues`). */
  watchesValues: boolean;
  /** Can render interval/timeline tiers (mirrors `hasIntervals` / the `timeline` view). */
  intervals: boolean;
  /** Which traversal/overlay kinds this renderer can draw (subset of `TraversalKind`). */
  traversalOverlays: TraversalKind[];
  /** Which views this renderer can present (subset of `GraphView`). */
  views: GraphView[];
  /** Node count above which this renderer stops being comfortable (a benchmark default). */
  maxComfortableNodes: number;
  /** Descriptive only at this checkpoint — not yet used in selection/degrade. */
  layoutEngines: string[];
  /** Descriptive only at this checkpoint. */
  rendering: RenderTech;
  /** Descriptive only at this checkpoint. */
  side: RenderSide;
}

/** Merge partial capabilities over the conservative defaults. */
export function resolveGraphCapabilities(
  partial: Partial<GraphCapabilities> = {},
): GraphCapabilities {
  return { ...DEFAULT_GRAPH_CAPABILITIES, ...partial };
}
