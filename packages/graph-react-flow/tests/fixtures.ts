/**
 * Test fixture: a meshed-style func graph with typed ports — f1 emits a number; f2 takes a number
 * on `x`, a string on `y`; f3 has an untyped `in` port.
 */

import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId } from '@zodal/graph-core';

export function portGraph(): CanonicalGraph {
  return {
    directed: true,
    multigraph: true,
    nodes: [
      { id: nodeId('f1'), kind: 'func', ports: [{ port: 'out', direction: 'out', type: { base: 'number' } }] },
      {
        id: nodeId('f2'),
        kind: 'func',
        ports: [
          { port: 'x', direction: 'in', type: { base: 'number' } },
          { port: 'y', direction: 'in', type: { base: 'string' } },
          { port: 'out', direction: 'out', type: { base: 'number' } },
        ],
      },
      { id: nodeId('f3'), kind: 'func', ports: [{ port: 'in', direction: 'in' }] }, // untyped in-port
    ],
    edges: [],
    graph: {},
  };
}
