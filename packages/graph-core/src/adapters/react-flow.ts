/**
 * React Flow adapter — pure data, no `@xyflow/react` import.
 *
 * React Flow's controlled `{ nodes, edges }` arrays map ~1:1 onto the canonical model: a port
 * becomes a typed handle whose `id` equals the port name, so `sourceHandle === sourcePort` and
 * `targetHandle === targetPort` (the field flat node-link formats drop). These adapters emit /
 * accept plain objects shaped like React Flow's, so `@zodal/graph-core` stays renderer-free;
 * `@zodal/graph-react-flow` supplies the actual components + `isValidConnection`.
 *
 * React Flow fuses presentation (`selected`, `dragging`) into its node objects. `fromReactFlow`
 * is the boundary that strips that runtime state back out — it is NOT topology and never enters
 * the canonical model. (Authoritative selection belongs in the presentation layer's
 * `GraphSelection`; positions are a layout hint carried on `node.position`.)
 */

import type { CanonicalGraph, GraphNode, GraphEdge, GraphPort, FuncRef } from '../model.js';
import { nodeId, edgeId } from '../model.js';
import { compact } from './shared.js';

/** The custom payload carried in a React Flow node's `data` bag. */
export interface ReactFlowNodeData {
  kind: GraphNode['kind'];
  ports?: GraphPort[];
  funcRef?: FuncRef;
  /** The canonical node's own `data`. */
  nodeData?: unknown;
}

export interface ReactFlowNode {
  id: string;
  type?: string;
  /** Optional here (the canonical model treats it as a hint); a real render needs it filled. */
  position?: { x: number; y: number };
  data: ReactFlowNodeData;
  /** Runtime presentation state — ignored by `fromReactFlow`. */
  selected?: boolean;
  dragging?: boolean;
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: unknown;
  selected?: boolean;
}

export interface ReactFlowGraph {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

/** Convert the canonical model to React-Flow-shaped plain objects (handle id = port name). */
export function toReactFlow(graph: CanonicalGraph): ReactFlowGraph {
  const nodes: ReactFlowNode[] = graph.nodes.map((node) => {
    const out: ReactFlowNode = {
      id: node.id,
      data: compact({
        kind: node.kind,
        ports: node.ports,
        funcRef: node.funcRef,
        nodeData: node.data,
      }) as ReactFlowNodeData,
    };
    if (node.type !== undefined) out.type = node.type;
    if (node.position !== undefined) out.position = node.position;
    return out;
  });

  const edges: ReactFlowEdge[] = graph.edges.map((edge) =>
    compact({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourcePort,
      targetHandle: edge.targetPort,
      type: edge.type,
      data: edge.data,
    }) as ReactFlowEdge,
  );

  return { nodes, edges };
}

/** Read React-Flow-shaped objects back into the canonical model, dropping runtime presentation. */
export function fromReactFlow(rf: ReactFlowGraph): CanonicalGraph {
  const nodes: GraphNode[] = rf.nodes.map((node) => {
    const d = node.data ?? ({ kind: 'entity' } as ReactFlowNodeData);
    return compact({
      id: nodeId(node.id),
      kind: d.kind ?? 'entity',
      type: node.type,
      ports: d.ports,
      funcRef: d.funcRef,
      data: d.nodeData,
      position: node.position,
    }) as GraphNode;
    // `selected` / `dragging` are intentionally dropped — presentation, not topology.
  });

  const edges: GraphEdge[] = rf.edges.map((edge) =>
    compact({
      id: edgeId(edge.id),
      source: nodeId(edge.source),
      target: nodeId(edge.target),
      sourcePort: edge.sourceHandle,
      targetPort: edge.targetHandle,
      type: edge.type,
      data: edge.data,
    }) as GraphEdge,
  );

  // `directed`/`multigraph` aren't carried by React Flow; default to directed multigraph,
  // which is the editor's working assumption. Callers that need the original flags should
  // round-trip through the serializer instead.
  return { directed: true, multigraph: true, nodes, edges, graph: {} };
}
