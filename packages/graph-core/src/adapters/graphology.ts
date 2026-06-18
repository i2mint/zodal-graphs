/**
 * graphology adapter — the near-identity round-trip and the foundation for compute.
 *
 * graphology's `Graph` is the canonical model's closest neighbour: it is also the backend
 * `@zodal/graph-compute` (and sigma.js) runs on, so this adapter is "free" — ports ride as
 * inert edge attributes (the algorithm layer never looks at them). Edge keys are the canonical
 * edge ids, so multi-edges between the same pair (different ports) survive.
 *
 * Two correctness commitments:
 *  - The graphology graph is ALWAYS built as `multi: true` so a canonical graph that legitimately
 *    contains parallel / anti-parallel edges never makes `addEdgeWithKey` throw. The *original*
 *    `directed`/`multigraph` flags are preserved in a private graph attribute and restored on the
 *    way out (so `multigraph: false` round-trips even though the live graph is multi).
 *  - Mutable sub-objects (`ports`, `data`, graph meta) are DEEP-CLONED in and out, so the
 *    canonical model and the graphology graph never alias each other.
 *
 * `graphology` is an optional peer dependency: import this module only when you need it.
 */

import Graph from 'graphology';
import type { CanonicalGraph, GraphNode, GraphEdge, GraphPort, FuncRef, GraphMeta } from '../model.js';
import { nodeId, edgeId } from '../model.js';
import { compact, deepClone } from './shared.js';

const META_ATTR = 'zodal:graphMeta';
const FLAGS_ATTR = 'zodal:flags';

/** Build a graphology `Graph` from the canonical model (ports become inert edge attributes). */
export function toGraphology<N, E>(graph: CanonicalGraph<N, E>): Graph {
  const g = new Graph({
    type: graph.directed ? 'directed' : 'undirected',
    multi: true, // always multi internally; the real flag is preserved in FLAGS_ATTR
    allowSelfLoops: true,
  });
  g.setAttribute(META_ATTR, deepClone(graph.graph));
  g.setAttribute(FLAGS_ATTR, { directed: graph.directed, multigraph: graph.multigraph });

  for (const node of graph.nodes) {
    g.addNode(
      node.id,
      compact({
        kind: node.kind,
        type: node.type,
        ports: deepClone(node.ports),
        funcRef: deepClone(node.funcRef),
        data: deepClone(node.data),
        position: node.position ? { ...node.position } : undefined,
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
        data: deepClone(edge.data),
      }),
    );
  }

  return g;
}

/** Read a graphology `Graph` back into the canonical model. */
export function fromGraphology<N, E>(g: Graph): CanonicalGraph<N, E> {
  const meta = deepClone((g.getAttribute(META_ATTR) as GraphMeta | undefined) ?? {});
  const flags = g.getAttribute(FLAGS_ATTR) as { directed: boolean; multigraph: boolean } | undefined;

  const nodes: GraphNode<N>[] = [];
  g.forEachNode((key, attrs: Record<string, unknown>) => {
    nodes.push(
      compact({
        id: nodeId(key),
        kind: attrs.kind as GraphNode['kind'],
        type: attrs.type as string | undefined,
        ports: deepClone(attrs.ports as GraphPort[] | undefined),
        funcRef: deepClone(attrs.funcRef as FuncRef | undefined),
        data: deepClone(attrs.data as N | undefined),
        position: attrs.position as { x: number; y: number } | undefined,
      }),
    );
  });

  const edges: GraphEdge<E>[] = [];
  g.forEachEdge((key, attrs: Record<string, unknown>, source, target) => {
    edges.push(
      compact({
        id: edgeId(key),
        source: nodeId(source),
        target: nodeId(target),
        sourcePort: attrs.sourcePort as string | undefined,
        targetPort: attrs.targetPort as string | undefined,
        type: attrs.type as string | undefined,
        data: deepClone(attrs.data as E | undefined),
      }),
    );
  });

  return {
    directed: flags?.directed ?? g.type !== 'undirected',
    multigraph: flags?.multigraph ?? g.multi,
    nodes,
    edges,
    graph: meta,
  };
}
