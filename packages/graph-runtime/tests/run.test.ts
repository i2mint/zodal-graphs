/**
 * Tests for the dataflow executor: topo execution, value events, stepping, incremental recompute,
 * multi-output distribution, var pass-through, and cycle rejection.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph, FuncRef, GraphNode, GraphPort } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import { run, runSteps, recompute, buildExecutionPlan, type ValueEvent } from '../src/index.js';

// --- builders --------------------------------------------------------------

const func = (id: string, ref: string, ports: Array<[string, GraphPort['direction']]>): GraphNode => ({
  id: nodeId(id),
  kind: 'func',
  funcRef: { ref, lang: 'ts' } satisfies FuncRef,
  ports: ports.map(([port, direction]) => ({ port, direction })),
});
const edge = (id: string, source: string, sourcePort: string, target: string, targetPort: string) => ({
  id: edgeId(id),
  source: nodeId(source),
  target: nodeId(target),
  sourcePort,
  targetPort,
});
const graphOf = (nodes: GraphNode[], edges: ReturnType<typeof edge>[]): CanonicalGraph => ({
  directed: true,
  multigraph: false,
  nodes,
  edges,
  graph: {},
});

/** A resolver from a map of pure-TS callables, counting calls per ref. */
function resolverFrom(fns: Record<string, (args: Record<string, unknown>) => unknown>) {
  const calls: Record<string, number> = {};
  const resolver = (fr: FuncRef) => {
    const fn = fns[fr.ref];
    if (!fn) throw new Error(`no callable for ${fr.ref}`);
    return (args: Record<string, unknown>) => {
      calls[fr.ref] = (calls[fr.ref] ?? 0) + 1;
      return fn(args);
    };
  };
  return { resolver, calls };
}

// --- tests -----------------------------------------------------------------

describe('run', () => {
  it('executes a func pipeline in topological order', async () => {
    const graph = graphOf(
      [
        func('a', 'source5', [['out', 'out']]),
        func('b', 'inc', [['x', 'in'], ['out', 'out']]),
        func('c', 'double', [['x', 'in'], ['out', 'out']]),
      ],
      [edge('e1', 'a', 'out', 'b', 'x'), edge('e2', 'b', 'out', 'c', 'x')],
    );
    const { resolver } = resolverFrom({
      source5: () => 5,
      inc: ({ x }) => (x as number) + 1,
      double: ({ x }) => (x as number) * 2,
    });
    const { scope, order } = await run(graph, { resolver });
    expect(scope['a'].out).toBe(5);
    expect(scope['b'].out).toBe(6);
    expect(scope['c'].out).toBe(12);
    expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'));
  });

  it('emits a value event for every output (watch values flow)', async () => {
    const graph = graphOf(
      [func('a', 'source5', [['out', 'out']]), func('b', 'inc', [['x', 'in'], ['out', 'out']])],
      [edge('e1', 'a', 'out', 'b', 'x')],
    );
    const { resolver } = resolverFrom({ source5: () => 5, inc: ({ x }) => (x as number) + 1 });
    const events: ValueEvent[] = [];
    await run(graph, { resolver, onValue: (e) => events.push(e) });
    expect(events).toEqual([
      { node: 'a', port: 'out', value: 5 },
      { node: 'b', port: 'out', value: 6 },
    ]);
  });

  it('seeds unbound input ports from inputs', async () => {
    const graph = graphOf([func('id', 'identity', [['v', 'in'], ['out', 'out']])], []);
    const { resolver } = resolverFrom({ identity: ({ v }) => v });
    const { scope } = await run(graph, { resolver, inputs: { id: { v: 42 } } });
    expect(scope['id'].out).toBe(42);
  });

  it('distributes a record return across multiple out-ports', async () => {
    const graph = graphOf([func('s', 'split', [['n', 'in'], ['lo', 'out'], ['hi', 'out']])], []);
    const { resolver } = resolverFrom({ split: ({ n }) => ({ lo: (n as number) - 1, hi: (n as number) + 1 }) });
    const { scope } = await run(graph, { resolver, inputs: { s: { n: 10 } } });
    expect(scope['s'].lo).toBe(9);
    expect(scope['s'].hi).toBe(11);
  });

  it('passes a var node through to its consumers', async () => {
    const graph: CanonicalGraph = graphOf(
      [
        { id: nodeId('v'), kind: 'var', ports: [{ port: 'out', direction: 'out' }] },
        func('f', 'inc', [['x', 'in'], ['out', 'out']]),
      ],
      [edge('e1', 'v', 'out', 'f', 'x')],
    );
    const { resolver } = resolverFrom({ inc: ({ x }) => (x as number) + 1 });
    const { scope } = await run(graph, { resolver, inputs: { v: { value: 7 } } });
    expect(scope['v'].out).toBe(7);
    expect(scope['f'].out).toBe(8);
  });

  it('awaits async resolvers and async callables', async () => {
    const graph = graphOf([func('a', 'asyncRef', [['out', 'out']])], []);
    const resolver = async () => async () => 99;
    const { scope } = await run(graph, { resolver });
    expect(scope['a'].out).toBe(99);
  });
});

describe('runSteps', () => {
  it('yields one step per node, in order', async () => {
    const graph = graphOf(
      [func('a', 'source5', [['out', 'out']]), func('b', 'inc', [['x', 'in'], ['out', 'out']])],
      [edge('e1', 'a', 'out', 'b', 'x')],
    );
    const { resolver } = resolverFrom({ source5: () => 5, inc: ({ x }) => (x as number) + 1 });
    const steps = [];
    for await (const step of runSteps(graph, { resolver })) steps.push(step);
    expect(steps.map((s) => s.node)).toEqual(['a', 'b']);
    expect(steps[1].outputs.out).toBe(6);
  });
});

describe('recompute', () => {
  it('re-runs only the nodes downstream of a change', async () => {
    const graph = graphOf(
      [
        func('in', 'identity', [['v', 'in'], ['out', 'out']]),
        func('d', 'inc', [['x', 'in'], ['out', 'out']]),
        func('side', 'const99', [['out', 'out']]), // independent branch
      ],
      [edge('e1', 'in', 'out', 'd', 'x')],
    );
    const { resolver, calls } = resolverFrom({
      identity: ({ v }) => v,
      inc: ({ x }) => (x as number) + 1,
      const99: () => 99,
    });
    const first = await run(graph, { resolver, inputs: { in: { v: 10 } } });
    expect(first.scope['d'].out).toBe(11);
    expect(calls.const99).toBe(1);

    const again = await recompute(graph, { resolver, inputs: { in: { v: 20 } } }, first, ['in']);
    expect(again.scope['in'].out).toBe(20);
    expect(again.scope['d'].out).toBe(21); // downstream recomputed
    expect(again.scope['side'].out).toBe(99); // preserved from previous scope
    expect(again.recomputed).toEqual(['in', 'd']); // side NOT recomputed
    expect(calls.const99).toBe(1); // const99 was not called again
  });

  it('preserves a re-executed node’s OWN unchanged seeds (no NaN regression)', async () => {
    const graph = graphOf(
      [
        func('in', 'identity', [['v', 'in'], ['out', 'out']]),
        func('d', 'add', [['x', 'in'], ['k', 'in'], ['out', 'out']]), // x bound, k seeded
      ],
      [edge('e1', 'in', 'out', 'd', 'x')],
    );
    const { resolver } = resolverFrom({ identity: ({ v }) => v, add: ({ x, k }) => (x as number) + (k as number) });
    const first = await run(graph, { resolver, inputs: { in: { v: 10 }, d: { k: 100 } } });
    expect(first.scope['d'].out).toBe(110);

    // recompute passes ONLY the changed input; d's seed k must survive (was producing NaN before the fix).
    const again = await recompute(graph, { resolver, inputs: { in: { v: 20 } } }, first, ['in']);
    expect(again.scope['d'].out).toBe(120);
  });
});

describe('plan/runtime validation (no silent corruption)', () => {
  it('rejects fan-in: two edges into the same in-port', () => {
    const graph = graphOf(
      [func('a', 'f', [['out', 'out']]), func('b', 'f', [['out', 'out']]), func('m', 'f', [['x', 'in'], ['out', 'out']])],
      [edge('e1', 'a', 'out', 'm', 'x'), edge('e2', 'b', 'out', 'm', 'x')],
    );
    expect(() => buildExecutionPlan(graph)).toThrow(/fan-in/);
  });

  it('rejects a var node with more than one incoming edge', () => {
    const graph: CanonicalGraph = graphOf(
      [func('a', 'f', [['out', 'out']]), func('b', 'f', [['out', 'out']]), { id: nodeId('v'), kind: 'var', ports: [{ port: 'out', direction: 'out' }] }],
      [edge('e1', 'a', 'out', 'v', 'in'), edge('e2', 'b', 'out', 'v', 'in')],
    );
    expect(() => buildExecutionPlan(graph)).toThrow(/more than one incoming edge/);
  });

  it('rejects an edge that omits sourcePort from a multi-out-port source', () => {
    const graph = graphOf(
      [func('s', 'split', [['lo', 'out'], ['hi', 'out']]), func('t', 'f', [['x', 'in'], ['out', 'out']])],
      [{ id: edgeId('e1'), source: nodeId('s'), target: nodeId('t'), targetPort: 'x' }], // no sourcePort
    );
    expect(() => buildExecutionPlan(graph)).toThrow(/ambiguous/);
  });

  it('throws when a multi-out-port callable returns a non-object', async () => {
    const graph = graphOf([func('s', 'bad', [['lo', 'out'], ['hi', 'out']])], []);
    const { resolver } = resolverFrom({ bad: () => 42 });
    await expect(run(graph, { resolver })).rejects.toThrow(/multi-output callables must return an object/);
  });

  it('throws when a required input is unbound', async () => {
    const graph: CanonicalGraph = graphOf(
      [{ id: nodeId('f'), kind: 'func', funcRef: { ref: 'needs', lang: 'ts' }, ports: [{ port: 'x', direction: 'in', required: true }, { port: 'out', direction: 'out' }] }],
      [],
    );
    const { resolver } = resolverFrom({ needs: ({ x }) => x });
    await expect(run(graph, { resolver })).rejects.toThrow(/required input "x"/);
  });
});

describe('buildExecutionPlan', () => {
  it('throws on a cyclic graph', () => {
    const graph = graphOf(
      [func('a', 'f', [['x', 'in'], ['out', 'out']]), func('b', 'f', [['x', 'in'], ['out', 'out']])],
      [edge('e1', 'a', 'out', 'b', 'x'), edge('e2', 'b', 'out', 'a', 'x')],
    );
    expect(() => buildExecutionPlan(graph)).toThrow(/cyclic/);
  });
});
