/** Table rowSelection and matrix hits ↔ shared GraphSelection adapters, and form-lens scoping. */
import { describe, it, expect } from 'vitest';
import { nodeId, edgeId, type CanonicalGraph } from '@zodal/graph-core';
import {
  rowSelectionToSelection,
  selectionToRowSelection,
  matrixTargetToSelection,
  matrixHighlight,
  formTarget,
  toAdjacencyMatrix,
  reorderMatrix,
} from '../src/headless.js';

describe('table selection adapters', () => {
  it('keeps only the selected rows, on the side of the row kind', () => {
    expect(rowSelectionToSelection({ a: true, b: false, c: true }, 'node')).toEqual({ nodes: ['a', 'c'] });
    expect(rowSelectionToSelection({ ab: true }, 'edge')).toEqual({ edges: ['ab'] });
  });

  it('round-trips through a GraphSelection', () => {
    const selection = { nodes: ['a', 'c'], edges: ['ab'] };
    expect(selectionToRowSelection(selection, 'node')).toEqual({ a: true, c: true });
    expect(selectionToRowSelection(selection, 'edge')).toEqual({ ab: true });
    expect(rowSelectionToSelection(selectionToRowSelection(selection, 'node'), 'node')).toEqual({ nodes: ['a', 'c'] });
  });
});

describe('matrix selection adapters', () => {
  const g = (directed: boolean): CanonicalGraph => ({
    directed,
    multigraph: true,
    nodes: ['a', 'b', 'c'].map((id) => ({ id: nodeId(id), kind: 'entity' })),
    edges: [
      { id: edgeId('ab'), source: nodeId('a'), target: nodeId('b') },
      { id: edgeId('ab2'), source: nodeId('a'), target: nodeId('b') },
      { id: edgeId('ba'), source: nodeId('b'), target: nodeId('a') },
      { id: edgeId('bc'), source: nodeId('b'), target: nodeId('c') },
    ],
    graph: {},
  });

  it('a band selects its node; a cell selects the edges it aggregates', () => {
    expect(matrixTargetToSelection(g(true), { kind: 'row', node: 'b' })).toEqual({ nodes: ['b'], edges: [] });
    expect(matrixTargetToSelection(g(true), { kind: 'column', node: 'c' })).toEqual({ nodes: ['c'], edges: [] });
    expect(matrixTargetToSelection(g(true), { kind: 'cell', source: 'a', target: 'b' })).toEqual({ nodes: [], edges: ['ab', 'ab2'] });
    expect(matrixTargetToSelection(g(false), { kind: 'cell', source: 'a', target: 'b' }).edges).toEqual(['ab', 'ab2', 'ba']);
    expect(matrixTargetToSelection(g(true), { kind: 'cell', source: 'c', target: 'a' }).edges).toEqual([]);
  });

  it('a selection highlights its nodes\' bands and its edges\' cells (mirrored when undirected)', () => {
    const directed = g(true);
    const m = toAdjacencyMatrix(directed);
    const hl = matrixHighlight(m, directed, { nodes: ['c'], edges: ['bc'] });
    expect(hl.bands).toEqual([false, false, true]);
    expect(hl.cells[1][2]).toBe(true);
    expect(hl.cells[2][1]).toBe(false);
    const undirected = g(false);
    expect(matrixHighlight(toAdjacencyMatrix(undirected), undirected, { nodes: [], edges: ['bc'] }).cells[2][1]).toBe(true);
  });

  it('follows the matrix order after seriation', () => {
    const graph = g(true);
    const m = reorderMatrix(toAdjacencyMatrix(graph), ['c', 'b', 'a']);
    const hl = matrixHighlight(m, graph, { nodes: ['a'], edges: ['ab'] });
    expect(hl.bands).toEqual([false, false, true]);
    expect(hl.cells[2][1]).toBe(true); // a (index 2) → b (index 1)
  });

  it('formTarget is the single selected node', () => {
    expect(formTarget({ nodes: ['a'], edges: [] })).toBe('a');
    expect(formTarget({ nodes: ['a', 'b'], edges: [] })).toBeNull();
    expect(formTarget({ nodes: [], edges: ['ab'] })).toBeNull();
  });
});
