/**
 * Connection validation — the P1 seam, fully headless (no React import).
 *
 * React Flow ships an `isValidConnection` HOOK but no type check: handles are typeless at the
 * protocol level. So the facade GENERATES the predicate from the canonical port types and feeds it
 * to React Flow. This is the one place the meshed-style "connect output → a specific typed input
 * port, only if compatible" rule is enforced — driven by `portTypeCompatible`, the genuinely-new
 * graph-core module.
 *
 * Conservatism: it rejects a connection whose ports can't be found, and a **self-connection**
 * (source === target — a same-node dependency cycle the DAG executor can't schedule). It is
 * permissive only when a port carries NO declared type — i.e. the author placed no constraint
 * (distinct from graph-core's UNRESOLVED sentinel, which IS a type and is rejected by
 * `portTypeCompatible`). That permissiveness is the `allowUntypedPorts` option (default `true`).
 * When the graph doesn't declare typed ports / connection validation, every connection is allowed.
 */

import type { CanonicalGraph, GraphCapabilities, GraphNode, GraphPort, PortDirection, PortTypeRef } from '@zodal/graph-core';
import { portTypeCompatible } from '@zodal/graph-core';

/**
 * React Flow's `Connection` shape (re-declared so this module needs no `@xyflow/react` import).
 * Handle fields are `string | null | undefined` to match React Flow's `Edge | Connection` — React
 * Flow passes an Edge (a superset) on a reconnection, so the predicate is assignable without a cast.
 */
export interface Connection {
  source: string | null;
  target: string | null;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export type IsValidConnection = (connection: Connection) => boolean;

/** A type-compatibility predicate over two port types — defaults to graph-core's `portTypeCompatible`. */
export type PortCompatibility = (out: PortTypeRef, into: PortTypeRef) => boolean;

export interface MakeIsValidConnectionOptions {
  /** Override the port type-compatibility rule (default `portTypeCompatible`). */
  compatible?: PortCompatibility;
  /**
   * Permit a connection to/from a port that declares NO type at all (an unconstrained port).
   * Default `true`. This governs only ports with no `type` field — a port whose type is present but
   * UNRESOLVED is still rejected by `portTypeCompatible`. Set `false` for a strict "every port must
   * declare a type" stance.
   */
  allowUntypedPorts?: boolean;
}

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
 * compatibility (and rejects unknown ports + self-connections).
 */
export function makeIsValidConnection(
  graph: CanonicalGraph,
  capabilities: GraphCapabilities,
  options: MakeIsValidConnectionOptions = {},
): IsValidConnection {
  const compatible = options.compatible ?? portTypeCompatible;
  const allowUntyped = options.allowUntypedPorts ?? true;

  if (!capabilities.typedPorts || !capabilities.validatesConnections) {
    return () => true;
  }
  const nodeById = new Map<string, GraphNode>(graph.nodes.map((n) => [n.id, n]));

  return (connection) => {
    if (connection.source == null || connection.target == null) return false;
    if (connection.source === connection.target) return false; // no same-node dependency cycles
    const out = lookupPort(nodeById.get(connection.source), connection.sourceHandle ?? null, 'out');
    const into = lookupPort(nodeById.get(connection.target), connection.targetHandle ?? null, 'in');
    if (!out || !into) return false; // a connection to/from an unknown port is invalid
    if (!out.type || !into.type) return allowUntyped; // no declared type ⇒ no constraint to check
    return compatible(out.type, into.type);
  };
}
