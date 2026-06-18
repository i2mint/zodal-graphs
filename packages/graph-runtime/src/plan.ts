/**
 * The execution plan — a topological order of nodes plus, for each node, the bindings that feed its
 * input ports (which upstream node/out-port supplies each in-port). Built once from the canonical
 * graph; the runner walks it.
 *
 * The plan is where structural ambiguity is rejected EAGERLY (so the runner never silently picks an
 * arbitrary value): a cyclic graph, two edges into one in-port (fan-in), a var node with more than
 * one incoming edge, or an edge that omits `sourcePort` from a node with multiple out-ports all
 * throw here with a descriptive error.
 */

import type { CanonicalGraph, GraphNode, GraphPort } from '@zodal/graph-core';

/** One input binding: an in-port fed by a specific upstream out-port. */
export interface InputBinding {
  /** The in-port (on this node) being fed. */
  inPort: string;
  /** The internal parameter name the value is passed under (port.param ?? port.port). */
  param: string;
  source: string;
  /** The upstream out-port supplying the value — resolved (concrete for func sources). */
  sourcePort?: string;
}

export interface NodePlan {
  node: GraphNode;
  inPorts: GraphPort[];
  outPorts: GraphPort[];
  bindings: InputBinding[];
}

export interface ExecutionPlan {
  /** Node ids in a valid execution order (every source before its targets). */
  order: string[];
  byId: Map<string, NodePlan>;
}

/** Build the execution plan; throws on a cycle or an ambiguous/over-constrained wiring. */
export function buildExecutionPlan(graph: CanonicalGraph): ExecutionPlan {
  const byId = new Map<string, NodePlan>();
  for (const node of graph.nodes) {
    const ports = node.ports ?? [];
    byId.set(node.id, {
      node,
      inPorts: ports.filter((p) => p.direction === 'in'),
      outPorts: ports.filter((p) => p.direction === 'out'),
      bindings: [],
    });
  }

  const indeg = new Map<string, number>();
  const successors = new Map<string, string[]>();
  for (const id of byId.keys()) {
    indeg.set(id, 0);
    successors.set(id, []);
  }

  for (const edge of graph.edges) {
    const targetPlan = byId.get(edge.target);
    if (!targetPlan) continue;

    if (targetPlan.node.kind === 'var' && targetPlan.bindings.length >= 1) {
      throw new Error(`graph-runtime: var node "${edge.target}" has more than one incoming edge`);
    }

    const inPort = resolveInPort(targetPlan, edge.targetPort);
    const inPortName = inPort?.port ?? edge.targetPort;
    if (targetPlan.node.kind !== 'var' && inPortName != null && targetPlan.bindings.some((b) => b.inPort === inPortName)) {
      throw new Error(`graph-runtime: in-port "${inPortName}" of node "${edge.target}" is fed by more than one edge (fan-in is not allowed)`);
    }

    targetPlan.bindings.push({
      inPort: inPortName ?? '',
      param: inPort?.param ?? inPort?.port ?? edge.targetPort ?? '',
      source: edge.source,
      sourcePort: resolveSourcePort(byId.get(edge.source), edge.sourcePort, edge.id, edge.source),
    });
    indeg.set(edge.target, (indeg.get(edge.target) ?? 0) + 1);
    successors.get(edge.source)?.push(edge.target);
  }

  // Kahn topological sort.
  const order: string[] = [];
  const queue = [...byId.keys()].filter((id) => (indeg.get(id) ?? 0) === 0);
  let head = 0;
  while (head < queue.length) {
    const id = queue[head++];
    order.push(id);
    for (const next of successors.get(id) ?? []) {
      const d = (indeg.get(next) ?? 0) - 1;
      indeg.set(next, d);
      if (d === 0) queue.push(next);
    }
  }
  if (order.length !== byId.size) {
    throw new Error('graph-runtime: cannot execute a cyclic graph (no topological order exists)');
  }

  return { order, byId };
}

/** Find the in-port an edge targets: by name when `targetPort` is given, else the sole in-port. */
function resolveInPort(plan: NodePlan, targetPort: string | undefined): GraphPort | undefined {
  if (targetPort != null) return plan.inPorts.find((p) => p.port === targetPort);
  return plan.inPorts.length === 1 ? plan.inPorts[0] : undefined;
}

/** Resolve which out-port an edge leaves from. Concrete for func sources; throws if ambiguous. */
function resolveSourcePort(
  sourcePlan: NodePlan | undefined,
  sourcePort: string | undefined,
  edgeId: string,
  sourceId: string,
): string | undefined {
  if (sourcePort != null) return sourcePort;
  if (!sourcePlan || sourcePlan.node.kind === 'var') return undefined; // var carries one 'value'
  const outs = sourcePlan.outPorts;
  if (outs.length === 1) return outs[0].port;
  if (outs.length > 1) {
    throw new Error(
      `graph-runtime: edge "${edgeId}" omits sourcePort but its source "${sourceId}" has ${outs.length} out-ports (ambiguous)`,
    );
  }
  return undefined;
}
