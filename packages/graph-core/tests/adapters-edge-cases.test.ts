/**
 * Adversarial adapter regressions — the cases the critic pass surfaced that the original
 * fixtures did not cover: parallel edges in a non-multigraph, undirected graphs, ids/ports
 * containing the ELK separator, flag/meta preservation through React Flow, and reference
 * aliasing through graphology.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '../src/index.js';
import {
  nodeId,
  edgeId,
  toNodesAndLinks,
  fromNodesAndLinks,
  toReactFlow,
  fromReactFlow,
  toELK,
  fromELK,
} from '../src/index.js';
import { toGraphology, fromGraphology } from '../src/graphology.js';

const byId = <T extends { id: string }>(a: readonly T[]): T[] => [...a].sort((x, y) => x.id.localeCompare(y.id));

describe('graphology: legitimate parallel / anti-parallel edges do not throw', () => {
  it('non-multigraph with two edges on the same pair round-trips (flag preserved)', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [
        { id: nodeId('a'), kind: 'entity' },
        { id: nodeId('b'), kind: 'entity' },
      ],
      edges: [
        { id: edgeId('e1'), source: nodeId('a'), target: nodeId('b') },
        { id: edgeId('e2'), source: nodeId('a'), target: nodeId('b') },
      ],
      graph: {},
    };
    const rt = fromGraphology(toGraphology(g)); // must NOT throw
    expect(rt.multigraph).toBe(false); // original flag preserved despite internal multi:true
    expect(byId(rt.edges).map((e) => e.id)).toEqual(['e1', 'e2']);
  });

  it('undirected graph with a-b and b-a round-trips without throwing', () => {
    const g: CanonicalGraph = {
      directed: false,
      multigraph: false,
      nodes: [
        { id: nodeId('a'), kind: 'entity' },
        { id: nodeId('b'), kind: 'entity' },
      ],
      edges: [
        { id: edgeId('e1'), source: nodeId('a'), target: nodeId('b') },
        { id: edgeId('e2'), source: nodeId('b'), target: nodeId('a') },
      ],
      graph: {},
    };
    const rt = fromGraphology(toGraphology(g));
    expect(rt.directed).toBe(false);
    expect(byId(rt.edges).map((e) => e.id)).toEqual(['e1', 'e2']);
  });
});

describe('graphology: no reference aliasing between canonical and the graph', () => {
  it('mutating the source after conversion does not leak into the round-tripped graph', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [{ id: nodeId('n'), kind: 'func', ports: [{ port: 'out', direction: 'out' }], data: { v: 1 } }],
      edges: [],
      graph: {},
    };
    const gl = toGraphology(g);
    // Mutate the ORIGINAL after conversion.
    (g.nodes[0].data as { v: number }).v = 999;
    g.nodes[0].ports!.push({ port: 'leaked', direction: 'in' });
    const rt = fromGraphology(gl);
    expect((rt.nodes[0].data as { v: number }).v).toBe(1); // not 999
    expect(rt.nodes[0].ports).toHaveLength(1); // 'leaked' did not propagate
  });
});

describe('ELK: ids and ports containing the "::" separator survive (structured endpoints)', () => {
  const g: CanonicalGraph = {
    directed: true,
    multigraph: true,
    nodes: [
      { id: nodeId('pkg::mod'), kind: 'func', ports: [{ port: 'out', direction: 'out' }] },
      { id: nodeId('n2'), kind: 'func', ports: [{ port: 'in::x', direction: 'in' }] },
    ],
    edges: [
      { id: edgeId('e1'), source: nodeId('pkg::mod'), target: nodeId('n2'), sourcePort: 'out', targetPort: 'in::x' },
    ],
    graph: {},
  };

  it.each([
    ['serializer', (x: CanonicalGraph) => fromNodesAndLinks(toNodesAndLinks(x))],
    ['graphology', (x: CanonicalGraph) => fromGraphology(toGraphology(x))],
    ['react-flow', (x: CanonicalGraph) => fromReactFlow(toReactFlow(x))],
    ['elk', (x: CanonicalGraph) => fromELK(toELK(x))],
  ])('%s preserves the "::"-bearing endpoint exactly', (_label, roundTrip) => {
    const e = roundTrip(g).edges[0];
    expect(e.source).toBe('pkg::mod');
    expect(e.target).toBe('n2');
    expect(e.sourcePort).toBe('out');
    expect(e.targetPort).toBe('in::x');
  });
});

describe('React Flow: structural flags + graph meta survive the round-trip', () => {
  it('preserves directed=false, multigraph=false, and graph meta', () => {
    const g: CanonicalGraph = {
      directed: false,
      multigraph: false,
      nodes: [{ id: nodeId('a'), kind: 'entity' }],
      edges: [],
      graph: { zodal: { schemaRefs: { A: '#/A' } } },
    };
    const rt = fromReactFlow(toReactFlow(g));
    expect(rt.directed).toBe(false);
    expect(rt.multigraph).toBe(false);
    expect(rt.graph).toEqual({ zodal: { schemaRefs: { A: '#/A' } } });
  });
});

describe('ELK: foreign input guards', () => {
  it('rejects a hyperedge (multi-source) with a clear error', () => {
    const foreign = {
      id: 'root',
      children: [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ],
      edges: [{ id: 'h', sources: ['a', 'b'], targets: ['c'] }],
    };
    expect(() => fromELK(foreign)).toThrow(/exactly one source and one target/);
  });

  it('a bare ELK graph (no zodal block) defaults to a simple, non-multigraph', () => {
    const foreign = {
      id: 'root',
      children: [{ id: 'a' }, { id: 'b' }],
      edges: [{ id: 'e', sources: ['a'], targets: ['b'] }],
    };
    const rt = fromELK(foreign);
    expect(rt.multigraph).toBe(false);
    expect(rt.edges[0]).toMatchObject({ id: 'e', source: 'a', target: 'b' });
  });
});

describe('model: id constructors reject empty ids at the boundary', () => {
  it('throws on an empty node id', () => {
    expect(() => nodeId('')).toThrow(/non-empty/);
  });
});
