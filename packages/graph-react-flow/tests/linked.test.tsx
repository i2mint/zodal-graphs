// @vitest-environment happy-dom
/**
 * <GraphFlowView view> — the React Flow lens on the shared view store, through the real React Flow
 * DOM (happy-dom has no layout, but nodes are still rendered and receive pointer events).
 */

import { afterEach, describe, it, expect } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { createGraphViewStore } from '@zodal/graph-ui';
import { applySelectChanges, GraphFlowView } from '../src/index.js';
import { portGraph } from './fixtures.js';

afterEach(cleanup);

const caps = resolveGraphCapabilities({});
const nodeEl = (container: HTMLElement, id: string) => container.querySelector<HTMLElement>(`.react-flow__node[data-id="${id}"]`);

describe('<GraphFlowView view>', () => {
  it('a node click selects it in the shared state, shift-click toggles, a pane click clears', () => {
    const view = createGraphViewStore();
    const { container } = render(<GraphFlowView graph={portGraph()} capabilities={caps} view={view} />);
    fireEvent.click(nodeEl(container, 'f1')!);
    expect(view.getState().selection).toEqual({ nodes: ['f1'], edges: [] });
    fireEvent.click(nodeEl(container, 'f2')!, { shiftKey: true });
    expect(view.getState().selection.nodes).toEqual(['f1', 'f2']);
    expect(nodeEl(container, 'f2')!.className).toContain('selected');
    fireEvent.click(container.querySelector('.react-flow__pane')!);
    expect(view.getState().selection.nodes).toEqual([]);
  });

  it('draws a selection made in another lens, hover, and the shared filters', () => {
    const view = createGraphViewStore();
    const { container } = render(<GraphFlowView graph={portGraph()} capabilities={caps} view={view} />);
    act(() => view.setSelection({ nodes: ['f3'] })); // e.g. a table row
    expect(nodeEl(container, 'f3')!.className).toContain('selected');
    act(() => view.setFilter('facet', { nodes: { field: 'id', op: 'eq', value: 'f1' }, mode: 'fade' }));
    expect(nodeEl(container, 'f2')!.className).toContain('zodal-flow--dimmed');
    expect(nodeEl(container, 'f3')!.className).not.toContain('zodal-flow--dimmed'); // selected
    fireEvent.mouseEnter(nodeEl(container, 'f1')!);
    expect(view.getState().hovered).toEqual({ kind: 'node', id: 'f1' });
    expect(nodeEl(container, 'f1')!.className).toContain('zodal-flow--hovered');
    act(() => view.setFilter('facet', { nodes: { field: 'id', op: 'eq', value: 'f1' }, mode: 'hide' }));
    expect(nodeEl(container, 'f2')).toBeNull(); // React Flow does not render hidden nodes
  });

  it('a box (drag) selection replaces the shared selection with what it covers', () => {
    const view = createGraphViewStore();
    const { container } = render(<GraphFlowView graph={portGraph()} capabilities={caps} view={view} />);
    act(() => view.setSelection({ nodes: ['f1'] }));
    const pane = container.querySelector('.react-flow__pane')!;
    // Shift is React Flow's selection key; happy-dom has no layout, so the box covers every node.
    fireEvent.keyDown(window, { key: 'Shift' });
    fireEvent.pointerDown(pane, { button: 0, isPrimary: true, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(pane, { button: 0, isPrimary: true, pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(pane, { button: 0, isPrimary: true, pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.keyUp(window, { key: 'Shift' });
    const all = portGraph().nodes.map((n) => n.id).sort();
    expect([...view.getState().selection.nodes].sort()).toEqual(all);
    expect(nodeEl(container, 'f2')!.className).toContain('selected');
    // After the gesture, React Flow's own select changes are dropped again: a click picks one node.
    fireEvent.click(nodeEl(container, 'f2')!);
    expect(view.getState().selection.nodes).toEqual(['f2']);
  });

  it('a box replaces the selection, including ids the canvas does not show', () => {
    const view = createGraphViewStore();
    const { container } = render(<GraphFlowView graph={portGraph()} capabilities={caps} view={view} />);
    act(() => view.setSelection({ nodes: ['f1', 'elsewhere'], edges: ['e-elsewhere'] }));
    const pane = container.querySelector('.react-flow__pane')!;
    fireEvent.keyDown(window, { key: 'Shift' });
    fireEvent.pointerDown(pane, { button: 0, isPrimary: true, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(pane, { button: 0, isPrimary: true, pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.pointerUp(pane, { button: 0, isPrimary: true, pointerId: 1, clientX: 50, clientY: 50 });
    fireEvent.keyUp(window, { key: 'Shift' });
    expect([...view.getState().selection.nodes].sort()).toEqual(['f1', 'f2', 'f3']);
    expect(view.getState().selection.edges).toEqual([]);
  });

  it('the multi-selection key adds to the selection like shift', () => {
    const view = createGraphViewStore();
    const { container } = render(<GraphFlowView graph={portGraph()} capabilities={caps} view={view} />);
    fireEvent.click(nodeEl(container, 'f1')!);
    fireEvent.click(nodeEl(container, 'f3')!, { ctrlKey: true });
    expect(view.getState().selection.nodes).toEqual(['f1', 'f3']);
  });
});

describe('applySelectChanges', () => {
  it('adds and removes ids from select changes, ignoring other changes', () => {
    expect(
      applySelectChanges(['a', 'b'], [
        { type: 'select', id: 'b', selected: false },
        { type: 'select', id: 'c', selected: true },
        { type: 'remove', id: 'a' },
      ]),
    ).toEqual(['a', 'c']);
  });
});
