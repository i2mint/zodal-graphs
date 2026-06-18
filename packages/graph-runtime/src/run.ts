/**
 * The dataflow executor — run a func graph in topological order over a scope.
 *
 * Calling convention: a func node's resolved callable receives a single object of its inputs keyed
 * by parameter name (`{ [port.param ?? port.port]: value }`) and returns either the value (one
 * out-port) or an object keyed by out-port name (several out-ports). `var` nodes pass their single
 * input through; `entity` / funcRef-less nodes are skipped. Values flow along edges:
 * `source.sourcePort → target.targetPort`. Resolution of a `funcRef` to a callable is the
 * `FuncRefResolver`'s job — pure-TS refs resolve directly; Python-backed refs resolve via a
 * consumer-supplied resolver (Pyodide/WASM or a backend).
 */

import type { CanonicalGraph, FuncRefResolver } from '@zodal/graph-core';
import { buildExecutionPlan, type NodePlan } from './plan.js';

export interface ValueEvent {
  node: string;
  port: string;
  value: unknown;
}

export interface StepEvent {
  node: string;
  outputs: Record<string, unknown>;
  index: number;
}

/** node id → (out-port → value). */
export type Scope = Record<string, Record<string, unknown>>;

export interface RunOptions {
  resolver: FuncRefResolver;
  /** Seed values for input ports with no incoming edge: nodeId → (in-port → value). */
  inputs?: Record<string, Record<string, unknown>>;
  /** Called as each output value is produced — the watch-values-flow hook. */
  onValue?: (event: ValueEvent) => void;
}

export interface RunResult {
  scope: Scope;
  order: string[];
}

export interface RecomputeResult extends RunResult {
  /** The nodes that were actually re-executed (the changed set + everything downstream). */
  recomputed: string[];
}

/** Execute the whole graph; returns the final scope and the execution order. */
export async function run(graph: CanonicalGraph, options: RunOptions): Promise<RunResult> {
  const plan = buildExecutionPlan(graph);
  const scope: Scope = {};
  for (const id of plan.order) {
    await executeNode(plan.byId.get(id)!, scope, options);
  }
  return { scope, order: plan.order };
}

/** Execute step by step, yielding each node's outputs as it completes (step / watch-values UI). */
export async function* runSteps(graph: CanonicalGraph, options: RunOptions): AsyncGenerator<StepEvent> {
  const plan = buildExecutionPlan(graph);
  const scope: Scope = {};
  let index = 0;
  for (const id of plan.order) {
    await executeNode(plan.byId.get(id)!, scope, options);
    yield { node: id, outputs: { ...(scope[id] ?? {}) }, index: index++ };
  }
}

/**
 * Incrementally re-execute only the nodes downstream of (and including) `changedNodeIds`, reusing
 * `previousScope` for everything upstream/unaffected. Forward propagation along successors — the
 * "recompute only what changed" behaviour.
 */
export async function recompute(
  graph: CanonicalGraph,
  options: RunOptions,
  previousScope: Scope,
  changedNodeIds: string[],
): Promise<RecomputeResult> {
  const plan = buildExecutionPlan(graph);
  const affected = forwardReachable(graph, changedNodeIds);
  const scope: Scope = cloneScope(previousScope);
  for (const id of plan.order) {
    if (affected.has(id)) {
      await executeNode(plan.byId.get(id)!, scope, options);
    }
  }
  return { scope, order: plan.order, recomputed: plan.order.filter((id) => affected.has(id)) };
}

// === internals ============================================================

async function executeNode(plan: NodePlan, scope: Scope, options: RunOptions): Promise<void> {
  const node = plan.node;

  if (node.kind === 'var') {
    const value = plan.bindings.length
      ? readOutput(scope, plan.bindings[0].source, plan.bindings[0].sourcePort)
      : options.inputs?.[node.id]?.value;
    setOutput(scope, node.id, 'value', value, options.onValue);
    for (const out of plan.outPorts) setOutput(scope, node.id, out.port, value, options.onValue);
    return;
  }

  if (!node.funcRef) return; // entity / non-executable node

  const args: Record<string, unknown> = {};
  for (const inPort of plan.inPorts) {
    const binding = plan.bindings.find((b) => b.inPort === inPort.port);
    const value = binding
      ? readOutput(scope, binding.source, binding.sourcePort)
      : (options.inputs?.[node.id]?.[inPort.port] ?? inPort.default);
    args[inPort.param ?? inPort.port] = value;
  }

  const fn = await options.resolver(node.funcRef);
  const result = await fn(args);

  if (plan.outPorts.length <= 1) {
    setOutput(scope, node.id, plan.outPorts[0]?.port ?? 'out', result, options.onValue);
  } else {
    const record = (result ?? {}) as Record<string, unknown>;
    for (const out of plan.outPorts) setOutput(scope, node.id, out.port, record[out.port], options.onValue);
  }
}

function readOutput(scope: Scope, source: string, sourcePort: string | undefined): unknown {
  const outputs = scope[source];
  if (!outputs) return undefined;
  if (sourcePort != null && sourcePort in outputs) return outputs[sourcePort];
  if ('value' in outputs) return outputs.value;
  const keys = Object.keys(outputs);
  return keys.length > 0 ? outputs[keys[0]] : undefined;
}

function setOutput(
  scope: Scope,
  nodeId: string,
  port: string,
  value: unknown,
  onValue: RunOptions['onValue'],
): void {
  (scope[nodeId] ??= {})[port] = value;
  onValue?.({ node: nodeId, port, value });
}

function cloneScope(scope: Scope): Scope {
  const out: Scope = {};
  for (const id of Object.keys(scope)) out[id] = { ...scope[id] };
  return out;
}

function forwardReachable(graph: CanonicalGraph, starts: string[]): Set<string> {
  const successors = new Map<string, string[]>();
  for (const edge of graph.edges) {
    let list = successors.get(edge.source);
    if (!list) {
      list = [];
      successors.set(edge.source, list);
    }
    list.push(edge.target);
  }
  const seen = new Set<string>(starts);
  const queue = [...starts];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head++];
    for (const v of successors.get(u) ?? []) {
      if (!seen.has(v)) {
        seen.add(v);
        queue.push(v);
      }
    }
  }
  return seen;
}
