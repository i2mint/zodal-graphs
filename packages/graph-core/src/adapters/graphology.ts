/**
 * graphology adapter — the near-identity round-trip and the foundation for compute.
 *
 * graphology's `Graph` is the canonical model's closest neighbour: it is also the backend
 * `@zodal/graph-compute` (and sigma.js) runs on, so this adapter is "free" — ports ride as
 * inert edge attributes (the algorithm layer never looks at them). Edge keys are the canonical
 * edge ids, so multi-edges between the same pair (different ports) survive.
 *
 * `graphology` is an optional peer dependency: import this module only when you need it.
 */

import Graph from 'graphology';
import type { CanonicalGraph, GraphNode, GraphEdge, GraphMeta } from '../model.js';
import { nodeId, edgeId } from '../model.js';
import { compact } from './shared.js';

const META_ATTR = 'zodal:graphMeta';

/** Build a graphology `Graph` from the canonical model (ports become inert edge attributes). */
export function toGraphology(graph: CanonicalGraph): Graph {
  const g = new Graph({
    type: graph.directed ? 'directed' : 'undirected',
    multi: graph.multigraph,
    allowSelfLoops: true,
  });
  g.setAttribute(META_ATTR, graph.graph);

  for (const node of graph.nodes) {
    g.addNode(
      node.id,
      compact({
        kind: node.kind,
        type: node.type,
        ports: node.ports,
        funcRef: node.funcRef,
        data: node.data,
        position: node.position,
      }),
    );
  }

  for (const edge of graph.edges) {
    g.addEdgeWithKey(
      edge.id,
      edge.source,
      edge.target,
      compact({
        sourcePort: edge.sourcePort,
        targetPort: edge.targetPort,
        type: edge.type,
        data: edge.data,
      }),
    );
  }

  return g;
}

/** Read a graphology `Graph` back into the canonical model. */
export function fromGraphology(g: Graph): CanonicalGraph {
  const meta = (g.getAttribute(META_ATTR) as GraphMeta | undefined) ?? {};

  const nodes: GraphNode[] = [];
  g.forEachNode((key, attrs: Record<string, unknown>) => {
    nodes.push(
      compact({
        id: nodeId(key),
        kind: attrs.kind as GraphNode['kind'],
        type: attrs.type,
        ports: attrs.ports,
        funcRef: attrs.funcRef,
        data: attrs.data,
        position: attrs.position,
      }) as GraphNode,
    );
  });

  const edges: GraphEdge[] = [];
  g.forEachEdge((key, attrs: Record<string, unknown>, source, target) => {
    edges.push(
      compact({
        id: edgeId(key),
        source: nodeId(source),
        target: nodeId(target),
        sourcePort: attrs.sourcePort,
        targetPort: attrs.targetPort,
        type: attrs.type,
        data: attrs.data,
      }) as GraphEdge,
    );
  });

  return {
    directed: g.type !== 'undirected',
    multigraph: g.multi,
    nodes,
    edges,
    graph: meta,
  };
}
