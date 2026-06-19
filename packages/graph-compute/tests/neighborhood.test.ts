/**
 * Tests for bounded k-hop neighborhood / ego extraction (issue #26).
 * Focus = `primary`, each ring = `hop-<d>`; radius bounds the BFS; direction controls in/out/both.
 */

import { describe, it, expect } from 'vitest';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { createTraversalEngine, computeOverlays, neighborhood, buildIndex } from '../src/index.js';
import { dag } from './fixtures.js';

// dag(): a→b→d→e, a→c→d, x→y
const idx = buildIndex(dag());
const eng = createTraversalEngine(dag());

const band = (nodes: Record<string, string>, role: string): string[] =>
  Object.keys(nodes).filter((k) => nodes[k] === role).sort();

describe('neighborhood distance map', () => {
  it('forward radius 1 from a → a:0, b:1, c:1 (and nothing deeper)', () => {
    const d = neighborhood(idx, ['a'], { radius: 1, direction: 'forward' });
    expect(d.get('a')).toBe(0);
    expect(d.get('b')).toBe(1);
    expect(d.get('c')).toBe(1);
    expect(d.has('d')).toBe(false);
  });

  it('forward radius 3 reaches d:2 then e:3', () => {
    const d = neighborhood(idx, ['a'], { radius: 3, direction: 'forward' });
    expect(d.get('d')).toBe(2);
    expect(d.get('e')).toBe(3);
  });

  it('radius bounds the BFS (radius 2 excludes e)', () => {
    const d = neighborhood(idx, ['a'], { radius: 2, direction: 'forward' });
    expect(d.has('e')).toBe(false);
    expect(d.get('d')).toBe(2);
  });

  it("direction 'both' is the undirected ego graph (from d, radius 1 → b,c,e)", () => {
    const d = neighborhood(idx, ['d'], { radius: 1, direction: 'both' });
    expect(d.get('d')).toBe(0);
    expect([...d.keys()].sort()).toEqual(['b', 'c', 'd', 'e']);
  });

  it('backward radius 1 from d → its predecessors b, c', () => {
    const d = neighborhood(idx, ['d'], { radius: 1, direction: 'backward' });
    expect(d.get('b')).toBe(1);
    expect(d.get('c')).toBe(1);
    expect(d.has('a')).toBe(false);
  });

  it('multiple focus nodes are all distance 0', () => {
    const d = neighborhood(idx, ['a', 'x'], { radius: 1, direction: 'forward' });
    expect(d.get('a')).toBe(0);
    expect(d.get('x')).toBe(0);
    expect(d.get('y')).toBe(1);
  });
});

describe('neighborhood overlay layer', () => {
  it('emits primary + per-hop band roles and induced edges', () => {
    const layer = eng.neighborhood(['a'], { radius: 2, direction: 'forward' });
    expect(layer.layer).toBe('neighborhood');
    expect(layer.nodes['a']).toBe('primary');
    expect(band(layer.nodes, 'hop-1')).toEqual(['b', 'c']);
    expect(band(layer.nodes, 'hop-2')).toEqual(['d']);
    // induced edges among in-neighborhood nodes are marked related
    expect(layer.edges!['a-b']).toBe('related');
    expect(layer.edges!['b-d']).toBe('related');
  });
});

describe('capability gating', () => {
  it('refuses the neighborhood overlay when the kind is not declared', () => {
    const caps = resolveGraphCapabilities({ traversal: [] });
    const res = computeOverlays(dag(), { neighborhood: { focus: ['a'], radius: 1 } }, caps);
    expect(res.overlays.highlights).toHaveLength(0);
    expect(res.refused).toEqual([
      { request: 'neighborhood', reason: 'traversal', kind: 'neighborhood' },
    ]);
  });

  it('computes it when declared', () => {
    const caps = resolveGraphCapabilities({ traversal: ['neighborhood'] });
    const res = computeOverlays(dag(), { neighborhood: { focus: ['a'], radius: 1 } }, caps);
    expect(res.overlays.highlights[0].layer).toBe('neighborhood');
    expect(res.refused).toHaveLength(0);
  });
});
