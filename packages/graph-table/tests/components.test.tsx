// @vitest-environment happy-dom
/**
 * Render tests for the table + matrix React components (Testing Library over happy-dom).
 */

import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import { GraphTable, GraphMatrix } from '../src/index.js';

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
});

describe('<GraphMatrix>', () => {
  it('renders an N×N grid of heat cells', () => {
    const { container } = render(<GraphMatrix graph={graph()} />);
    expect(container.querySelectorAll('[role="gridcell"]')).toHaveLength(9); // 3×3
  });

  it('paints linked cells (non-zero data-value) and leaves others empty', () => {
    const { container } = render(<GraphMatrix graph={graph()} seriation="none" />);
    const painted = [...container.querySelectorAll('[role="gridcell"]')].filter(
      (c) => Number(c.getAttribute('data-value')) !== 0,
    );
    expect(painted.length).toBe(2); // a→b and b→c
  });

  it('shows an empty state for an empty graph', () => {
    const empty: CanonicalGraph = { directed: true, multigraph: false, nodes: [], edges: [], graph: {} };
    const { container } = render(<GraphMatrix graph={empty} />);
    expect(container.querySelector('.zodal-matrix--empty')).not.toBeNull();
  });
});
