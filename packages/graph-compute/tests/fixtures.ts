/**
 * Test fixtures: a small diamond DAG with a second disconnected component, and a 3-cycle.
 *
 *   a → b → d → e        x → y        (dag)        a → b → c → a   (cyclic)
 *   a → c → d
 */

import type { CanonicalGraph } from '@zodal/graph-core';
import { nodeId, edgeId } from '@zodal/graph-core';

const n = (id: string) => ({ id: nodeId(id), kind: 'entity' as const });
const e = (id: string, s: string, t: string) => ({ id: edgeId(id), source: nodeId(s), target: nodeId(t) });

export function dag(): CanonicalGraph {
  return {
    directed: true,
    multigraph: false,
    nodes: ['a', 'b', 'c', 'd', 'e', 'x', 'y'].map(n),
    edges: [
      e('a-b', 'a', 'b'),
      e('a-c', 'a', 'c'),
      e('b-d', 'b', 'd'),
      e('c-d', 'c', 'd'),
      e('d-e', 'd', 'e'),
      e('x-y', 'x', 'y'),
    ],
    graph: {},
  };
}

export function cyclic(): CanonicalGraph {
  return {
    directed: true,
    multigraph: false,
    nodes: ['a', 'b', 'c'].map(n),
    edges: [e('a-b', 'a', 'b'), e('b-c', 'b', 'c'), e('c-a', 'c', 'a')],
    graph: {},
  };
}
