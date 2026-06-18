/**
 * Serializer — the canonical wire format.
 *
 * The on-disk / on-wire shape is a **`nodes_and_links` superset** (linked-compatible): the
 * familiar `{ nodes, links }` D3-style JSON, enriched with the bipartite node `kind`, the
 * typed `ports[]` block, and `sourcePort`/`targetPort` on links. Facade state (capabilities,
 * overlays, layout) rides in a namespaced `graph.zodal` block so foreign consumers ignore it.
 *
 * The in-memory model calls them `edges`; the wire format calls them `links` (the
 * `nodes_and_links` convention). This module is the single place that bridges the two names.
 * The functions are generic in the node/edge data types so a typed graph stays typed across
 * a round-trip.
 */

import type { CanonicalGraph, GraphNode, GraphEdge, GraphPort, FuncRef, GraphMeta } from './model.js';
import { nodeId, edgeId } from './model.js';
import type { GraphCapabilities } from './capabilities.js';
import type { GraphOverlays, GraphLayout } from './presentation.js';

export interface SerializedNode<N = unknown> {
  id: string;
  kind: GraphNode['kind'];
  type?: string;
  ports?: GraphPort[];
  funcRef?: FuncRef;
  data?: N;
  position?: { x: number; y: number };
}

export interface SerializedLink<E = unknown> {
  id: string;
  source: string;
  target: string;
  sourcePort?: string;
  targetPort?: string;
  type?: string;
  data?: E;
}

export interface SerializedGraph<N = unknown, E = unknown> {
  directed: boolean;
  multigraph: boolean;
  nodes: SerializedNode<N>[];
  links: SerializedLink<E>[];
  graph: GraphMeta & {
    zodal?: {
      schemaRefs?: Record<string, string>;
      capabilities?: GraphCapabilities;
      overlays?: GraphOverlays;
      layout?: GraphLayout;
      [key: string]: unknown;
    };
  };
}

/** Serialize a canonical graph to the `nodes_and_links` superset wire shape. */
export function toNodesAndLinks<N, E>(graph: CanonicalGraph<N, E>): SerializedGraph<N, E> {
  return {
    directed: graph.directed,
    multigraph: graph.multigraph,
    nodes: graph.nodes.map(serializeNode),
    links: graph.edges.map(serializeEdge),
    graph: graph.graph,
  };
}

/** Parse the `nodes_and_links` superset wire shape back into a canonical graph. */
export function fromNodesAndLinks<N, E>(serialized: SerializedGraph<N, E>): CanonicalGraph<N, E> {
  return {
    directed: serialized.directed,
    multigraph: serialized.multigraph,
    nodes: serialized.nodes.map(deserializeNode),
    edges: serialized.links.map(deserializeLink),
    graph: serialized.graph ?? {},
  };
}

function serializeNode<N>(node: GraphNode<N>): SerializedNode<N> {
  const out: SerializedNode<N> = { id: node.id, kind: node.kind };
  if (node.type !== undefined) out.type = node.type;
  if (node.ports !== undefined) out.ports = node.ports;
  if (node.funcRef !== undefined) out.funcRef = node.funcRef;
  if (node.data !== undefined) out.data = node.data;
  if (node.position !== undefined) out.position = node.position;
  return out;
}

function deserializeNode<N>(node: SerializedNode<N>): GraphNode<N> {
  const out: GraphNode<N> = { id: nodeId(node.id), kind: node.kind };
  if (node.type !== undefined) out.type = node.type;
  if (node.ports !== undefined) out.ports = node.ports;
  if (node.funcRef !== undefined) out.funcRef = node.funcRef;
  if (node.data !== undefined) out.data = node.data;
  if (node.position !== undefined) out.position = node.position;
  return out;
}

function serializeEdge<E>(edge: GraphEdge<E>): SerializedLink<E> {
  const out: SerializedLink<E> = { id: edge.id, source: edge.source, target: edge.target };
  if (edge.sourcePort !== undefined) out.sourcePort = edge.sourcePort;
  if (edge.targetPort !== undefined) out.targetPort = edge.targetPort;
  if (edge.type !== undefined) out.type = edge.type;
  if (edge.data !== undefined) out.data = edge.data;
  return out;
}

function deserializeLink<E>(link: SerializedLink<E>): GraphEdge<E> {
  const out: GraphEdge<E> = {
    id: edgeId(link.id),
    source: nodeId(link.source),
    target: nodeId(link.target),
  };
  if (link.sourcePort !== undefined) out.sourcePort = link.sourcePort;
  if (link.targetPort !== undefined) out.targetPort = link.targetPort;
  if (link.type !== undefined) out.type = link.type;
  if (link.data !== undefined) out.data = link.data;
  return out;
}
