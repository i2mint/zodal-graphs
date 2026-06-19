/**
 * Tests for the declarative GraphFilter engine (issue #27): predicate matching (leaf + composite),
 * node/edge selection with induced edges, hide vs fade modes, faceting and search.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import { applyFilter, facet, search, matches } from '../src/index.js';

const n = (id: string, type: string, data?: Record<string, unknown>) => ({
  id: nodeId(id),
  kind: 'entity' as const,
  type,
  data,
});
const e = (id: string, s: string, t: string, type: string) => ({
  id: edgeId(id),
  source: nodeId(s),
  target: nodeId(t),
  type,
});

// a(donor)→b(project)→c(outcome), b→d(outcome)
const g = (): CanonicalGraph => ({
  directed: true,
  multigraph: false,
  nodes: [
    n('a', 'donor', { scope: 'bureau' }),
    n('b', 'project', { scope: 'country' }),
    n('c', 'outcome', { value: 5 }),
    n('d', 'outcome', { value: 20 }),
  ],
  edges: [e('e1', 'a', 'b', 'funds'), e('e2', 'b', 'c', 'delivers'), e('e3', 'b', 'd', 'delivers')],
  graph: {},
});

describe('applyFilter — node predicate + induced edges', () => {
  it('selects nodes by type; edges are those induced by the matched node set', () => {
    const r = applyFilter(g(), { nodes: { field: 'type', op: 'eq', value: 'outcome' } });
    expect(r.selection.nodes.sort()).toEqual(['c', 'd']);
    expect(r.selection.edges).toEqual([]); // no edge connects c and d
    expect(r.counts).toEqual({ nodes: 2, edges: 0 });
  });

  it('fade mode (default) dims every non-matching node and edge', () => {
    const r = applyFilter(g(), { nodes: { field: 'type', op: 'eq', value: 'outcome' } });
    const layer = r.overlays.highlights[0];
    expect(layer.layer).toBe('filter');
    expect(layer.nodes['a']).toBe('dimmed');
    expect(layer.nodes['b']).toBe('dimmed');
    expect(layer.nodes['c']).toBeUndefined(); // matched → not dimmed
    expect(layer.edges!['e1']).toBe('dimmed');
  });

  it('hide mode emits no overlay; the selection is the subgraph', () => {
    const r = applyFilter(g(), { nodes: { field: 'type', op: 'eq', value: 'project' }, mode: 'hide' });
    expect(r.overlays.highlights).toHaveLength(0);
    expect(r.selection.nodes).toEqual(['b']);
  });
});

describe('predicate forms', () => {
  it('data-field equality (data.scope)', () => {
    const r = applyFilter(g(), { nodes: { field: 'data.scope', op: 'eq', value: 'country' } });
    expect(r.selection.nodes).toEqual(['b']);
  });

  it('numeric range on a bare data key', () => {
    const r = applyFilter(g(), { nodes: { field: 'value', op: 'gt', value: 10 } });
    expect(r.selection.nodes).toEqual(['d']);
  });

  it('any / not composites', () => {
    const anyR = applyFilter(g(), {
      nodes: { any: [{ field: 'type', op: 'eq', value: 'donor' }, { field: 'type', op: 'eq', value: 'project' }] },
    });
    expect(anyR.selection.nodes.sort()).toEqual(['a', 'b']);
    const notR = applyFilter(g(), { nodes: { not: { field: 'type', op: 'eq', value: 'outcome' } } });
    expect(notR.selection.nodes.sort()).toEqual(['a', 'b']);
  });

  it('edge predicate selects edges directly (nodes omitted → all match)', () => {
    const r = applyFilter(g(), { edges: { field: 'type', op: 'eq', value: 'delivers' } });
    expect(r.selection.edges.sort()).toEqual(['e2', 'e3']);
    expect(r.counts.nodes).toBe(4);
  });

  it('matches() handles in / contains / exists', () => {
    const node = n('x', 'donor', { name: 'Netherlands' });
    expect(matches(node, { field: 'type', op: 'in', value: ['donor', 'project'] })).toBe(true);
    expect(matches(node, { field: 'name', op: 'contains', value: 'land' })).toBe(true);
    expect(matches(node, { field: 'missing', op: 'exists' })).toBe(false);
  });
});

describe('facet & search', () => {
  it('facet counts nodes by a field', () => {
    expect(facet(g(), 'type')).toEqual({ donor: 1, project: 1, outcome: 2 });
  });

  it('search finds nodes by substring across id/type/data', () => {
    expect(search(g(), 'out').sort()).toEqual(['c', 'd']); // type "outcome"
    expect(search(g(), 'bureau')).toEqual(['a']); // data.scope
  });
});
