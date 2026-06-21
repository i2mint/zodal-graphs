// @vitest-environment happy-dom
/**
 * Render tests for <GraphFlowView> (Testing Library over happy-dom).
 *
 * happy-dom has no layout engine, so the FULL React Flow canvas can't be meaningfully mounted; what
 * IS testable is the empty-state path (plain DOM, no React Flow) and that mounting a non-empty graph
 * does not throw.
 */

import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { GraphFlowView } from '../src/index.js';
import { portGraph } from './fixtures.js';

afterEach(cleanup);

const caps = resolveGraphCapabilities({});

describe('<GraphFlowView>', () => {
  it('renders an empty state (no React Flow) for a graph with no nodes', () => {
    const empty: CanonicalGraph = { directed: true, multigraph: false, nodes: [], edges: [], graph: {} };
    const { container } = render(<GraphFlowView graph={empty} capabilities={caps} />);
    const fallback = container.querySelector('.zodal-graph-flow--empty');
    expect(fallback?.textContent).toMatch(/No nodes/);
  });

  it('mounts a non-empty graph without throwing', () => {
    expect(() => render(<GraphFlowView graph={portGraph()} capabilities={caps} />)).not.toThrow();
  });

  it('re-seeds and shows the empty state when the graph prop changes to empty', () => {
    const empty: CanonicalGraph = { directed: true, multigraph: false, nodes: [], edges: [], graph: {} };
    const { container, rerender } = render(<GraphFlowView graph={portGraph()} capabilities={caps} />);
    expect(container.querySelector('.zodal-graph-flow--empty')).toBeNull(); // non-empty first
    rerender(<GraphFlowView graph={empty} capabilities={caps} />);
    expect(container.querySelector('.zodal-graph-flow--empty')).not.toBeNull(); // re-seeded → empty state
  });
});
