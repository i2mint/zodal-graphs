// @vitest-environment happy-dom
/**
 * Render tests for <SigmaView> (Testing Library over happy-dom).
 *
 * happy-dom has no WebGL, so the Sigma canvas can't actually initialise — which is exactly the
 * WebGL-unavailable path we now handle gracefully. Testable: the empty state, and that a non-empty
 * graph degrades to the error overlay instead of throwing.
 */

import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import { SigmaView } from '../src/index.js';

afterEach(cleanup);

function graph(): CanonicalGraph {
  return {
    directed: true,
    multigraph: false,
    nodes: [{ id: nodeId('a'), kind: 'entity' }, { id: nodeId('b'), kind: 'entity' }],
    edges: [{ id: edgeId('e'), source: nodeId('a'), target: nodeId('b') }],
    graph: {},
  };
}

describe('<SigmaView>', () => {
  it('renders an empty state for a graph with no nodes (no Sigma init)', () => {
    const empty: CanonicalGraph = { directed: true, multigraph: false, nodes: [], edges: [], graph: {} };
    const { container } = render(<SigmaView graph={empty} />);
    expect(container.querySelector('.zodal-sigma-view--empty')).not.toBeNull();
  });

  it('degrades to a stable error overlay (not a crash) when WebGL context creation fails', () => {
    let result: ReturnType<typeof render> | undefined;
    expect(() => {
      result = render(<SigmaView graph={graph()} />);
    }).not.toThrow();
    // happy-dom's canvas yields no WebGL context, so Sigma init fails and the overlay shows a stable,
    // user-facing message (never an internal stack string like "reading 'blendFunc'").
    const overlay = result!.container.querySelector('.zodal-sigma-view--error');
    expect(overlay?.textContent).toContain('WebGL is unavailable');
  });
});
