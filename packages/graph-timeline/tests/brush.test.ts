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
