/**
 * `defineGraph` — the declarative facade entry point (skeleton).
 *
 * Analogous to zodal's `defineCollection`: declare a graph's node/edge types (Zod schemas) and
 * its graph-level affordances once, and get a `GraphDefinition` that reports honest
 * {@link GraphCapabilities}. The capabilities then drive renderer selection (Horizon 2,
 * `@zodal/graph-ui`).
 *
 * This is the checkpoint-1 skeleton: it resolves graph-level capabilities from declared
 * affordances. Per-field / per-port affordance inference (reusing zodal's `defineCollection`
 * inference + the affordance registry) lands with the generators in Horizon 2.
 */

import type { ZodType } from 'zod';
import type { GraphCapabilities, GraphView, TraversalKind, ScaleClass } from './capabilities.js';
import { resolveGraphCapabilities } from './capabilities.js';

/** Declares an edge type and which node types it connects. `portAware` ⇒ edges bind to ports. */
export interface EdgeTypeDef {
  source: string;
  target: string;
  portAware?: boolean;
}

/** Graph-level affordances — the declarative knobs that resolve to {@link GraphCapabilities}. */
export interface GraphAffordances {
  editable?: boolean;
  typedPorts?: boolean;
  executable?: boolean;
  canStep?: boolean;
  watchesValues?: boolean;
  provenance?: boolean;
  canTimeTravel?: boolean;
  canExtractSubgraph?: boolean;
  canCollapseToComponent?: boolean;
  traversal?: TraversalKind[];
  views?: GraphView[];
  defaultView?: GraphView;
  scaleClass?: ScaleClass;
  hasIntervals?: boolean;
}

export interface DefineGraphConfig {
  nodeTypes: Record<string, ZodType>;
  edgeTypes?: Record<string, EdgeTypeDef>;
  affordances?: GraphAffordances;
}

export interface GraphDefinition {
  nodeTypes: Record<string, ZodType>;
  edgeTypes: Record<string, EdgeTypeDef>;
  affordances: GraphAffordances;
  getCapabilities(): GraphCapabilities;
}

/** Build a {@link GraphDefinition} from declared node/edge types + affordances. */
export function defineGraph(config: DefineGraphConfig): GraphDefinition {
  const affordances = config.affordances ?? {};
  const edgeTypes = config.edgeTypes ?? {};

  const portAwareEdges = Object.values(edgeTypes).some((e) => e.portAware === true);
  const typedPorts = affordances.typedPorts ?? portAwareEdges;
  const editable = affordances.editable ?? false;
  const executable = affordances.executable ?? false;

  const capabilities = resolveGraphCapabilities({
    canAddNode: editable,
    canDeleteNode: editable,
    canEditNode: editable,
    canAddEdge: editable,
    canDeleteEdge: editable,
    canReverseEdge: editable,
    typedPorts,
    // We validate connections exactly when ports are typed (else there is nothing to check).
    validatesConnections: typedPorts,
    canExtractSubgraph: affordances.canExtractSubgraph ?? false,
    canCollapseToComponent: affordances.canCollapseToComponent ?? false,
    executable,
    canStep: affordances.canStep ?? executable,
    watchesValues: affordances.watchesValues ?? false,
    hasProvenance: affordances.provenance ?? false,
    canTimeTravel: affordances.canTimeTravel ?? false,
    traversal: affordances.traversal ?? [],
    views: resolveViews(affordances),
    scaleClass: affordances.scaleClass ?? 'small',
    hasIntervals: affordances.hasIntervals ?? false,
  });

  return {
    nodeTypes: config.nodeTypes,
    edgeTypes,
    affordances,
    getCapabilities: () => capabilities,
  };
}

/** Resolve the available views: explicit list wins; otherwise derive from affordances. */
function resolveViews(affordances: GraphAffordances): GraphView[] {
  if (affordances.views && affordances.views.length > 0) {
    return dedupeViews(affordances.views, affordances.defaultView);
  }
  const views: GraphView[] = ['node-link', 'table'];
  if (affordances.editable) views.push('form');
  if (affordances.hasIntervals) views.push('timeline');
  return dedupeViews(views, affordances.defaultView);
}

/** Put `defaultView` first (if given) and drop duplicates, preserving order. */
function dedupeViews(views: GraphView[], defaultView?: GraphView): GraphView[] {
  const ordered = defaultView ? [defaultView, ...views] : views;
  return [...new Set(ordered)];
}
