/** Table rowSelection ↔ shared GraphSelection adapters. */
import { describe, it, expect } from 'vitest';
import { rowSelectionToSelection, selectionToRowSelection } from '../src/headless.js';

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
