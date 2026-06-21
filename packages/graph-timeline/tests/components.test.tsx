// @vitest-environment happy-dom
/**
 * Render tests for <TimelineView> (Testing Library over happy-dom): tier labels, annotation rects,
 * the time axis, the controlled-window highlight, and that the visx brush mounts without throwing.
 */

import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId } from '@zodal/graph-core';
import { TimelineView } from '../src/index.js';
import { interval } from '../src/headless.js';

afterEach(cleanup);

function annotated(): CanonicalGraph {
  return {
    directed: true,
    multigraph: false,
    nodes: [
      { id: nodeId('a'), kind: 'entity', data: { tier: 'phrase', start: 0, end: 5 } },
      { id: nodeId('b'), kind: 'entity', data: { tier: 'words', start: 1, end: 3 } },
      { id: nodeId('c'), kind: 'entity', data: { tier: 'words', start: 6, end: 9 } },
    ],
    edges: [],
    graph: {},
  };
}

describe('<TimelineView>', () => {
  it('renders a labelled lane per tier and a rect per annotation', () => {
    const { container } = render(<TimelineView graph={annotated()} />);
    const labels = [...container.querySelectorAll('.zodal-timeline__tier-label')].map((t) => t.textContent);
    expect(labels.sort()).toEqual(['phrase', 'words']);
    expect(container.querySelectorAll('rect[class^="zodal-timeline__annotation"]')).toHaveLength(3);
  });

  it('draws a time axis (visx AxisBottom renders ticks)', () => {
    const { container } = render(<TimelineView graph={annotated()} />);
    // AxisBottom renders tick <text> elements; there should be several.
    expect(container.querySelectorAll('svg text').length).toBeGreaterThan(2);
  });

  it('marks annotations intersecting the controlled window', () => {
    const { container } = render(<TimelineView graph={annotated()} window={interval(0, 2)} />);
    const marked = container.querySelectorAll('.zodal-timeline__annotation--in-window');
    expect(marked.length).toBe(2); // a[0,5) and b[1,3) intersect [0,2); c[6,9) does not
  });

  it('mounts the interactive brush without throwing when onWindowChange is given', () => {
    expect(() => render(<TimelineView graph={annotated()} onWindowChange={() => {}} />)).not.toThrow();
  });

  it('shows an empty state for a graph with no annotated intervals', () => {
    const empty: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [{ id: nodeId('plain'), kind: 'entity', data: { label: 'no interval' } }],
      edges: [],
      graph: {},
    };
    const { container } = render(<TimelineView graph={empty} />);
    expect(container.querySelector('.zodal-timeline--empty')).not.toBeNull();
  });
});
