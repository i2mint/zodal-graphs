/**
 * The dataflow executor — run a func graph in topological order over a scope.
 *
 * **Calling convention:** a func node's resolved callable is invoked with exactly ONE positional
 * argument — an object of its inputs keyed by parameter name (`{ [port.param ?? port.port]: value }`)
 * — and returns either the value (one out-port) or an object keyed by out-port name (several
 * out-ports). This object convention assumes keyword-compatible parameters; Python positional-only /
 * `*args` / `**kwargs` kinds (graph-core `PortKind`) are NOT yet expressible (deferred).
 *
 * **Resolution:** the runtime does NOT branch on `funcRef.lang` — the `FuncRefResolver` (from
 * `@zodal/graph-core`) is the single dispatch point and maps any lang (`ts`, `py`, …) to a callable.
 * Pure-TS graphs use a resolver returning JS functions; Python-backed graphs use a resolver that
 * bridges to Pyodide/WASM or a backend.
 *
 * Values flow along edges `source.sourcePort → target.targetPort`. `var` nodes pass their single
 * input through; `entity` / funcRef-less nodes are skipped.
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
/** node id → (in-port → effective seed value used) — captured so `recompute` can reuse unchanged seeds. */
export type Seeds = Record<string, Record<string, unknown>>;

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
  /** The effective seed values used per node/in-port — pass the whole result to `recompute`. */
  seeds: Seeds;
}

export interface RecomputeResult extends RunResult {
  /** The nodes that were actually re-executed (the changed set + everything downstream). */
  recomputed: string[];
}

/** Execute the whole graph; returns the final scope, order, and effective seeds. */
export async function run(graph: CanonicalGraph, options: RunOptions): Promise<RunResult> {
  const plan = buildExecutionPlan(graph);
  const scope: Scope = {};
  const seeds: Seeds = {};
  for (const id of plan.order) {
    await executeNode(plan.byId.get(id)!, scope, seeds, options, undefined);
  }
  return { scope, order: plan.order, seeds };
}

/** Execute step by step, yielding each node's outputs as it completes (step / watch-values UI). */
export async function* runSteps(graph: CanonicalGraph, options: RunOptions): AsyncGenerator<StepEvent> {
  const plan = buildExecutionPlan(graph);
  const scope: Scope = {};
  const seeds: Seeds = {};
  let index = 0;
  for (const id of plan.order) {
    await executeNode(plan.byId.get(id)!, scope, seeds, options, undefined);
    yield { node: id, outputs: { ...(scope[id] ?? {}) }, index: index++ };
  }
}

/**
 * Incrementally re-execute only the nodes downstream of (and including) `changedNodeIds`, reusing
 * `previous` for everything unaffected. Each re-executed node reads its unbound inputs from the new
 * `options.inputs` first, then falls back to the seeds captured in `previous` — so a node's
 * unchanged seeds are NOT lost (the bug this guards against). Forward propagation along successors.
 */
export async function recompute(
  graph: CanonicalGraph,
  options: RunOptions,
  previous: RunResult,
  changedNodeIds: string[],
): Promise<RecomputeResult> {
  const plan = buildExecutionPlan(graph);
  const affected = forwardReachable(graph, changedNodeIds);
  const scope: Scope = cloneRecord(previous.scope);
  const seeds: Seeds = cloneRecord(previous.seeds);
  for (const id of plan.order) {
    if (affected.has(id)) {
      await executeNode(plan.byId.get(id)!, scope, seeds, options, previous.seeds);
    }
  }
  return { scope, order: plan.order, seeds, recomputed: plan.order.filter((id) => affected.has(id)) };
}

// === internals ============================================================

async function executeNode(
  plan: NodePlan,
  scope: Scope,
  seeds: Seeds,
  options: RunOptions,
  prevSeeds: Seeds | undefined,
): Promise<void> {
  const node = plan.node;

  if (node.kind === 'var') {
    const inPort = plan.inPorts[0];
    const seedKey = inPort?.port ?? 'value';
    const value = plan.bindings.length
      ? readOutput(scope, plan.bindings[0])
      : effectiveSeed(node.id, seedKey, inPort?.default, options, prevSeeds, seeds);
    setOutput(scope, node.id, 'value', value, options.onValue);
    for (const out of plan.outPorts) setOutput(scope, node.id, out.port, value, options.onValue);
    return;
  }

  if (!node.funcRef) return; // entity / non-executable node

  const args: Record<string, unknown> = {};
  for (const inPort of plan.inPorts) {
    const binding = plan.bindings.find((b) => b.inPort === inPort.port);
    let value: unknown;
    if (binding) {
      value = readOutput(scope, binding);
    } else {
      value = effectiveSeed(node.id, inPort.port, inPort.default, options, prevSeeds, seeds);
      if (value === undefined && inPort.required) {
        throw new Error(`graph-runtime: required input "${inPort.port}" of node "${node.id}" is unbound`);
      }
    }
    args[inPort.param ?? inPort.port] = value;
  }

  const fn = await options.resolver(node.funcRef);
  const result = await fn(args);

  if (plan.outPorts.length <= 1) {
    setOutput(scope, node.id, plan.outPorts[0]?.port ?? 'out', result, options.onValue);
  } else {
    if (result === null || typeof result !== 'object') {
      throw new Error(
        `graph-runtime: node "${node.id}" declares ${plan.outPorts.length} out-ports but its callable returned a ${result === null ? 'null' : typeof result}; multi-output callables must return an object keyed by out-port name`,
      );
    }
    const record = result as Record<string, unknown>;
    for (const out of plan.outPorts) setOutput(scope, node.id, out.port, record[out.port], options.onValue);
  }
}

/** Read a bound input's value. `sourcePort` is resolved to a concrete out-port at plan time for
 *  func sources; var sources carry a single `value`. */
function readOutput(scope: Scope, binding: { source: string; sourcePort?: string }): unknown {
  const outputs = scope[binding.source];
  if (!outputs) return undefined;
  if (binding.sourcePort != null && binding.sourcePort in outputs) return outputs[binding.sourcePort];
  if ('value' in outputs) return outputs.value;
  const keys = Object.keys(outputs);
  return keys.length > 0 ? outputs[keys[0]] : undefined;
}

/** Resolve an unbound input: new inputs win, then the prior run's seed, then the port default —
 *  recording the value so a later `recompute` of this node keeps it. */
function effectiveSeed(
  nodeId: string,
  portName: string,
  defaultValue: unknown,
  options: RunOptions,
  prevSeeds: Seeds | undefined,
  seedsOut: Seeds,
): unknown {
  let value = options.inputs?.[nodeId]?.[portName];
  if (value === undefined) value = prevSeeds?.[nodeId]?.[portName];
  if (value === undefined) value = defaultValue;
  (seedsOut[nodeId] ??= {})[portName] = value;
  return value;
}

function setOutput(scope: Scope, nodeId: string, port: string, value: unknown, onValue: RunOptions['onValue']): void {
  (scope[nodeId] ??= {})[port] = value;
  onValue?.({ node: nodeId, port, value });
}

function cloneRecord(record: Record<string, Record<string, unknown>>): Record<string, Record<string, unknown>> {
  const out: Record<string, Record<string, unknown>> = {};
  for (const id of Object.keys(record)) out[id] = { ...record[id] };
  return out;
}

/** Forward (successor) reachability. Intentionally mirrors graph-compute's `reach(…, 'forward')` /
 *  staleLayer, but inlined here to keep graph-runtime's only dependency `@zodal/graph-core` (no graphology). */
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
