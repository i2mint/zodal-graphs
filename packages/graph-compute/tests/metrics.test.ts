/**
 * Tests for importance/structure metrics (issue #29): degree/pagerank/betweenness centrality,
 * community (label propagation), critical path, and degree-of-interest — each on a fixture with a
 * known answer. Pure functions over the dependency-free index.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import {
  buildIndex,
  degreeCentrality,
  pagerank,
  betweenness,
  community,
  criticalPath,
  degreeOfInterest,
} from '../src/index.js';

const n = (id: string) => ({ id: nodeId(id), kind: 'entity' as const });
const e = (id: string, s: string, t: string) => ({ id: edgeId(id), source: nodeId(s), target: nodeId(t) });
const graph = (nodes: string[], edges: [string, string, string][]): CanonicalGraph => ({
  directed: true,
  multigraph: false,
  nodes: nodes.map(n),
  edges: edges.map(([id, s, t]) => e(id, s, t)),
  graph: {},
});

// a→b→d→e, a→c→d, x→y
const dag = () =>
  graph(['a', 'b', 'c', 'd', 'e', 'x', 'y'], [
    ['a-b', 'a', 'b'], ['a-c', 'a', 'c'], ['b-d', 'b', 'd'], ['c-d', 'c', 'd'], ['d-e', 'd', 'e'], ['x-y', 'x', 'y'],
  ]);

describe('degree centrality', () => {
  it('counts incident edges; d (in-degree 2) is the most connected', () => {
    const deg = degreeCentrality(buildIndex(dag()));
    expect(deg.get('d')).toBe(3); // in: b-d, c-d; out: d-e
    expect(deg.get('a')).toBe(2); // out: a-b, a-c
    expect([...deg.values()].every((v) => v >= 0)).toBe(true);
    const max = [...deg.entries()].sort((p, q) => q[1] - p[1])[0][0];
    expect(max).toBe('d');
  });
});

describe('pagerank', () => {
  it('sums to ~1 and ranks a hub (3 in-links) highest', () => {
    const star = graph(['h', 'a', 'b', 'c'], [['ah', 'a', 'h'], ['bh', 'b', 'h'], ['ch', 'c', 'h']]);
    const pr = pagerank(buildIndex(star));
    const total = [...pr.values()].reduce((s, v) => s + v, 0);
    expect(total).toBeCloseTo(1, 5);
    const top = [...pr.entries()].sort((p, q) => q[1] - p[1])[0][0];
    expect(top).toBe('h');
  });
});

describe('betweenness (Brandes, directed, unnormalized)', () => {
  it('on a directed path a→b→c→d: interior nodes carry flow, endpoints are 0', () => {
    const path = graph(['a', 'b', 'c', 'd'], [['ab', 'a', 'b'], ['bc', 'b', 'c'], ['cd', 'c', 'd']]);
    const cb = betweenness(buildIndex(path), { normalized: false });
    expect(cb.get('a')).toBe(0);
    expect(cb.get('d')).toBe(0);
    expect(cb.get('b')).toBe(2);
    expect(cb.get('c')).toBe(2);
  });

  it('does NOT double-count parallel edges (a⇒b ∥, a→c, b→d, c→d → b == c == 0.5)', () => {
    // two competing length-2 paths a→d (via b, via c); parallel a→b edges must not inflate sigma.
    const g = graph(['a', 'b', 'c', 'd'], [
      ['ab1', 'a', 'b'], ['ab2', 'a', 'b'], ['ac', 'a', 'c'], ['bd', 'b', 'd'], ['cd', 'c', 'd'],
    ]);
    const cb = betweenness(buildIndex(g), { normalized: false });
    expect(cb.get('b')).toBeCloseTo(0.5, 10);
    expect(cb.get('c')).toBeCloseTo(0.5, 10);
    expect(cb.get('a')).toBe(0);
    expect(cb.get('d')).toBe(0);
  });
});

describe('community (label propagation)', () => {
  it('partitions two triangles into two communities', () => {
    const g = graph(
      ['a', 'b', 'c', 'd', 'e', 'f'],
      [
        ['ab', 'a', 'b'], ['bc', 'b', 'c'], ['ca', 'c', 'a'],
        ['de', 'd', 'e'], ['ef', 'e', 'f'], ['fd', 'f', 'd'],
      ],
    );
    const com = community(buildIndex(g));
    expect(com.get('a')).toBe(com.get('b'));
    expect(com.get('b')).toBe(com.get('c'));
    expect(com.get('d')).toBe(com.get('e'));
    expect(com.get('e')).toBe(com.get('f'));
    expect(com.get('a')).not.toBe(com.get('d'));
    expect(new Set(com.values()).size).toBe(2);
  });
});

describe('critical path', () => {
  it('finds the longest path through the DAG (3 edges, a → … → e)', () => {
    const walk = criticalPath(buildIndex(dag()));
    expect(walk).not.toBeNull();
    expect(walk!.edges.length).toBe(3);
    expect(walk!.nodes[0]).toBe('a');
    expect(walk!.nodes[walk!.nodes.length - 1]).toBe('e');
  });

  it('returns null on a cyclic graph', () => {
    const cyc = graph(['a', 'b', 'c'], [['ab', 'a', 'b'], ['bc', 'b', 'c'], ['ca', 'c', 'a']]);
    expect(criticalPath(buildIndex(cyc))).toBeNull();
  });
});

describe('degree-of-interest', () => {
  it('peaks at the focus and decays with distance', () => {
    const doi = degreeOfInterest(buildIndex(dag()), ['a']);
    const top = [...doi.entries()].sort((p, q) => q[1] - p[1])[0][0];
    expect(top).toBe('a');
    expect(doi.get('e')!).toBeLessThan(doi.get('b')!); // e is far (3 hops), b is adjacent
  });
});
