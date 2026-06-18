/**
 * Connection validation — the P1 seam, fully headless (no React import).
 *
 * React Flow ships an `isValidConnection` HOOK but no type check: handles are typeless at the
 * protocol level. So the facade GENERATES the predicate from the canonical port types and feeds it
 * to React Flow. This is the one place the meshed-style "connect output → a specific typed input
 * port, only if compatible" rule is enforced — driven by `portTypeCompatible`, the genuinely-new
 * graph-core module.
 *
 * The predicate is conservative: it rejects a connection whose ports can't be found, but is
 * permissive when a port carries no declared type (absence of a constraint ≠ an incompatible type).
 * When the graph doesn't declare typed ports / connection validation, every connection is allowed.
 */

import type { CanonicalGraph, GraphCapabilities, GraphNode, GraphPort, PortDirection, PortTypeRef } from '@zodal/graph-core';
import { portTypeCompatible } from '@zodal/graph-core';

/** React Flow's `Connection` shape (re-declared so this module needs no `@xyflow/react` import). */
export interface Connection {
  source: string | null;
  target: string | null;
  sourceHandle: string | null;
  targetHandle: string | null;
}

export type IsValidConnection = (connection: Connection) => boolean;

/** A type-compatibility predicate over two port types — defaults to graph-core's `portTypeCompatible`. */
export type PortCompatibility = (out: PortTypeRef, into: PortTypeRef) => boolean;

/**
 * Find the port named `handle` with the given `direction` on `node`. When `handle` is null (an
 * untyped drag with no specific handle), fall back to the node's sole port of that direction, if
 * unambiguous.
 */
export function lookupPort(
  node: GraphNode | undefined,
  handle: string | null,
  direction: PortDirection,
): GraphPort | undefined {
  if (!node) return undefined;
  const ports = (node.ports ?? []).filter((p) => p.direction === direction);
  if (handle != null) return ports.find((p) => p.port === handle);
  return ports.length === 1 ? ports[0] : undefined;
}

/**
 * Generate an `isValidConnection` predicate for a graph. Returns an always-true predicate when the
 * graph doesn't declare typed ports + connection validation; otherwise enforces port type
 * compatibility via `compatible` (default `portTypeCompatible`).
 */
export function makeIsValidConnection(
  graph: CanonicalGraph,
  capabilities: GraphCapabilities,
  compatible: PortCompatibility = portTypeCompatible,
): IsValidConnection {
  if (!capabilities.typedPorts || !capabilities.validatesConnections) {
    return () => true;
  }
  const nodeById = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]));

  return (connection) => {
    if (connection.source == null || connection.target == null) return false;
    const out = lookupPort(nodeById.get(connection.source), connection.sourceHandle, 'out');
    const into = lookupPort(nodeById.get(connection.target), connection.targetHandle, 'in');
    if (!out || !into) return false; // a connection to an unknown port is invalid
    if (!out.type || !into.type) return true; // no declared type ⇒ no constraint to violate
    return compatible(out.type, into.type);
  };
}
