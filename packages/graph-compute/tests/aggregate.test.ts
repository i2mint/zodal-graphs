/**
 * Tests for aggregation (issue #28): group-by → weighted meta-graph, and collapse-a-set → meta-node
 * with rewired edges.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import { aggregate, collapse } from '../src/index.js';

const node = (id: string, type: string, data?: Record<string, unknown>) => ({
  id: nodeId(id),
  kind: 'entity' as const,
  type,
  data,
});
const edge = (id: string, s: string, t: string) => ({ id: edgeId(id), source: nodeId(s), target: nodeId(t) });

// donor d1,d2 → projects p1,p2 → outcomes o1,o2
const g = (): CanonicalGraph => ({
  directed: true,
  multigraph: false,
  nodes: [
    node('d1', 'donor'), node('d2', 'donor'),
    node('p1', 'project'), node('p2', 'project'),
    node('o1', 'outcome'), node('o2', 'outcome'),
  ],
  edges: [
    edge('f1', 'd1', 'p1'), edge('f2', 'd2', 'p1'), edge('f3', 'd2', 'p2'), // 3 donor→project
    edge('c1', 'p1', 'o1'), edge('c2', 'p1', 'o2'), edge('c3', 'p2', 'o2'), // 3 project→outcome
  ],
});

describe('aggregate (group by type)', () => {
  const { graph, members } = aggregate(g(), 'type');

  it('produces one meta-node per group with member counts', () => {
    const byId = Object.fromEntries(graph.nodes.map((n) => [n.id, n]));
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['meta:donor', 'meta:outcome', 'meta:project']);
    expect((byId['meta:donor'].data as { count: number }).count).toBe(2);
    expect((byId['meta:project'].data as { count: number }).count).toBe(2);
    expect(members['meta:donor'].sort()).toEqual(['d1', 'd2']);
  });

  it('sums cross-group edges into weighted meta-edges; omits intra-group', () => {
    const w = Object.fromEntries(graph.edges.map((e) => [`${e.source}->${e.target}`, (e.data as { weight: number }).weight]));
    expect(w['meta:donor->meta:project']).toBe(3); // f1,f2,f3
    expect(w['meta:project->meta:outcome']).toBe(3); // c1,c2,c3
    expect(graph.edges.length).toBe(2);
  });

  it('includeSingletons:false drops size-1 groups', () => {
    const solo = {
      ...g(),
      nodes: [...g().nodes, node('x', 'cross_cutting_area')],
    };
    const res = aggregate(solo, 'type', { includeSingletons: false });
    expect(res.graph.nodes.map((n) => n.id)).not.toContain('meta:cross_cutting_area');
  });
});

describe('collapse (fold a set, keep the rest)', () => {
  it('replaces the set with a meta-node and rewires crossing edges', () => {
    const res = collapse(g(), ['p1', 'p2'], { metaId: 'meta:projects', label: 'Projects' });
    const ids = res.graph.nodes.map((n) => n.id);
    expect(ids).toContain('meta:projects');
    expect(ids).not.toContain('p1');
    expect(ids).not.toContain('p2');
    expect(ids).toContain('d1'); // others kept
    // donor→project edges now point at the meta-node (d1→meta:projects weight 1, d2→meta:projects weight 2)
    const intoMeta = res.graph.edges.filter((e) => e.target === 'meta:projects');
    const fromMeta = res.graph.edges.filter((e) => e.source === 'meta:projects');
    const wIn = Object.fromEntries(intoMeta.map((e) => [e.source, (e.data as { weight: number }).weight]));
    expect(wIn['d2']).toBe(2); // f2 (d2→p1) + f3 (d2→p2)
    expect(wIn['d1']).toBe(1);
    expect(fromMeta.length).toBe(2); // meta→o1, meta→o2
  });

  it('throws if metaId collides with an existing node id (no silent corruption)', () => {
    expect(() => collapse(g(), ['p1', 'p2'], { metaId: 'd1' })).toThrow(/collides/);
  });
});

describe('aggregate edge cases (from adversarial review)', () => {
  it('keeps edges for a legitimate empty-string group key', () => {
    const g2: CanonicalGraph = {
      directed: true, multigraph: false, graph: {},
      nodes: [node('a', ''), node('b', 'project')],
      edges: [edge('e', 'a', 'b')],
    };
    const { graph } = aggregate(g2, 'type');
    expect(graph.nodes.map((n) => n.id).sort()).toEqual(['meta:', 'meta:project']);
    expect(graph.edges.length).toBe(1);
    expect((graph.edges[0].data as { weight: number }).weight).toBe(1);
  });
});
