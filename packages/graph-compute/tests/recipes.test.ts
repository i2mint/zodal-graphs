/**
 * Tests for analysis view-recipes (issue #31): the recipe registry + buildView, which compose the
 * primitives into declarative ViewSpecs. Pure functions — assert the produced specs.
 */

import { describe, it, expect } from 'vitest';
import { RECIPES, recipe, buildView } from '../src/index.js';

describe('recipe registry', () => {
  it('exposes the built-in recipes with unique ids', () => {
    const ids = RECIPES.map((r) => r.id);
    expect(ids).toEqual([
      'importance-map', 'communities', 'results-chain', 'critical-path', 'trace-lineage', 'ego-network',
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(recipe('communities')?.label).toBe('Communities');
    expect(recipe('nope')).toBeUndefined();
  });
});

describe('buildView — focus-free recipes', () => {
  it('importance-map sizes by pagerank, highlights top centrality', () => {
    const v = buildView('importance-map')!;
    expect(v.layout.algorithm).toBe('circular');
    expect(v.style?.sizeBy).toBe('pagerank');
    expect(v.style?.colorBy).toBe('type');
    expect(v.overlays?.centrality).toEqual({ kind: 'pagerank', topFraction: 0.1 });
    expect(v.note).toMatch(/PageRank/);
  });

  it('communities colours by community + requests the community overlay', () => {
    const v = buildView('communities')!;
    expect(v.style?.colorBy).toBe('community');
    expect(v.overlays?.community).toBe(true);
  });

  it('results-chain is a left-to-right layered layout, no overlays', () => {
    const v = buildView('results-chain')!;
    expect(v.layout).toEqual({ algorithm: 'hierarchical', direction: 'LR' });
    expect(v.overlays).toBeUndefined();
  });

  it('critical-path requests the criticalPath overlay', () => {
    expect(buildView('critical-path')!.overlays?.criticalPath).toBe(true);
  });
});

describe('buildView — focus recipes', () => {
  it('returns null when a focus-based recipe gets no focus', () => {
    expect(buildView('trace-lineage')).toBeNull();
    expect(buildView('ego-network', {})).toBeNull();
  });

  it('trace-lineage targets ancestors + descendants of the focus', () => {
    const v = buildView('trace-lineage', { focus: 'outcome:x' })!;
    expect(v.overlays?.ancestorsOf).toBe('outcome:x');
    expect(v.overlays?.descendantsOf).toBe('outcome:x');
    expect(v.layout.algorithm).toBe('hierarchical');
  });

  it('ego-network requests a k-hop neighborhood around the focus', () => {
    const v = buildView('ego-network', { focus: 'project:p', radius: 3 })!;
    expect(v.layout.algorithm).toBe('radial');
    expect(v.overlays?.neighborhood).toEqual({ focus: ['project:p'], radius: 3, direction: 'both' });
  });

  it('ego-network defaults radius to 2', () => {
    expect(buildView('ego-network', { focus: 'project:p' })!.overlays?.neighborhood?.radius).toBe(2);
  });
});

describe('buildView — unknown', () => {
  it('returns null for an unknown recipe id', () => {
    expect(buildView('does-not-exist')).toBeNull();
  });
});

describe('recipe.build — direct call guard', () => {
  it('a focus recipe.build() called directly without focus throws a clear error (not a cryptic TypeError)', () => {
    expect(() => recipe('trace-lineage')!.build()).toThrow(/requires a focus/);
    expect(() => recipe('ego-network')!.build({})).toThrow(/requires a focus/);
  });
});
