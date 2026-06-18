/**
 * React Flow adapter — pure data, no `@xyflow/react` import.
 *
 * React Flow's controlled `{ nodes, edges }` arrays map ~1:1 onto the canonical model: a port
 * becomes a typed handle whose `id` equals the port name, so `sourceHandle === sourcePort` and
 * `targetHandle === targetPort` (the field flat node-link formats drop). These adapters emit /
 * accept plain objects shaped like React Flow's, so `@zodal/graph-core` stays renderer-free;
 * `@zodal/graph-react-flow` supplies the actual components + `isValidConnection`.
 *
 * React Flow itself has no slot for `directed`/`multigraph`/graph-meta, so those ride in a
 * namespaced `zodal` block on the returned object and are restored on the way back (rather than
 * being silently defaulted). React Flow also fuses presentation (`selected`, `dragging`) into
 * its node objects — `fromReactFlow` is the boundary that strips that runtime state back out; it
 * is NOT topology and never enters the canonical model. (Positions are a layout hint carried on
 * `node.position`.)
 */

import type { CanonicalGraph, GraphNode, GraphEdge, GraphPort, FuncRef, GraphMeta } from '../model.js';
import { nodeId, edgeId } from '../model.js';
import { compact } from './shared.js';

/** The custom payload carried in a React Flow node's `data` bag. */
export interface ReactFlowNodeData<N = unknown> {
  kind: GraphNode['kind'];
  ports?: GraphPort[];
  funcRef?: FuncRef;
  /** The canonical node's own `data`. */
  nodeData?: N;
}

export interface ReactFlowNode<N = unknown> {
  id: string;
  type?: string;
  /** Optional here (the canonical model treats it as a hint); a real render needs it filled. */
  position?: { x: number; y: number };
  data: ReactFlowNodeData<N>;
  /** Runtime presentation state — ignored by `fromReactFlow`. */
  selected?: boolean;
  dragging?: boolean;
}

export interface ReactFlowEdge<E = unknown> {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: E;
  selected?: boolean;
}

export interface ReactFlowGraph<N = unknown, E = unknown> {
  nodes: ReactFlowNode<N>[];
  edges: ReactFlowEdge<E>[];
  /** Structural flags + graph meta React Flow has no native slot for; restored by `fromReactFlow`. */
  zodal?: { directed: boolean; multigraph: boolean; graph: GraphMeta };
}

/** Convert the canonical model to React-Flow-shaped plain objects (handle id = port name). */
export function toReactFlow<N, E>(graph: CanonicalGraph<N, E>): ReactFlowGraph<N, E> {
  const nodes: ReactFlowNode<N>[] = graph.nodes.map((node) => {
    const out: ReactFlowNode<N> = {
      id: node.id,
      data: compact({
        kind: node.kind,
        ports: node.ports,
        funcRef: node.funcRef,
        nodeData: node.data,
      }),
    };
    if (node.type !== undefined) out.type = node.type;
    if (node.position !== undefined) out.position = node.position;
    return out;
  });

  const edges: ReactFlowEdge<E>[] = graph.edges.map((edge) =>
    compact({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourcePort,
      targetHandle: edge.targetPort,
      type: edge.type,
      data: edge.data,
    }),
  );

  return {
    nodes,
    edges,
    zodal: { directed: graph.directed, multigraph: graph.multigraph, graph: graph.graph },
  };
}

/** Read React-Flow-shaped objects back into the canonical model, dropping runtime presentation. */
export function fromReactFlow<N, E>(rf: ReactFlowGraph<N, E>): CanonicalGraph<N, E> {
  const nodes: GraphNode<N>[] = rf.nodes.map((node) => {
    const d = node.data ?? ({ kind: 'entity' } as ReactFlowNodeData<N>);
    const out: GraphNode<N> = compact({
      id: nodeId(node.id),
      kind: d.kind ?? 'entity',
      type: node.type,
      ports: d.ports,
      funcRef: d.funcRef,
      data: d.nodeData,
      position: node.position,
    });
    // `selected` / `dragging` are intentionally dropped — presentation, not topology.
    return out;
  });

  const edges: GraphEdge<E>[] = rf.edges.map((edge) =>
    compact({
      id: edgeId(edge.id),
      source: nodeId(edge.source),
      target: nodeId(edge.target),
      sourcePort: edge.sourceHandle,
      targetPort: edge.targetHandle,
      type: edge.type,
      data: edge.data,
    }),
  );

  return {
    directed: rf.zodal?.directed ?? true,
    multigraph: rf.zodal?.multigraph ?? true,
    nodes,
    edges,
    graph: rf.zodal?.graph ?? {},
  };
}
