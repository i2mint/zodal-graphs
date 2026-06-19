/**
 * Tests for the layout engine (issue #25): layered-by-rank, radial/ego, swimlane, circular,
 * preset, and applyLayout round-trip. Positions are renderer-agnostic id→{x,y} maps.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import { layout, applyLayout } from '../src/index.js';

// a→b→d→e, a→c→d  (diamond DAG) + isolated x
const n = (id: string, type?: string) => ({ id: nodeId(id), kind: 'entity' as const, type });
const e = (id: string, s: string, t: string) => ({ id: edgeId(id), source: nodeId(s), target: nodeId(t) });
const dag = (): CanonicalGraph => ({
  directed: true,
  multigraph: false,
  nodes: [n('a', 'A'), n('b', 'B'), n('c', 'B'), n('d', 'A'), n('e', 'B')],
  edges: [e('a-b', 'a', 'b'), e('a-c', 'a', 'c'), e('b-d', 'b', 'd'), e('c-d', 'c', 'd'), e('d-e', 'd', 'e')],
  graph: {},
});

describe('layered (hierarchical) layout', () => {
  it('tiers nodes by longest-path rank (TB): a<b,c<d<e on the rank axis', () => {
    const p = layout(dag(), { algorithm: 'hierarchical', direction: 'TB' }, { rankSep: 100, nodeSep: 50 });
    expect(p['a'].y).toBe(0); // rank 0
    expect(p['b'].y).toBe(100); // rank 1
    expect(p['c'].y).toBe(100); // same rank as b
    expect(p['d'].y).toBe(200); // rank 2 (longest path through b or c)
    expect(p['e'].y).toBe(300); // rank 3
  });

  it('LR direction puts ranks on the x axis', () => {
    const p = layout(dag(), { algorithm: 'hierarchical', direction: 'LR' }, { rankSep: 100 });
    expect(p['a'].x).toBe(0);
    expect(p['e'].x).toBe(300);
    expect(p['b'].x).toBe(p['c'].x); // same rank
  });

  it('honors a custom rankBy', () => {
    const p = layout(
      dag(),
      { algorithm: 'hierarchical', direction: 'TB' },
      { rankBy: (id) => (id === 'a' ? 0 : 1), rankSep: 10 },
    );
    expect(p['a'].y).toBe(0);
    expect(p['b'].y).toBe(10);
    expect(p['e'].y).toBe(10);
  });
});

describe('radial (ego) layout', () => {
  it('places the focus at the centre and rings by hop distance', () => {
    const p = layout(dag(), { algorithm: 'radial', params: { focus: ['a'] } }, { rankSep: 100 });
    expect(p['a']).toEqual({ x: 0, y: 0 });
    const radius = (id: string) => Math.round(Math.hypot(p[id].x, p[id].y));
    expect(radius('b')).toBe(100); // ring 1
    expect(radius('c')).toBe(100);
    expect(radius('d')).toBe(200); // ring 2
    expect(radius('e')).toBe(300); // ring 3
  });
});

describe('swimlane layout', () => {
  it('partitions nodes into lanes by node type (default)', () => {
    const p = layout(dag(), { algorithm: 'swimlane', direction: 'TB' }, { rankSep: 200 });
    // type A = lane 0 (x=0), type B = lane 1 (x=200)
    expect(p['a'].x).toBe(0);
    expect(p['d'].x).toBe(0);
    expect(p['b'].x).toBe(200);
    expect(p['c'].x).toBe(200);
    expect(p['e'].x).toBe(200);
  });
});

describe('circular / preset / applyLayout', () => {
  it('circular places every node on one ring (equal radius)', () => {
    const p = layout(dag(), { algorithm: 'circular' }, { nodeSep: 60 });
    const radii = Object.values(p).map((q) => Math.round(Math.hypot(q.x, q.y)));
    expect(new Set(radii).size).toBe(1);
  });

  it('preset passes positions through unchanged', () => {
    const positions = { a: { x: 1, y: 2 } };
    const p = layout(dag(), { algorithm: 'preset', positions });
    expect(p['a']).toEqual({ x: 1, y: 2 });
  });

  it('applyLayout returns a GraphLayout with positions filled', () => {
    const spec = applyLayout(dag(), { algorithm: 'hierarchical', direction: 'TB' });
    expect(spec.algorithm).toBe('hierarchical');
    expect(Object.keys(spec.positions ?? {})).toContain('a');
  });
});
