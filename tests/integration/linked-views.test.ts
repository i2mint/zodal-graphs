/**
 * Cross-lens brushing end to end, across the real package boundaries: one shared view store links
 * the table lens, the timeline lens and the node-link overlays.
 *
 *   table rows selected → store.setSelection → linkedOverlays marks them 'primary' for node-link
 *   timeline window brushed → store.setFilter('timeline') → every lens sees the same filter
 *   view switch → selection and filters survive
 *   matrix cell clicked → store.setSelection → the table and the matrix both show it
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { createGraphViewStore, linkedOverlays, linkedFilterResult } from '@zodal/graph-ui';
import {
  formTarget,
  matrixHighlight,
  matrixTargetToSelection,
  rowSelectionToSelection,
  selectionToRowSelection,
  switchViewChecked,
  toAdjacencyMatrix,
  toNodeRows,
} from '@zodal/graph-table/headless';
import { brushFilter, interval, toTimeline } from '@zodal/graph-timeline/headless';

const graph = {
  directed: true,
  multigraph: false,
  graph: {},
  nodes: [
    { id: 'w1', kind: 'entity', type: 'word', data: { tier: 'words', start: 0, end: 2 } },
    { id: 'w2', kind: 'entity', type: 'word', data: { tier: 'words', start: 3, end: 5 } },
    { id: 'w3', kind: 'entity', type: 'word', data: { tier: 'words', start: 8, end: 9 } },
    { id: 'alice', kind: 'entity', type: 'speaker' },
  ],
  edges: [
    { id: 'a-w1', source: 'alice', target: 'w1' },
    { id: 'a-w3', source: 'alice', target: 'w3' },
  ],
} as CanonicalGraph;

describe('linked views', () => {
  const store = createGraphViewStore({ capabilities: { views: ['node-link', 'table', 'timeline'] } });

  it('selecting table rows updates the node-link overlay', () => {
    const rows = toNodeRows(graph);
    expect(rows.map((r) => r.id)).toContain('w2');
    // TanStack's onRowSelectionChange hands the table's new rowSelection to the shared store
    store.setSelection(rowSelectionToSelection({ w2: true, alice: true }, 'node'));
    const selection = linkedOverlays(graph, store.getState()).highlights.find((l) => l.layer === 'selection');
    expect(selection?.nodes).toEqual({ w2: 'primary', alice: 'primary' });
    // …and the table reads it back as its rowSelection (a selection made elsewhere shows as rows)
    expect(selectionToRowSelection(store.getState().selection, 'node')).toEqual({ w2: true, alice: true });
  });

  it('brushing a timeline window filters the graph for every lens', () => {
    store.setFilter('timeline', brushFilter(toTimeline(graph), interval(1, 4)));
    const result = linkedFilterResult(graph, store.getState());
    expect(result?.selection.nodes.sort()).toEqual(['alice', 'w1', 'w2']);
    const dimmed = linkedOverlays(graph, store.getState()).highlights.find((l) => l.layer === 'filter');
    expect(dimmed?.nodes).toEqual({ w3: 'dimmed' });
    expect(dimmed?.edges).toEqual({ 'a-w3': 'dimmed' });
  });

  it('a second owner narrows the same filter (crossfilter), and a view switch keeps it all', () => {
    store.setFilter('facet:type', { nodes: { field: 'type', op: 'eq', value: 'word' } });
    expect(linkedFilterResult(graph, store.getState())?.selection.nodes.sort()).toEqual(['w1', 'w2']);
    const before = store.getState();
    store.setActiveView('table');
    expect(store.getState().activeView).toBe('table');
    expect(store.getState().selection).toBe(before.selection);
    expect(store.getState().filters).toBe(before.filters);
    // graph-table's view helpers work on the shared state as-is (it IS a ViewState)
    const caps = { views: ['node-link', 'table'] } as Parameters<typeof switchViewChecked>[0];
    expect(switchViewChecked(caps, store.getState(), 'node-link').selection).toBe(before.selection);
  });

  it('a matrix hit selects for every lens, and the matrix highlights the shared selection', () => {
    const matrix = toAdjacencyMatrix(graph);
    store.setSelection(matrixTargetToSelection(graph, { kind: 'row', node: 'alice' }));
    expect(selectionToRowSelection(store.getState().selection, 'node')).toEqual({ alice: true });
    expect(formTarget(store.getState().selection)).toBe('alice');
    store.setSelection(matrixTargetToSelection(graph, { kind: 'cell', source: 'alice', target: 'w3' }));
    expect(store.getState().selection.edges).toEqual(['a-w3']);
    const highlight = matrixHighlight(matrix, graph, store.getState().selection);
    expect(highlight.cells[matrix.order.indexOf('alice')][matrix.order.indexOf('w3')]).toBe(true);
    expect(highlight.bands.some(Boolean)).toBe(false);
  });
});
