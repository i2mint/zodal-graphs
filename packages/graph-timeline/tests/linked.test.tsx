// @vitest-environment happy-dom
/**
 * <TimelineView view> — the timeline lens on the shared view store. happy-dom cannot drag a visx
 * brush, so `@visx/brush` is replaced by a stub that exposes the `onChange` the real brush calls and
 * the `innerRef.reset()` it offers; everything else (scales, axis, rects) is the real component.
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useImperativeHandle } from 'react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { createGraphViewStore, linkedFilterResult } from '@zodal/graph-ui';

// The stub behaves like visx's BaseBrush handle: `reset` and `updateBrush` report through `onChange`.
let lastOnChange: ((b: unknown) => void) | undefined;
const reset = vi.fn(() => lastOnChange?.(null));
const updateBrush = vi.fn((updater: (prev: object) => { extent: { x0: number; x1: number } }) => {
  const next = updater({});
  lastOnChange?.({ x0: next.extent.x0, x1: next.extent.x1, y0: 0, y1: 1 });
});
const getExtent = (start: { x: number; y: number }, end: { x: number; y: number }) => ({ x0: start.x, x1: end.x, y0: start.y, y1: end.y });
vi.mock('@visx/brush', () => ({
  Brush: ({ onChange, innerRef }: { onChange?: (b: unknown) => void; innerRef?: { current: unknown } }) => {
    lastOnChange = onChange;
    useImperativeHandle(innerRef as never, () => ({ reset, updateBrush, getExtent }));
    return (
      <g>
        <rect data-testid="brush-0-5" onClick={() => onChange?.({ x0: 0, x1: 5, y0: 0, y1: 1 })} />
        <rect data-testid="brush-clear" onClick={() => onChange?.(null)} />
      </g>
    );
  },
}));

const { TimelineView } = await import('../src/index.js');

afterEach(() => {
  cleanup();
  reset.mockClear();
  updateBrush.mockClear();
});

const graph: CanonicalGraph = {
  directed: true,
  multigraph: false,
  graph: {},
  nodes: [
    { id: 'w1', kind: 'entity', data: { tier: 'words', start: 0, end: 2 } },
    { id: 'w2', kind: 'entity', data: { tier: 'words', start: 3, end: 4 } },
    { id: 'w3', kind: 'entity', data: { tier: 'words', start: 8, end: 9 } },
    { id: 'alice', kind: 'entity' },
  ],
  edges: [{ id: 'a-w3', source: 'alice', target: 'w3' }],
};

const cls = (container: HTMLElement, id: string) => container.querySelector(`rect[data-id="${id}"]`)?.getAttribute('class') ?? 'absent';

describe('<TimelineView view>', () => {
  it('brushing a window filters the shared state; clearing the brush removes the filter', () => {
    const view = createGraphViewStore();
    const onWindowChange = vi.fn();
    const { getByTestId } = render(<TimelineView graph={graph} view={view} onWindowChange={onWindowChange} />);
    fireEvent.click(getByTestId('brush-0-5'));
    expect(onWindowChange).toHaveBeenCalledOnce(); // the host callback still fires
    const kept = linkedFilterResult(graph, view.getState())!.selection.nodes;
    expect(kept.sort()).toEqual(['alice', 'w1', 'w2']); // w3 is outside [0,5); untimed alice stays
    fireEvent.click(getByTestId('brush-clear'));
    expect(view.getState().filters).toEqual({});
    expect(reset).not.toHaveBeenCalled(); // the brush cleared itself: no reset mid-gesture
  });

  it('uses filterOwner and brushOptions', () => {
    const view = createGraphViewStore();
    const options = { mode: 'hide' as const };
    const { getByTestId } = render(<TimelineView graph={graph} view={view} filterOwner="time" brushOptions={options} />);
    fireEvent.click(getByTestId('brush-0-5'));
    expect(view.getState().filters.time.mode).toBe('hide');
  });

  it('removing the filter elsewhere resets the brush', () => {
    const view = createGraphViewStore();
    const { getByTestId } = render(<TimelineView graph={graph} view={view} />);
    fireEvent.click(getByTestId('brush-0-5'));
    act(() => view.clearFilters());
    expect(reset).toHaveBeenCalledOnce();
  });

  it('draws the shared selection, hover and other owners\' filters, but not its own window', () => {
    const view = createGraphViewStore();
    const { container, getByTestId } = render(<TimelineView graph={graph} view={view} />);
    fireEvent.click(getByTestId('brush-0-5')); // its own filter: w3 is NOT dimmed here
    expect(cls(container, 'w3')).not.toContain('--dimmed');
    act(() => {
      view.setFilter('facet', { nodes: { field: 'id', op: 'in', value: ['w1', 'alice'] }, mode: 'fade' });
      view.setSelection({ nodes: ['w2'] });
      view.setHovered({ kind: 'node', id: 'w1' });
    });
    expect(cls(container, 'w3')).toContain('zodal-timeline__annotation--dimmed');
    expect(cls(container, 'w2')).toContain('zodal-timeline__annotation--selected');
    expect(cls(container, 'w2')).not.toContain('--dimmed'); // selection outranks dimming
    expect(cls(container, 'w1')).toContain('zodal-timeline__annotation--hovered');
    act(() => view.setFilter('facet', { nodes: { field: 'id', op: 'in', value: ['w1', 'alice'] }, mode: 'hide' }));
    expect(cls(container, 'w3')).toBe('absent');
  });

  it('a filter restored through setState redraws the brush, without writing back', async () => {
    const { brushFilter, toTimeline, interval, filterWindow } = await import('../src/index.js');
    const view = createGraphViewStore();
    const onWindowChange = vi.fn();
    render(<TimelineView graph={graph} view={view} onWindowChange={onWindowChange} />);
    const filter = brushFilter(toTimeline(graph), interval(3, 9));
    act(() => view.setState({ ...view.getState(), filters: { timeline: filter } }));
    expect(updateBrush).toHaveBeenCalledOnce();
    expect(filterWindow(view.getState().filters.timeline)).toEqual(interval(3, 9)); // not overwritten
    expect(onWindowChange).not.toHaveBeenCalled();
    // Another writer moves the window: the brush follows.
    act(() => view.setFilter('timeline', brushFilter(toTimeline(graph), interval(0, 2))));
    expect(updateBrush).toHaveBeenCalledTimes(2);
    expect(filterWindow(view.getState().filters.timeline)).toEqual(interval(0, 2));
    // The store's echo of the user's own drag does not move the brush.
    fireEvent.click(document.querySelector('[data-testid="brush-0-5"]')!);
    expect(onWindowChange).toHaveBeenCalledOnce();
    expect(filterWindow(view.getState().filters.timeline)).toEqual(interval(0, 5));
    expect(updateBrush).toHaveBeenCalledTimes(2);
  });

  it('draws the brush at the filter a store starts with, and positions it on the time scale', async () => {
    const { brushFilter, toTimeline, interval } = await import('../src/index.js');
    const view = createGraphViewStore();
    view.setFilter('timeline', brushFilter(toTimeline(graph), interval(0, 9)));
    render(<TimelineView graph={graph} view={view} width={800} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} />);
    expect(updateBrush).toHaveBeenCalledOnce();
    const next = (updateBrush.mock.calls[0][0] as (p: object) => { start: { x: number }; end: { x: number } })({});
    expect(next.start.x).toBe(0); // the extent is [0, 9], so the window spans the whole width
    expect(next.end.x).toBe(800);
  });

  it('a filter without a window (another writer) clears the brush but stays in the store', () => {
    const view = createGraphViewStore();
    const { getByTestId } = render(<TimelineView graph={graph} view={view} />);
    fireEvent.click(getByTestId('brush-0-5'));
    const foreign = { nodes: { field: 'id', op: 'in' as const, value: ['w1'] }, mode: 'fade' as const };
    act(() => view.setFilter('timeline', foreign));
    expect(reset).toHaveBeenCalledOnce();
    expect(view.getState().filters.timeline).toEqual(foreign);
  });

  it('a new filterOwner removes the old owner\'s filter', () => {
    const view = createGraphViewStore();
    const { getByTestId, rerender } = render(<TimelineView graph={graph} view={view} filterOwner="a" />);
    fireEvent.click(getByTestId('brush-0-5'));
    expect(Object.keys(view.getState().filters)).toEqual(['a']);
    rerender(<TimelineView graph={graph} view={view} filterOwner="b" />);
    expect(view.getState().filters).toEqual({});
    fireEvent.click(getByTestId('brush-0-5'));
    expect(Object.keys(view.getState().filters)).toEqual(['b']);
  });
});
