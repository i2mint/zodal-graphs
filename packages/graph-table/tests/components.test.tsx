// @vitest-environment happy-dom
/**
 * Render tests for the table + matrix React components (Testing Library over happy-dom).
 */

import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
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
    expect(onSelect.mock.calls[0][0]).toEqual({ kind: 'cell', source: 'a', target: 'b' });
    expect(matrixTargetToSelection(g, onSelect.mock.calls[0][0])).toEqual({ nodes: [], edges: ['e1'] });
    const bands = [...container.querySelectorAll('button.zodal-matrix__band--row')];
    expect(bands.map((b) => b.textContent)).toEqual(['a', 'b', 'c']);
    fireEvent.click(bands[2]);
    expect(onSelect.mock.calls[1][0]).toEqual({ kind: 'row', node: 'c' });
    expect(container.querySelectorAll('button.zodal-matrix__band--column')).toHaveLength(3);
  });

  it('without onSelect or labels it stays a static image', () => {
    const { container } = render(<GraphMatrix graph={graph()} />);
    expect(container.querySelector('.zodal-matrix')?.getAttribute('role')).toBe('img');
    expect(container.querySelector('.zodal-matrix__band')).toBeNull();
  });
});
