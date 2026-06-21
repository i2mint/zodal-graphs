/**
 * Tests for the table data shaping: nodes → rows, edges → edge-list rows, and column inference.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';
import { toNodeRows, toEdgeRows, inferColumns } from '../src/headless.js';

const graph: CanonicalGraph = {
  directed: true,
  multigraph: false,
  nodes: [
    { id: nodeId('a'), kind: 'entity', type: 'Person', data: { name: 'Ada', age: 36 } },
    { id: nodeId('b'), kind: 'entity', type: 'Person', data: { name: 'Bob' } },
  ],
  edges: [{ id: edgeId('a-b'), source: nodeId('a'), target: nodeId('b'), type: 'knows', data: { since: 2020 } }],
  graph: {},
};

describe('toNodeRows', () => {
  it('flattens node fields + data into rows', () => {
    const rows = toNodeRows(graph);
    expect(rows[0]).toMatchObject({ id: 'a', kind: 'entity', type: 'Person', name: 'Ada', age: 36 });
    expect(rows[1]).toMatchObject({ id: 'b', name: 'Bob' });
  });
});

describe('toEdgeRows', () => {
  it('produces an edge-list with endpoints + spread data', () => {
    const rows = toEdgeRows(graph);
    expect(rows[0]).toMatchObject({ id: 'a-b', source: 'a', target: 'b', type: 'knows', since: 2020 });
  });
});

describe('inferColumns', () => {
  it('unions keys across rows (first-seen order) with humanized headers', () => {
    const columns = inferColumns(toNodeRows(graph));
    expect(columns.map((c) => c.id)).toEqual(['id', 'kind', 'type', 'name', 'age']); // 'age' from row a survives
    expect(columns.find((c) => c.id === 'id')?.header).toBe('ID');
  });

  it('humanizes camelCase / snake_case edge columns', () => {
    const columns = inferColumns(toEdgeRows(graph));
    expect(columns.map((c) => c.id)).toContain('source');
  });

  it('humanizes nodeId → Node ID and node_label → Node Label', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [{ id: nodeId('a'), kind: 'entity', data: { nodeId: 1, node_label: 'x' } }],
      edges: [],
      graph: {},
    };
    const header = (id: string) => inferColumns(toNodeRows(g)).find((c) => c.id === id)?.header;
    expect(header('nodeId')).toBe('Node ID');
    expect(header('node_label')).toBe('Node Label');
  });
});

describe('reserved-key collisions (canonical identity must win)', () => {
  it('a node’s own id/kind win; a colliding data.id is namespaced as data.id', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [{ id: nodeId('a'), kind: 'entity', data: { id: 'OVERWRITTEN', kind: 'BAD', label: 'x' } }],
      edges: [],
      graph: {},
    };
    const row = toNodeRows(g)[0];
    expect(row.id).toBe('a'); // identity preserved
    expect(row.kind).toBe('entity');
    expect(row['data.id']).toBe('OVERWRITTEN');
    expect(row.label).toBe('x');
  });

  it('an edge’s endpoints win over data.source/data.target', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: false,
      nodes: [{ id: nodeId('a'), kind: 'entity' }, { id: nodeId('b'), kind: 'entity' }],
      edges: [{ id: edgeId('e'), source: nodeId('a'), target: nodeId('b'), data: { source: 'HACKED', w: 5 } }],
      graph: {},
    };
    const row = toEdgeRows(g)[0];
    expect(row.source).toBe('a');
    expect(row['data.source']).toBe('HACKED');
    expect(row.w).toBe(5);
  });
});
