/** Timeline brush → GraphFilter: the window keeps overlapping (or Allen-related) annotations. */
import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { applyFilter } from '@zodal/graph-compute';
import { brushFilter, brushedIds, interval, toTimeline, WITHIN } from '../src/headless.js';

const graph = {
  directed: true,
  multigraph: false,
  graph: {},
  nodes: [
    { id: 'early', kind: 'entity', data: { tier: 'words', start: 0, end: 2 } },
    { id: 'mid', kind: 'entity', data: { tier: 'words', start: 3, end: 5 } },
    { id: 'late', kind: 'entity', data: { tier: 'words', start: 8, end: 9 } },
    { id: 'speaker', kind: 'entity' },
  ],
  edges: [
    { id: 's-mid', source: 'speaker', target: 'mid' },
    { id: 's-late', source: 'speaker', target: 'late' },
  ],
} as CanonicalGraph;
const model = toTimeline(graph);

describe('brushFilter', () => {
  it('keeps the annotations overlapping the window and, by default, the untimed nodes', () => {
    const filter = brushFilter(model, interval(1, 4));
    expect(filter.mode).toBe('fade');
    const result = applyFilter(graph, filter);
    expect(result.selection.nodes.sort()).toEqual(['early', 'mid', 'speaker']);
    expect(result.selection.edges).toEqual(['s-mid']);
  });

  it('keepUntimed: false keeps only the brushed annotations', () => {
    const result = applyFilter(graph, brushFilter(model, interval(1, 4), { keepUntimed: false, mode: 'hide' }));
    expect(result.selection.nodes.sort()).toEqual(['early', 'mid']);
  });

  it('Allen relations narrow the brush (WITHIN keeps only what is inside)', () => {
    expect(brushedIds(model, interval(1, 6)).sort()).toEqual(['early', 'mid']);
    expect(brushedIds(model, interval(1, 6), { relations: WITHIN })).toEqual(['mid']);
  });

  it('is serializable data', () => {
    const filter = brushFilter(model, interval(1, 4));
    expect(JSON.parse(JSON.stringify(filter))).toEqual(filter);
  });
});

describe('brushFilter range form (plain numeric times)', () => {
  const rangeOf = (g: CanonicalGraph, w: ReturnType<typeof interval>, options = {}) =>
    applyFilter(g, brushFilter(toTimeline(g), w, options)).selection.nodes.sort();
  const idsOf = (g: CanonicalGraph, w: ReturnType<typeof interval>, options = {}) =>
    applyFilter(g, brushFilter(toTimeline(g), w, { ...options, form: 'ids' })).selection.nodes.sort();

  it('emits data.start/data.end predicates, not an id list', () => {
    const json = JSON.stringify(brushFilter(model, interval(1, 4)));
    expect(json).toContain('data.start');
    expect(json).not.toContain('"op":"in"');
    expect(JSON.stringify(brushFilter(model, interval(1, 4), { form: 'ids' }))).toContain('"op":"in"');
  });

  it('matches the id snapshot on half-open boundaries and instants', () => {
    const edges = {
      ...graph,
      nodes: [
        ...graph.nodes,
        { id: 'ends-at-1', kind: 'entity', data: { tier: 't', start: 0, end: 1 } },
        { id: 'starts-at-4', kind: 'entity', data: { tier: 't', start: 4, end: 6 } },
        { id: 'instant-1', kind: 'entity', data: { tier: 't', start: 1, end: 1 } },
        { id: 'instant-4', kind: 'entity', data: { tier: 't', start: 4, end: 4 } },
        { id: 'instant-2', kind: 'entity', data: { tier: 't', start: 2, end: 2 } },
        { id: 'no-tier', kind: 'entity', data: { start: 2, end: 3 } },
      ],
    } as CanonicalGraph;
    for (const w of [interval(1, 4), interval(2, 2), interval(4, 4), interval(-1, 20)]) {
      for (const keepUntimed of [true, false]) {
        expect(rangeOf(edges, w, { keepUntimed })).toEqual(idsOf(edges, w, { keepUntimed }));
      }
    }
    expect(rangeOf(edges, interval(1, 4), { keepUntimed: false })).toEqual(['early', 'instant-1', 'instant-2', 'mid']);
  });

  it('stays correct when the graph gains nodes', () => {
    const filter = brushFilter(model, interval(1, 4), { keepUntimed: false });
    const grown = {
      ...graph,
      nodes: [...graph.nodes, { id: 'new', kind: 'entity', data: { tier: 'words', start: 2, end: 3 } }],
    } as CanonicalGraph;
    expect(applyFilter(grown, filter).selection.nodes.sort()).toEqual(['early', 'mid', 'new']);
  });

  it('falls back to the id snapshot for relations and rational times', () => {
    expect(JSON.stringify(brushFilter(model, interval(1, 6), { relations: WITHIN }))).toContain('"op":"in"');
    const rational = {
      ...graph,
      nodes: [{ id: 'r', kind: 'entity', data: { tier: 'w', start: { v: 1, r: 2 }, end: 3 } }],
    } as CanonicalGraph;
    const rm = toTimeline(rational);
    expect(rm.numericTimes).toBe(false);
    const filter = brushFilter(rm, interval(0, 1));
    expect(JSON.stringify(filter)).toContain('"op":"in"');
    expect(applyFilter(rational, filter).selection.nodes).toEqual(['r']);
    expect(JSON.stringify(brushFilter(model, interval({ v: 1, r: 2 }, 4)))).toContain('"op":"in"');
  });
});
