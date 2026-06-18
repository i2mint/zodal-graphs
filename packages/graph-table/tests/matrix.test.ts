/**
 * Tests for the adjacency matrix + seriation (cluster-revealing reorder).
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import { toAdjacencyMatrix, seriate } from '../src/index.js';

const path = (ids: string[], directed = true): CanonicalGraph => ({
  directed,
  multigraph: false,
  nodes: ids.map((id) => ({ id: nodeId(id), kind: 'entity' as const })),
  edges: ids.slice(0, -1).map((id, i) => ({ id: edgeId(`${id}${ids[i + 1]}`), source: nodeId(id), target: nodeId(ids[i + 1]) })),
  graph: {},
});

const undirectedEdges = (pairs: Array<[string, string]>): CanonicalGraph => ({
  directed: false,
  multigraph: false,
  nodes: [...new Set(pairs.flat())].map((id) => ({ id: nodeId(id), kind: 'entity' as const })),
  edges: pairs.map(([s, t], i) => ({ id: edgeId(`e${i}`), source: nodeId(s), target: nodeId(t) })),
  graph: {},
});

describe('toAdjacencyMatrix', () => {
  it('builds an N×N matrix with directed cells', () => {
    const m = toAdjacencyMatrix(path(['a', 'b', 'c']));
    expect(m.order).toEqual(['a', 'b', 'c']);
    expect(m.cells[0][1]).toBe(1); // a → b
    expect(m.cells[1][0]).toBe(0); // directed: no b → a
  });

  it('mirrors cells for undirected graphs', () => {
    const m = toAdjacencyMatrix(path(['a', 'b'], false));
    expect(m.cells[0][1]).toBe(1);
    expect(m.cells[1][0]).toBe(1);
  });

  it('uses a weight field when given', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [{ id: nodeId('a'), kind: 'entity' }, { id: nodeId('b'), kind: 'entity' }],
      edges: [{ id: edgeId('e'), source: nodeId('a'), target: nodeId('b'), data: { w: 5 } }],
      graph: {},
    };
    expect(toAdjacencyMatrix(g, { weight: 'w' }).cells[0][1]).toBe(5);
  });
});

describe('seriate', () => {
  it('returns a permutation of the node ids', () => {
    const order = seriate(toAdjacencyMatrix(path(['a', 'b', 'c', 'd'])));
    expect([...order].sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  it('groups two disconnected clusters into contiguous blocks (cuthill-mckee)', () => {
    const g = undirectedEdges([
      ['a', 'b'], ['b', 'c'], ['c', 'a'], // triangle 1
      ['x', 'y'], ['y', 'z'], ['z', 'x'], // triangle 2
    ]);
    const order = seriate(toAdjacencyMatrix(g));
    const positions = (members: string[]) => members.map((id) => order.indexOf(id)).sort((a, b) => a - b);
    const p1 = positions(['a', 'b', 'c']);
    expect(p1[2] - p1[0]).toBe(2); // the three cluster-1 nodes occupy 3 contiguous positions
  });

  it('degree method sorts hubs first', () => {
    const star = undirectedEdges([['hub', 'l1'], ['hub', 'l2'], ['hub', 'l3']]);
    expect(seriate(toAdjacencyMatrix(star), 'degree')[0]).toBe('hub');
  });
});
