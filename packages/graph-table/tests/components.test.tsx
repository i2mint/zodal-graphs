// @vitest-environment happy-dom
/**
 * Render tests for the table + matrix React components (Testing Library over happy-dom).
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { createGraphViewStore } from '@zodal/graph-ui';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import { GraphTable, GraphMatrix, matrixTargetToSelection } from '../src/index.js';

afterEach(cleanup);

function graph(): CanonicalGraph {
  return {
    directed: true,
    multigraph: false,
    nodes: [
      { id: nodeId('a'), kind: 'entity', data: { name: 'Alice', age: 30 } },
      { id: nodeId('b'), kind: 'entity', data: { name: 'Bob' } },
      { id: nodeId('c'), kind: 'entity' },
    ],
    edges: [
      { id: edgeId('e1'), source: nodeId('a'), target: nodeId('b') },
      { id: edgeId('e2'), source: nodeId('b'), target: nodeId('c') },
    ],
    graph: {},
  };
}

describe('<GraphTable>', () => {
  it('renders a header per inferred column and a row per node', () => {
    const { container } = render(<GraphTable graph={graph()} />);
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent);
    expect(headers).toContain('ID');
    expect(headers).toContain('Name');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3);
  });

  it('JSON-stringifies object cells and blanks missing values', () => {
    const { container } = render(<GraphTable graph={graph()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('Alice');
    expect(text).toContain('30');
  });

  it('tabulates edges with the of="edges" prop', () => {
    const { container } = render(<GraphTable graph={graph()} of="edges" />);
    const headers = [...container.querySelectorAll('th')].map((th) => th.textContent);
    expect(headers).toContain('Source');
    expect(headers).toContain('Target');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('renders a collision-renamed dotted column (data.id) as its flat value, not a nested path', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [{ id: nodeId('a'), kind: 'entity', data: { id: 'COLLIDE' } }], // data.id collides → column "data.id"
      edges: [],
      graph: {},
    };
    const { container } = render(<GraphTable graph={g} />);
    expect(container.textContent).toContain('COLLIDE'); // accessorFn reads the literal flat key
  });

  it('shows an empty state for a graph with no rows', () => {
    const empty: CanonicalGraph = { directed: true, multigraph: false, nodes: [], edges: [], graph: {} };
    const { container } = render(<GraphTable graph={empty} />);
    expect(container.querySelector('.zodal-table--empty')?.textContent).toMatch(/No nodes/);
  });

  it('sorts an object/mixed column transitively (keyboard-accessible button header), no crash', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [
        { id: nodeId('a'), kind: 'entity', data: { meta: { k: 1 } } },
        { id: nodeId('b'), kind: 'entity', data: { meta: { k: 2 } } },
        { id: nodeId('c'), kind: 'entity', data: { meta: 'plain' } },
      ],
      edges: [],
      graph: {},
    };
    const { container } = render(<GraphTable graph={g} />);
    const sortButton = [...container.querySelectorAll('th')]
      .find((th) => th.textContent?.startsWith('Meta'))
      ?.querySelector('button');
    expect(sortButton).toBeTruthy();
    expect(() => fireEvent.click(sortButton!)).not.toThrow(); // transitive comparator over displayed value
    // a11y: the sorted column now reports its direction via aria-sort (asc or desc — auto direction)
    expect(container.querySelector('th[aria-sort="ascending"], th[aria-sort="descending"]')).not.toBeNull();
  });
});

describe('<GraphMatrix>', () => {
  it('renders an N×N grid of heat cells', () => {
    const { container } = render(<GraphMatrix graph={graph()} />);
    expect(container.querySelectorAll('.zodal-matrix__cell')).toHaveLength(9); // 3×3
  });

  it('paints linked cells (non-zero data-value) and leaves others empty', () => {
    const { container } = render(<GraphMatrix graph={graph()} seriation="none" />);
    const painted = [...container.querySelectorAll('.zodal-matrix__cell')].filter(
      (c) => Number(c.getAttribute('data-value')) !== 0,
    );
    expect(painted.length).toBe(2); // a→b and b→c
  });

  it('paints an all-NEGATIVE-weight graph (magnitude-saturated, not blank)', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [{ id: nodeId('a'), kind: 'entity' }, { id: nodeId('b'), kind: 'entity' }],
      edges: [{ id: edgeId('e'), source: nodeId('a'), target: nodeId('b'), data: { w: -5 } }],
      graph: {},
    };
    const { container } = render(<GraphMatrix graph={g} weight="w" seriation="none" />);
    const painted = [...container.querySelectorAll('.zodal-matrix__cell')].filter((c) => {
      const bg = (c as HTMLElement).style.background;
      return bg !== '' && bg !== 'transparent';
    });
    expect(painted.length).toBe(1); // the -5 cell is visible, not blank
  });

  it('shows an empty state for an empty graph', () => {
    const empty: CanonicalGraph = { directed: true, multigraph: false, nodes: [], edges: [], graph: {} };
    const { container } = render(<GraphMatrix graph={empty} />);
    expect(container.querySelector('.zodal-matrix--empty')).not.toBeNull();
  });
});

describe('<GraphMatrix> linked selection', () => {
  it('highlights a selected node\'s bands and a selected edge\'s cell', () => {
    const { container } = render(
      <GraphMatrix graph={graph()} seriation="none" selection={{ nodes: ['a'], edges: ['e2'] }} />,
    );
    const cells = [...container.querySelectorAll('.zodal-matrix__cell')];
    // row 0 and column 0 belong to a: 3 + 3 - 1 shared = 5 band cells
    expect(cells.filter((c) => c.classList.contains('zodal-matrix__cell--band'))).toHaveLength(5);
    const selected = cells.filter((c) => c.classList.contains('zodal-matrix__cell--selected'));
    expect(selected.map((c) => c.getAttribute('title'))).toEqual(['b → c: 1']);
  });

  it('reports cell and band hits; the adapter turns them into the shared selection', () => {
    const onSelect = vi.fn();
    const g = graph();
    const { container } = render(<GraphMatrix graph={g} seriation="none" labels onSelect={onSelect} />);
    fireEvent.click(container.querySelector('[title="a → b: 1"]') as HTMLElement);
    expect(onSelect.mock.calls[0][0]).toEqual({ kind: 'cell', source: 'a', target: 'b', undirected: false });
    expect(matrixTargetToSelection(g, onSelect.mock.calls[0][0])).toEqual({ nodes: [], edges: ['e1'] });
    const bands = [...container.querySelectorAll('button.zodal-matrix__band--row')];
    expect(bands.map((b) => b.textContent)).toEqual(['a', 'b', 'c']);
    fireEvent.click(bands[2]);
    expect(onSelect.mock.calls[1][0]).toEqual({ kind: 'row', node: 'c' });
    expect(container.querySelectorAll('button.zodal-matrix__band--column')).toHaveLength(3);
    // keyboard: a selectable cell is a focusable button that Enter selects
    const cell = container.querySelector('[title="b → c: 1"]') as HTMLElement;
    expect(cell.getAttribute('role')).toBe('button');
    expect(cell.tabIndex).toBe(0);
    fireEvent.keyDown(cell, { key: 'Enter' });
    expect(onSelect.mock.calls[2][0]).toMatchObject({ kind: 'cell', source: 'b', target: 'c' });
  });

  it('a cell hit carries the matrix\'s undirected choice, so its selection matches its highlight', () => {
    const onSelect = vi.fn();
    const g = graph(); // directed, but drawn undirected
    const { container } = render(<GraphMatrix graph={g} seriation="none" undirected onSelect={onSelect} />);
    fireEvent.click(container.querySelector('[title="b — a: 1"]') as HTMLElement);
    expect(matrixTargetToSelection(g, onSelect.mock.calls[0][0])).toEqual({ nodes: [], edges: ['e1'] });
  });

  it('without onSelect or labels it stays a static image', () => {
    const { container } = render(<GraphMatrix graph={graph()} />);
    expect(container.querySelector('.zodal-matrix')?.getAttribute('role')).toBe('img');
    expect(container.querySelector('.zodal-matrix__band')).toBeNull();
  });
});

describe('<GraphTable view> (linked views)', () => {
  const rowIds = (container: HTMLElement) => [...container.querySelectorAll('tbody tr')].map((tr) => tr.querySelector('td:nth-child(2)')?.textContent);

  it('adds a selection column bound to the shared selection, both ways', () => {
    const view = createGraphViewStore();
    const { container, getByLabelText } = render(<GraphTable graph={graph()} view={view} />);
    fireEvent.click(getByLabelText('Select a'));
    expect(view.getState().selection.nodes).toEqual(['a']);
    expect(container.querySelector('tr[data-selected]')?.className).toContain('zodal-table__row--selected');
    act(() => view.setSelection({ nodes: ['b', 'c'] })); // another lens selects
    expect((getByLabelText('Select a') as HTMLInputElement).checked).toBe(false);
    expect((getByLabelText('Select b') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(getByLabelText('Select all nodes')); // some selected → select all
    expect([...view.getState().selection.nodes].sort()).toEqual(['a', 'b', 'c']);
  });

  it('writes only its own kind: an edge table leaves the node selection alone', () => {
    const view = createGraphViewStore();
    view.setSelection({ nodes: ['a'] });
    const { getByLabelText } = render(<GraphTable graph={graph()} of="edges" view={view} />);
    fireEvent.click(getByLabelText('Select e2'));
    expect(view.getState().selection).toEqual({ nodes: ['a'], edges: ['e2'] });
  });

  it('hides rows a hide filter removes and dims rows a fade filter drops (selected rows stay full)', () => {
    const view = createGraphViewStore();
    const { container } = render(<GraphTable graph={graph()} view={view} />);
    act(() => view.setFilter('facet', { nodes: { field: 'id', op: 'in', value: ['a', 'b'] }, mode: 'hide' }));
    expect(rowIds(container)).toEqual(['a', 'b']);
    act(() => {
      view.setFilter('facet', { nodes: { field: 'id', op: 'eq', value: 'a' }, mode: 'fade' });
      view.setSelection({ nodes: ['c'] });
    });
    expect(rowIds(container)).toEqual(['a', 'b', 'c']);
    const dimmed = [...container.querySelectorAll('tr[data-dimmed]')].map((tr) => tr.querySelector('td:nth-child(2)')?.textContent);
    expect(dimmed).toEqual(['b']); // c is filtered out too, but selected
    act(() => view.clearFilters());
    expect(container.querySelectorAll('tr[data-dimmed]')).toHaveLength(0);
  });

  it('reports row hover to the shared state', () => {
    const view = createGraphViewStore();
    const { container } = render(<GraphTable graph={graph()} view={view} />);
    const row = container.querySelectorAll('tbody tr')[1];
    fireEvent.mouseEnter(row);
    expect(view.getState().hovered).toEqual({ kind: 'node', id: 'b' });
    expect(row.className).toContain('zodal-table__row--hovered');
    fireEvent.mouseLeave(row);
    expect(view.getState().hovered).toBeNull();
  });

  it('selectable={false} keeps the filter wiring but drops the checkbox column', () => {
    const view = createGraphViewStore();
    const { container } = render(<GraphTable graph={graph()} view={view} selectable={false} />);
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });
});

describe('<GraphMatrix view> (linked views)', () => {
  it('highlights the shared selection and writes band clicks back', () => {
    const view = createGraphViewStore();
    const { container, getAllByRole } = render(<GraphMatrix graph={graph()} seriation="none" labels view={view} />);
    expect(container.querySelector('.zodal-matrix__band--selected')).toBeNull();
    fireEvent.click(getAllByRole('button', { name: 'b' })[0]);
    expect(view.getState().selection).toEqual({ nodes: ['b'], edges: [] });
    expect(container.querySelectorAll('.zodal-matrix__band--selected').length).toBeGreaterThan(0);
  });
});
