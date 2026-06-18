/**
 * ELK JSON adapter — port-aware interchange / layout hand-off.
 *
 * The ELK graph format (eclipse-layout-kernel / elkjs) is one of the few interchange formats
 * that is genuinely **port-aware**: a node declares `ports[]`, and an edge's `sources`/`targets`
 * reference a *port* endpoint, not just a node. That makes it the natural target for exercising
 * the canonical port contract and for delegating hierarchical layout.
 *
 * **Lossless by construction:** the authoritative endpoint (`source`/`target`/`sourcePort`/
 * `targetPort`) is carried structurally in each edge's `zodal` block, so it survives regardless
 * of node-id or port-name content. The `"<nodeId>::<portName>"` string endpoints in
 * `sources`/`targets` are emitted only as a hint for ELK's layout engine; they are parsed back
 * ONLY for *foreign* ELK input that lacks the `zodal` block (where ids/ports must avoid `::`).
 * These are plain objects — no `elkjs` import.
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

export interface ElkEdge<E = unknown> {
  id: string;
  sources: string[];
  targets: string[];
  /** Authoritative endpoint — immune to `::` in ids/ports. Present on graphs we emit. */
  zodal?: { source: string; target: string; sourcePort?: string; targetPort?: string; type?: string; data?: E };
}

export interface ElkGraph<N = unknown, E = unknown> {
  id: string;
  children: ElkNode[];
  edges: ElkEdge<E>[];
  zodal?: { directed: boolean; multigraph: boolean; graph: GraphMeta; nodeData?: Record<string, N> };
}

const endpoint = (node: string, port?: string): string =>
  port === undefined ? node : `${node}${SEP}${port}`;

function parseEndpoint(ref: string): { node: string; port?: string } {
  const idx = ref.indexOf(SEP);
  if (idx === -1) return { node: ref };
  return { node: ref.slice(0, idx), port: ref.slice(idx + SEP.length) };
}

/** Convert the canonical model to a port-aware ELK graph (plain JSON). */
export function toELK<N, E>(graph: CanonicalGraph<N, E>, id = 'root'): ElkGraph<N, E> {
  const nodeData: Record<string, N> = {};

  const children: ElkNode[] = graph.nodes.map((node) => {
    const out: ElkNode = {
      id: node.id,
      zodal: compact({
        kind: node.kind,
        type: node.type,
        funcRef: node.funcRef,
        data: node.data,
      }),
    };
    if (node.data !== undefined) nodeData[node.id] = node.data;
    if (node.ports && node.ports.length > 0) {
      out.ports = node.ports.map((p) => ({ id: endpoint(node.id, p.port), zodal: p }));
    }
    if (node.position !== undefined) {
      out.x = node.position.x;
      out.y = node.position.y;
    }
    return out;
  });

  const edges: ElkEdge<E>[] = graph.edges.map((edge) => ({
    id: edge.id,
    sources: [endpoint(edge.source, edge.sourcePort)],
    targets: [endpoint(edge.target, edge.targetPort)],
    zodal: compact({
      source: edge.source as string,
      target: edge.target as string,
      sourcePort: edge.sourcePort,
      targetPort: edge.targetPort,
      type: edge.type,
      data: edge.data,
    }),
  }));

  return {
    id,
    children,
    edges,
    zodal: { directed: graph.directed, multigraph: graph.multigraph, graph: graph.graph },
  };
}

/** Read a port-aware ELK graph back into the canonical model. */
export function fromELK<N, E>(elk: ElkGraph<N, E>): CanonicalGraph<N, E> {
  const nodes: GraphNode<N>[] = elk.children.map((child) => {
    const z = child.zodal ?? { kind: 'entity' as const };
    const out: GraphNode<N> = compact({
      id: nodeId(child.id),
      kind: z.kind ?? 'entity',
      type: z.type,
      funcRef: z.funcRef,
      data: z.data as N | undefined,
      ports: child.ports?.map((p) => p.zodal).filter((p): p is GraphPort => p !== undefined),
    });
    if (child.x !== undefined && child.y !== undefined) {
      out.position = { x: child.x, y: child.y };
    }
    return out;
  });

  const edges: GraphEdge<E>[] = elk.edges.map((edge) => {
    // Prefer the authoritative structured endpoint (immune to `::`); fall back to parsing the
    // ELK string endpoints only for foreign input that lacks our `zodal` block.
    if (edge.zodal) {
      return compact({
        id: edgeId(edge.id),
        source: nodeId(edge.zodal.source),
        target: nodeId(edge.zodal.target),
        sourcePort: edge.zodal.sourcePort,
        targetPort: edge.zodal.targetPort,
        type: edge.zodal.type,
        data: edge.zodal.data,
      });
    }
    assertSingleEndpoint(edge);
    const src = parseEndpoint(edge.sources[0]);
    const tgt = parseEndpoint(edge.targets[0]);
    return compact({
      id: edgeId(edge.id),
      source: nodeId(src.node),
      target: nodeId(tgt.node),
      sourcePort: src.port,
      targetPort: tgt.port,
    });
  });

  return {
    directed: elk.zodal?.directed ?? true,
    // Conservative default to match `emptyGraph()` — a bare ELK graph is assumed simple, not multi.
    multigraph: elk.zodal?.multigraph ?? false,
    nodes,
    edges,
    graph: elk.zodal?.graph ?? {},
  };
}

/** Foreign ELK edges must be binary with non-empty endpoints; hyperedges are not representable. */
function assertSingleEndpoint(edge: ElkEdge): void {
  const s = edge.sources?.length ?? 0;
  const t = edge.targets?.length ?? 0;
  if (s !== 1 || t !== 1) {
    throw new Error(
      `fromELK: edge "${edge.id}" must have exactly one source and one target ` +
        `(got ${s} sources, ${t} targets). Hyperedges are not representable in the binary-edge canonical model.`,
    );
  }
}
