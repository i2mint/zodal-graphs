/**
 * Tests for timeline data shaping from a canonical graph + the window / Allen-relation queries.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId } from '@zodal/graph-core';
import { toTimeline, annotationsInWindow, annotationsRelated, timelineExtent, interval, toNumber } from '../src/headless.js';

function annotated(): CanonicalGraph {
  return {
    directed: true,
    multigraph: false,
    nodes: [
      { id: nodeId('a'), kind: 'entity', data: { tier: 'phrase', start: 0, end: 5, stereotype: 'none' } },
      { id: nodeId('b'), kind: 'entity', data: { tier: 'words', start: 1, end: 3, parentTier: 'phrase', stereotype: 'included-in' } },
      { id: nodeId('c'), kind: 'entity', data: { tier: 'words', start: 6, end: 9 } },
      { id: nodeId('plain'), kind: 'entity', data: { label: 'no interval' } }, // skipped (no tier/start/end)
    ],
    edges: [],
    graph: {},
  };
}

describe('toTimeline', () => {
  it('shapes interval-bearing nodes into tiers + annotations, skipping the rest', () => {
    const model = toTimeline(annotated());
    expect(model.annotations.map((a) => a.id).sort()).toEqual(['a', 'b', 'c']); // 'plain' skipped
    expect(model.tiers.map((t) => t.id).sort()).toEqual(['phrase', 'words']);
    const words = model.tiers.find((t) => t.id === 'words')!;
    expect(words.stereotype).toBe('included-in');
    expect(words.parent).toBe('phrase');
  });

  it('throws on a malformed start/end', () => {
    const bad: CanonicalGraph = {
      directed: true, multigraph: false,
      nodes: [{ id: nodeId('x'), kind: 'entity', data: { tier: 't', start: 'nope', end: 5 } }],
      edges: [], graph: {},
    };
    expect(() => toTimeline(bad)).toThrow(/number or .*rational/);
  });
});

describe('queries', () => {
  const model = toTimeline(annotated());

  it('annotationsInWindow returns intersecting annotations (brushing)', () => {
    const inWindow = annotationsInWindow(model, interval(2, 7)).map((a) => a.id).sort();
    expect(inWindow).toEqual(['a', 'b', 'c']); // a[0,5)∩, b[1,3)∩, c[6,9)∩ all touch [2,7)
    const narrow = annotationsInWindow(model, interval(3, 4)).map((a) => a.id).sort();
    expect(narrow).toEqual(['a']); // b[1,3) ends at 3 (exclusive), c[6,9) is later
  });

  it('annotationsRelated runs an Allen-relation query', () => {
    // which annotations are DURING the phrase a[0,5)?  b[1,3) is during.
    const during = annotationsRelated(model, interval(0, 5), ['during']).map((a) => a.id);
    expect(during).toEqual(['b']);
  });

  it('timelineExtent spans min start to max end', () => {
    const extent = timelineExtent(model)!;
    expect(toNumber(extent.start)).toBe(0);
    expect(toNumber(extent.end)).toBe(9);
  });

  it('timelineExtent is null for an empty model', () => {
    expect(timelineExtent({ tiers: [], annotations: [] })).toBeNull();
  });
});
