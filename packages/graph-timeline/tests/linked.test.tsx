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

const reset = vi.fn();
vi.mock('@visx/brush', () => ({
  Brush: ({ onChange, innerRef }: { onChange?: (b: unknown) => void; innerRef?: { current: unknown } }) => {
    useImperativeHandle(innerRef as never, () => ({ reset }));
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
});
