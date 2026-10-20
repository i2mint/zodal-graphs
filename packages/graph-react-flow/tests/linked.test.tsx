// @vitest-environment happy-dom
/**
 * <GraphFlowView view> — the React Flow lens on the shared view store, through the real React Flow
 * DOM (happy-dom has no layout, but nodes are still rendered and receive pointer events).
 */

import { afterEach, describe, it, expect } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { createGraphViewStore } from '@zodal/graph-ui';
import { GraphFlowView } from '../src/index.js';
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
});
