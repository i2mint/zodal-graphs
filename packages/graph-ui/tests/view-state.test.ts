/** The shared view state: pure transitions (with no-op identity), the combined filter, the linked
 *  overlays a node-link renderer draws, and the subscribable store. */
import { describe, it, expect, vi } from 'vitest';
import type { CanonicalGraph, GraphFilter } from '@zodal/graph-core';
import {
  initGraphViewState,
  setActiveView,
  setSelection,
  clearSelection,
  setFilter,
  clearFilters,
  setHovered,
  pickSelection,
  linkedFilterResult,
  linkedOverlays,
  createGraphViewStore,
} from '../src/index.js';

const graph: CanonicalGraph = {
  directed: true,
  multigraph: false,
  graph: {},
  nodes: [
    { id: 'a', kind: 'entity', type: 'person', data: { team: 'x' } },
    { id: 'b', kind: 'entity', type: 'person', data: { team: 'y' } },
    { id: 'c', kind: 'entity', type: 'place', data: { team: 'x' } },
  ],
  edges: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'ac', source: 'a', target: 'c' },
  ],
} as CanonicalGraph;

const people: GraphFilter = { nodes: { field: 'type', op: 'eq', value: 'person' } };
const teamX: GraphFilter = { nodes: { field: 'team', op: 'eq', value: 'x' } };

describe('transitions', () => {
  it('starts on the first declared view with nothing shared', () => {
    const s = initGraphViewState({ views: ['node-link', 'table'] });
    expect(s).toEqual({ activeView: 'node-link', selection: { nodes: [], edges: [] }, filters: {}, hovered: null });
    expect(initGraphViewState().activeView).toBe('table');
  });

  it('a view switch keeps selection, filters and hover; a refused view is a no-op', () => {
    let s = initGraphViewState({ views: ['node-link', 'table'] });
    s = setFilter(setSelection(s, { nodes: ['a'] }), 'facet', people);
    const switched = setActiveView(s, 'table');
    expect(switched.activeView).toBe('table');
    expect(switched.selection).toBe(s.selection);
    expect(switched.filters).toBe(s.filters);
    expect(setActiveView(s, 'matrix', { views: ['node-link', 'table'] })).toBe(s);
  });

  it('returns the same object when nothing changed', () => {
    const s = setHovered(setFilter(setSelection(initGraphViewState(), { nodes: ['a'] }), 'f', people), { kind: 'node', id: 'a' });
    expect(setSelection(s, { nodes: ['a'] })).toBe(s);
    expect(setFilter(s, 'f', { nodes: { field: 'type', op: 'eq', value: 'person' } })).toBe(s);
    expect(setFilter(s, 'f', { nodes: { value: 'person', op: 'eq', field: 'type' } })).toBe(s); // key order
    expect(setFilter(s, 'other', null)).toBe(s);
    expect(setHovered(s, { kind: 'node', id: 'a' })).toBe(s);
    expect(setActiveView(s, s.activeView)).toBe(s);
    const empty = initGraphViewState();
    expect(clearFilters(empty)).toBe(empty);
    expect(clearSelection(empty)).toBe(empty);
  });

  it('a partial selection keeps the other kind; new ids drop a stale name', () => {
    let s = setSelection(initGraphViewState(), { nodes: ['a'], edges: ['ab'], name: 'scene' });
    expect(setSelection(s, { name: 'renamed' }).selection.name).toBe('renamed');
    s = setSelection(s, { nodes: ['b', 'c'] });
    expect(s.selection).toEqual({ nodes: ['b', 'c'], edges: ['ab'] });
    expect(clearSelection(s).selection).toEqual({ nodes: [], edges: [] });
  });

  it('filters are owned: setting one owner keeps the others, null removes it', () => {
    let s = setFilter(setFilter(initGraphViewState(), 'facet', people), 'timeline', teamX);
    expect(Object.keys(s.filters).sort()).toEqual(['facet', 'timeline']);
    s = setFilter(s, 'facet', null);
    expect(Object.keys(s.filters)).toEqual(['timeline']);
    // copied in: mutating the caller's object later does not change the state
    const mine: GraphFilter = { nodes: { field: 'type', op: 'eq', value: 'person' } };
    const t = setFilter(s, 'mine', mine);
    (mine.nodes as { value: unknown }).value = 'place';
    expect(t.filters.mine).toEqual(people);
    expect(clearFilters(s).filters).toEqual({});
  });
});

describe('linkedFilterResult (crossfilter)', () => {
  it('is null with no filters', () => {
    expect(linkedFilterResult(graph, initGraphViewState())).toBeNull();
  });

  it('keeps what every owner keeps', () => {
    const s = setFilter(setFilter(initGraphViewState(), 'facet', people), 'team', teamX);
    const r = linkedFilterResult(graph, s);
    expect(r?.selection.nodes).toEqual(['a']);
    expect(r?.counts).toEqual({ nodes: 1, edges: 0 });
  });

  it('an owner with an edge predicate does not undo another owner\'s induced edges', () => {
    // facet keeps people (a, b) with induced edge ab; the edge owner keeps every edge by id
    const allEdges: GraphFilter = { edges: { field: 'id', op: 'in', value: ['ab', 'ac'] } };
    const r = linkedFilterResult(graph, setFilter(setFilter(initGraphViewState(), 'facet', people), 'edges', allEdges));
    expect(r?.selection.edges).toEqual(['ab']); // ac reaches c, which the facet drops
    expect(r?.overlays.highlights[0].edges).toEqual({ ac: 'dimmed' });
  });

  it('a hide owner hides (with edges to hidden nodes) while a fade owner only dims', () => {
    let s = setFilter(initGraphViewState(), 'facet', { ...people, mode: 'hide' }); // hides c
    s = setFilter(s, 'team', teamX); // fades b
    const r = linkedFilterResult(graph, s);
    expect(r?.hidden).toEqual({ nodes: ['c'], edges: ['ac'] });
    expect(r?.overlays.highlights[0].nodes).toEqual({ b: 'dimmed' });
    expect(r?.overlays.highlights[0].edges).toEqual({ ab: 'dimmed' });
    expect(r?.selection.nodes).toEqual(['a']);
  });

  it('accepts another filter engine', () => {
    const engine = vi.fn(() => ({ selection: { nodes: ['a'], edges: [] }, overlays: { highlights: [] }, counts: { nodes: 1, edges: 0 } }));
    const r = linkedFilterResult(graph, setFilter(initGraphViewState(), 'f', people), { applyFilter: engine });
    expect(engine).toHaveBeenCalledWith(graph, people);
    expect(r?.selection.nodes).toEqual(['a']);
  });
});

describe('linkedOverlays', () => {
  it('is empty for an empty state', () => {
    expect(linkedOverlays(graph, initGraphViewState())).toEqual({ highlights: [] });
  });

  it('draws filter (dimmed), selection (primary) and hover (related) layers', () => {
    expect(linkedOverlays(graph, setHovered(initGraphViewState(), { kind: 'node', id: 'a' })).highlights.map((l) => l.layer)).toEqual(['hover']);
    let s = setFilter(initGraphViewState(), 'facet', people);
    s = setSelection(s, { nodes: ['a'], edges: ['ab'] });
    s = setHovered(s, { kind: 'node', id: 'b' });
    const { highlights } = linkedOverlays(graph, s);
    expect(highlights.map((l) => l.layer)).toEqual(['filter', 'selection', 'hover']);
    expect(highlights[0].nodes).toEqual({ c: 'dimmed' });
    expect(highlights[1]).toEqual({ layer: 'selection', nodes: { a: 'primary' }, edges: { ab: 'primary' } });
    expect(highlights[2]).toEqual({ layer: 'hover', nodes: { b: 'related' } });
  });

  it('a hovered edge goes in the edge map; roles are configurable', () => {
    const s = setHovered(setSelection(initGraphViewState(), { nodes: ['a'] }), { kind: 'edge', id: 'ac' });
    const { highlights } = linkedOverlays(graph, s, { roles: { selected: 'path', hovered: 'focus' } });
    expect(highlights[0].nodes).toEqual({ a: 'path' });
    expect(highlights[1]).toEqual({ layer: 'hover', nodes: {}, edges: { ac: 'focus' } });
  });

  it('a hide-mode filter adds no dimmed layer (the lens draws only the matched subgraph)', () => {
    const s = setFilter(initGraphViewState(), 'f', { ...people, mode: 'hide' });
    expect(linkedOverlays(graph, s).highlights).toEqual([]);
  });
});

describe('createGraphViewStore', () => {
  it('notifies on change with (state, previous), never on a no-op, and unsubscribes', () => {
    const store = createGraphViewStore({ capabilities: { views: ['node-link', 'table'] } });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    const before = store.getState();
    store.setSelection({ nodes: ['a'] });
    expect(listener).toHaveBeenCalledWith(store.getState(), before);
    store.setSelection({ nodes: ['a'] });
    store.setActiveView('matrix'); // not declared: refused
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    store.setFilter('f', people);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().filters.f).toEqual(people);
  });

  it('isolates a throwing listener', () => {
    const onListenerError = vi.fn();
    const store = createGraphViewStore({ onListenerError });
    const good = vi.fn();
    store.subscribe(() => {
      throw new Error('boom');
    });
    store.subscribe(good);
    store.setHovered({ kind: 'node', id: 'a' });
    expect(onListenerError).toHaveBeenCalledOnce();
    expect(good).toHaveBeenCalledOnce();
  });

  it('every action and setState go through the same path', () => {
    const store = createGraphViewStore({ initial: initGraphViewState({ views: ['table', 'node-link'] }) });
    store.setActiveView('node-link');
    store.setFilter('a', people);
    store.clearFilters();
    store.setSelection({ nodes: ['a'] });
    store.clearSelection();
    store.setHovered(null);
    expect(store.getState()).toEqual({ activeView: 'node-link', selection: { nodes: [], edges: [] }, filters: {}, hovered: null });
    const saved = setSelection(store.getState(), { nodes: ['c'] });
    store.setState(saved);
    expect(store.getState()).toBe(saved);
  });
});

describe('pickSelection (a click, the same in every lens)', () => {
  const sel = { nodes: ['a', 'b'], edges: ['e1'] };

  it('a plain click selects the element alone', () => {
    expect(pickSelection(sel, { kind: 'node', id: 'c' })).toEqual({ nodes: ['c'], edges: [] });
    expect(pickSelection(sel, { kind: 'edge', id: 'e2' })).toEqual({ nodes: [], edges: ['e2'] });
  });

  it('an additive click toggles the element and keeps the rest', () => {
    expect(pickSelection(sel, { kind: 'node', id: 'c' }, true)).toEqual({ nodes: ['a', 'b', 'c'], edges: ['e1'] });
    expect(pickSelection(sel, { kind: 'node', id: 'a' }, true)).toEqual({ nodes: ['b'], edges: ['e1'] });
    expect(pickSelection(sel, { kind: 'edge', id: 'e1' }, true)).toEqual({ nodes: ['a', 'b'], edges: [] });
  });

  it('store.pick applies it, and a repeated plain click is a no-op', () => {
    const store = createGraphViewStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.pick({ kind: 'node', id: 'a' });
    store.pick({ kind: 'node', id: 'a' });
    expect(listener).toHaveBeenCalledOnce();
    store.pick({ kind: 'node', id: 'b' }, true);
    expect(store.getState().selection).toEqual({ nodes: ['a', 'b'], edges: [] });
  });
});
