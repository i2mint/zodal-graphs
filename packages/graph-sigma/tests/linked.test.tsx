// @vitest-environment happy-dom
/**
 * <SigmaView view> — the sigma lens on the shared view store. happy-dom has no WebGL, so `sigma` is
 * replaced by a recording stub: the test fires the pointer events sigma would emit and reads the
 * node/edge reducers the component installs (what sigma would draw).
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { createGraphViewStore } from '@zodal/graph-ui';

type Handler = (payload: unknown) => void;
type Reducer = ((id: string, data: Record<string, unknown>) => Record<string, unknown>) | null;

const instances: FakeSigma[] = [];
class FakeSigma {
  handlers = new Map<string, Set<Handler>>();
  settings: Record<string, unknown> = {};
  killed = false;
  constructor() {
    instances.push(this);
  }
  on(event: string, handler: Handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return this;
  }
  off(event: string, handler: Handler) {
    this.handlers.get(event)?.delete(handler);
    return this;
  }
  emit(event: string, payload: unknown = {}) {
    for (const h of this.handlers.get(event) ?? []) h(payload);
  }
  setSetting(key: string, value: unknown) {
    this.settings[key] = value;
  }
  refresh() {}
  kill() {
    this.killed = true;
  }
}
vi.mock('sigma', () => ({ default: FakeSigma }));

const { SigmaView } = await import('../src/index.js');

afterEach(() => {
  cleanup();
  instances.length = 0;
});

const graph: CanonicalGraph = {
  directed: true,
  multigraph: false,
  graph: {},
  nodes: [
    { id: 'a', kind: 'entity', data: { team: 'x' } },
    { id: 'b', kind: 'entity', data: { team: 'y' } },
    { id: 'c', kind: 'entity', data: { team: 'x' } },
  ],
  edges: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'bc', source: 'b', target: 'c' },
  ],
};

const click = (shiftKey = false) => ({ event: { original: { shiftKey } } });
const node = (sigma: FakeSigma, id: string) => (sigma.settings.nodeReducer as Reducer)?.(id, {}) ?? {};
const edge = (sigma: FakeSigma, id: string) => (sigma.settings.edgeReducer as Reducer)?.(id, {}) ?? {};

describe('<SigmaView view>', () => {
  it('writes clicks, shift-clicks, stage clicks and hover to the shared state', () => {
    const view = createGraphViewStore();
    render(<SigmaView graph={graph} view={view} />);
    const sigma = instances[0];
    expect(sigma.settings.enableEdgeEvents).toBe(true);
    act(() => sigma.emit('clickNode', { node: 'a', ...click() }));
    act(() => sigma.emit('clickNode', { node: 'c', ...click(true) }));
    expect(view.getState().selection).toEqual({ nodes: ['a', 'c'], edges: [] });
    act(() => sigma.emit('clickEdge', { edge: 'ab', ...click() }));
    expect(view.getState().selection).toEqual({ nodes: [], edges: ['ab'] });
    act(() => sigma.emit('clickStage'));
    expect(view.getState().selection).toEqual({ nodes: [], edges: [] });
    act(() => sigma.emit('enterNode', { node: 'b' }));
    expect(view.getState().hovered).toEqual({ kind: 'node', id: 'b' });
    act(() => sigma.emit('leaveNode', { node: 'b' }));
    expect(view.getState().hovered).toBeNull();
  });

  it('draws the shared selection, fade filter and hover without fading the whole graph', () => {
    const view = createGraphViewStore();
    render(<SigmaView graph={graph} view={view} />);
    const sigma = instances[0];
    expect(sigma.settings.nodeReducer).toBeNull(); // nothing shared yet: sigma draws its defaults
    act(() => view.setFilter('facet', { nodes: { field: 'data.team', op: 'eq', value: 'x' }, mode: 'fade' }));
    expect(node(sigma, 'b').highlighted).toBe(false); // dimmed role
    expect(node(sigma, 'a').color).toBeUndefined(); // kept: untouched, so brighter than the dimmed
    act(() => view.setHovered({ kind: 'node', id: 'a' }));
    expect(node(sigma, 'a').highlighted).toBe(true);
    expect(node(sigma, 'c').color).toBeUndefined(); // a hover alone does not fade the rest
    act(() => view.setSelection({ nodes: ['c'] }));
    expect(node(sigma, 'c').highlighted).toBe(true);
  });

  it('hides what a hide filter removes (and edges touching it)', () => {
    const view = createGraphViewStore();
    render(<SigmaView graph={graph} view={view} />);
    const sigma = instances[0];
    act(() => view.setFilter('facet', { nodes: { field: 'data.team', op: 'eq', value: 'x' }, mode: 'hide' }));
    expect(node(sigma, 'b').hidden).toBe(true);
    expect(node(sigma, 'a').hidden).toBeUndefined();
    expect(edge(sigma, 'ab').hidden).toBe(true);
  });

  it('keeps host overlays alongside the shared ones, and unwires on unmount', () => {
    const view = createGraphViewStore();
    const overlays = { highlights: [{ layer: 'path', nodes: { b: 'path' } }] };
    const { unmount } = render(<SigmaView graph={graph} view={view} overlays={overlays} />);
    const sigma = instances[0];
    act(() => view.setSelection({ nodes: ['a'] }));
    expect(node(sigma, 'a').highlighted).toBe(true);
    expect(node(sigma, 'b').highlighted).toBe(true);
    unmount();
    expect(sigma.killed).toBe(true);
    expect([...sigma.handlers.values()].every((set) => set.size === 0)).toBe(true);
  });
});
