/**
 * ELK JSON adapter — port-aware interchange / layout hand-off.
 *
 * The ELK graph format (eclipse-layout-kernel / elkjs) is one of the few interchange formats
 * that is genuinely **port-aware**: a node declares `ports[]`, and an edge's `sources`/`targets`
 * reference a *port* endpoint, not just a node. That makes it the natural target for exercising
 * the canonical port contract and for delegating hierarchical layout.
 *
 * Port-level endpoints are encoded as `"<nodeId>::<portName>"`; the `::` separator is reserved
 * (node ids must not contain it). The full {@link GraphPort} rides on each ELK port's `zodal`
 * field so the round-trip is lossless. These are plain objects — no `elkjs` import.
 */

import type { CanonicalGraph, GraphNode, GraphEdge, GraphPort, FuncRef, GraphMeta } from '../model.js';
import { nodeId, edgeId } from '../model.js';
import { compact } from './shared.js';

const SEP = '::';

export interface ElkPort {
  id: string;
  zodal?: GraphPort;
}

export interface ElkNode {
  id: string;
  ports?: ElkPort[];
  x?: number;
  y?: number;
  zodal?: { kind: GraphNode['kind']; type?: string; funcRef?: FuncRef; data?: unknown };
}

export interface ElkEdge {
  id: string;
  sources: string[];
  targets: string[];
  zodal?: { type?: string; data?: unknown };
}

export interface ElkGraph {
  id: string;
  children: ElkNode[];
  edges: ElkEdge[];
  zodal?: { directed: boolean; multigraph: boolean; graph: GraphMeta };
}

const endpoint = (node: string, port?: string): string =>
  port === undefined ? node : `${node}${SEP}${port}`;

function parseEndpoint(ref: string): { node: string; port?: string } {
  const idx = ref.indexOf(SEP);
  if (idx === -1) return { node: ref };
  return { node: ref.slice(0, idx), port: ref.slice(idx + SEP.length) };
}

/** Convert the canonical model to a port-aware ELK graph (plain JSON). */
export function toELK(graph: CanonicalGraph, id = 'root'): ElkGraph {
  const children: ElkNode[] = graph.nodes.map((node) => {
    const out: ElkNode = {
      id: node.id,
      zodal: compact({
        kind: node.kind,
        type: node.type,
        funcRef: node.funcRef,
        data: node.data,
      }) as ElkNode['zodal'],
    };
    if (node.ports && node.ports.length > 0) {
      out.ports = node.ports.map((p) => ({ id: endpoint(node.id, p.port), zodal: p }));
    }
    if (node.position !== undefined) {
      out.x = node.position.x;
      out.y = node.position.y;
    }
    return out;
  });

  const edges: ElkEdge[] = graph.edges.map((edge) =>
    compact({
      id: edge.id,
      sources: [endpoint(edge.source, edge.sourcePort)],
      targets: [endpoint(edge.target, edge.targetPort)],
      zodal: compact({ type: edge.type, data: edge.data }),
    }) as ElkEdge,
  );

  return {
    id,
    children,
    edges,
    zodal: { directed: graph.directed, multigraph: graph.multigraph, graph: graph.graph },
  };
}

/** Read a port-aware ELK graph back into the canonical model. */
export function fromELK(elk: ElkGraph): CanonicalGraph {
  const nodes: GraphNode[] = elk.children.map((child) => {
    const z = child.zodal ?? { kind: 'entity' as const };
    const out: GraphNode = compact({
      id: nodeId(child.id),
      kind: z.kind ?? 'entity',
      type: z.type,
      funcRef: z.funcRef,
      data: z.data,
      ports: child.ports?.map((p) => p.zodal).filter((p): p is GraphPort => p !== undefined),
    }) as GraphNode;
    if (child.x !== undefined && child.y !== undefined) {
      out.position = { x: child.x, y: child.y };
    }
    return out;
  });

  const edges: GraphEdge[] = elk.edges.map((edge) => {
    const src = parseEndpoint(edge.sources[0] ?? '');
    const tgt = parseEndpoint(edge.targets[0] ?? '');
    return compact({
      id: edgeId(edge.id),
      source: nodeId(src.node),
      target: nodeId(tgt.node),
      sourcePort: src.port,
      targetPort: tgt.port,
      type: edge.zodal?.type,
      data: edge.zodal?.data,
    }) as GraphEdge;
  });

  return {
    directed: elk.zodal?.directed ?? true,
    multigraph: elk.zodal?.multigraph ?? true,
    nodes,
    edges,
    graph: elk.zodal?.graph ?? {},
  };
}
