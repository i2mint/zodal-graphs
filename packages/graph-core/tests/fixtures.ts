/**
 * Shared test fixtures: a port-rich meshed-style func graph and a portless entity graph.
 */

import type { CanonicalGraph } from '../src/index.js';
import { nodeId, edgeId } from '../src/index.js';

/**
 * A meshed-style bipartite computation graph that exercises every port-bearing feature:
 * typed in/out ports, port-level edges, and PARALLEL multi-edges (f1.out feeds both f2.x and
 * f2.y → two edges sharing the same node pair, distinguished only by `targetPort`). This is the
 * fixture the port-fidelity benchmark round-trips through every adapter.
 */
export function portRichGraph(): CanonicalGraph {
  return {
    directed: true,
    multigraph: true,
    nodes: [
      {
        id: nodeId('f1'),
        kind: 'func',
        type: 'Source',
        funcRef: { ref: 'pkg.ops:source', lang: 'ts' },
        ports: [{ port: 'out', direction: 'out', type: { base: 'number' } }],
        position: { x: 0, y: 0 },
      },
      {
        id: nodeId('f2'),
        kind: 'func',
        type: 'Add',
        funcRef: { ref: 'pkg.ops:add', lang: 'py', hash: 'abc123' },
        ports: [
          {
            port: 'x',
            param: 'x',
            direction: 'in',
            kind: 'positional_or_keyword',
            required: true,
            type: { base: 'number' },
          },
          { port: 'y', param: 'y', direction: 'in', required: false, default: 0, type: { base: 'number' } },
          { port: 'out', direction: 'out', type: { base: 'number' } },
        ],
        data: { label: 'a + b' },
      },
      {
        id: nodeId('f3'),
        kind: 'func',
        type: 'Sink',
        funcRef: { ref: 'pkg.ops:sink', lang: 'ts' },
        ports: [
          { port: 'in', direction: 'in', type: { base: 'number' } },
          { port: 'out', direction: 'out', type: { base: 'string' } },
        ],
      },
    ],
    edges: [
      { id: edgeId('e1'), source: nodeId('f1'), target: nodeId('f2'), sourcePort: 'out', targetPort: 'x' },
      { id: edgeId('e2'), source: nodeId('f1'), target: nodeId('f2'), sourcePort: 'out', targetPort: 'y' },
      { id: edgeId('e3'), source: nodeId('f2'), target: nodeId('f3'), sourcePort: 'out', targetPort: 'in', type: 'dataflow' },
    ],
    graph: { zodal: { schemaRefs: { Add: '#/Add' } } },
  };
}

/** A plain portless entity graph (the common case — must stay simple, no bipartite leakage). */
export function entityGraph(): CanonicalGraph {
  return {
    directed: true,
    multigraph: false,
    nodes: [
      { id: nodeId('a'), kind: 'entity', type: 'Person', data: { name: 'Ada' } },
      { id: nodeId('b'), kind: 'entity', type: 'Person', data: { name: 'Bob' } },
      { id: nodeId('c'), kind: 'entity', type: 'Person', data: { name: 'Cy' } },
    ],
    edges: [
      { id: edgeId('a-b'), source: nodeId('a'), target: nodeId('b'), type: 'knows' },
      { id: edgeId('b-c'), source: nodeId('b'), target: nodeId('c'), type: 'knows' },
    ],
    graph: {},
  };
}
