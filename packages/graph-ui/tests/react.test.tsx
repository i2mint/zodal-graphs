// @vitest-environment happy-dom
/** The React subscription hooks: `useGraphView` re-renders on store changes (and only then), and
 *  `useLinkedView` projects the shared state onto a graph, optionally leaving filter owners out. */
import { afterEach, describe, it, expect } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { createGraphViewStore } from '../src/index.js';
import { useGraphView, useLinkedView, type UseLinkedViewOptions } from '../src/react.js';

afterEach(cleanup);

const graph: CanonicalGraph = {
  directed: true,
  multigraph: false,
  graph: {},
  nodes: [
    { id: 'a', kind: 'entity', data: { team: 'x' } },
    { id: 'b', kind: 'entity', data: { team: 'y' } },
  ],
  edges: [{ id: 'e', source: 'a', target: 'b' }],
};

describe('useGraphView', () => {
  it('reads the store and re-renders on changes, not on no-ops', () => {
    const store = createGraphViewStore();
    let renders = 0;
    function Probe() {
      renders += 1;
      const state = useGraphView(store);
      return <span>{state.selection.nodes.join(',') || 'none'}</span>;
    }
    const { container } = render(<Probe />);
    expect(container.textContent).toBe('none');
    act(() => store.setSelection({ nodes: ['a'] }));
    expect(container.textContent).toBe('a');
    const before = renders;
    act(() => store.setSelection({ nodes: ['a'] })); // same selection: the store skips it
    expect(renders).toBe(before);
  });

  it('returns undefined without a store', () => {
    function Probe() {
      return <span>{useGraphView(undefined) === undefined ? 'standalone' : 'linked'}</span>;
    }
    expect(render(<Probe />).container.textContent).toBe('standalone');
  });
});

describe('useLinkedView', () => {
  const teamX = { nodes: { field: 'data.team', op: 'eq', value: 'x' }, mode: 'hide' } as const;

  function Probe({ options }: { options?: UseLinkedViewOptions }) {
    const view = useLinkedView(graph, store, options);
    if (!view) return <span>none</span>;
    const kept = view.kept ? [...view.kept.nodes].join(',') : 'all';
    return <span>{`kept=${kept} hidden=${[...view.hidden.nodes].join(',')} layers=${view.overlays.highlights.map((l) => l.layer).join(',')}`}</span>;
  }
  let store = createGraphViewStore();

  it('projects the filter result and the overlays', () => {
    store = createGraphViewStore();
    const { container } = render(<Probe />);
    expect(container.textContent).toBe('kept=all hidden= layers=');
    act(() => {
      store.setFilter('facet', teamX);
      store.setSelection({ nodes: ['a'] });
    });
    expect(container.textContent).toBe('kept=a hidden=b layers=selection');
  });

  it('leaves excluded owners out (a lens does not filter itself)', () => {
    store = createGraphViewStore();
    store.setFilter('timeline', teamX);
    const options = { excludeOwners: ['timeline'] };
    const { container } = render(<Probe options={options} />);
    expect(container.textContent).toBe('kept=all hidden= layers=');
  });
});
