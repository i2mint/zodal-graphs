/**
 * ⛔ PORT-FIDELITY BENCHMARK — the checkpoint-1 gate.
 *
 * A port-rich, meshed-style fixture (typed ports + port-level edges + parallel multi-edges)
 * round-trips `canonical → X → canonical` through every adapter: the serializer, graphology,
 * React Flow, and ELK. If ANY adapter drops a port-level edge or a port, the canonical port
 * contract is wrong — fix the model before adding more adapters.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph, GraphNode, GraphEdge } from '../src/index.js';
import {
  toNodesAndLinks,
  fromNodesAndLinks,
  toReactFlow,
  fromReactFlow,
  toELK,
  fromELK,
} from '../src/index.js';
import { toGraphology, fromGraphology } from '../src/graphology.js';
import { portRichGraph, entityGraph } from './fixtures.js';

// --- comparison helpers -----------------------------------------------------

const byId = <T extends { id: string }>(arr: readonly T[]): T[] =>
  [...arr].sort((a, b) => a.id.localeCompare(b.id));

/** The load-bearing assertion: every port and every port-level edge survives the round-trip. */
function assertPortFidelity(original: CanonicalGraph, actual: CanonicalGraph): void {
  // Ports: same set of (node → port names + direction + base type).
  const portMap = (g: CanonicalGraph): Record<string, string[]> => {
    const m: Record<string, string[]> = {};
    for (const n of g.nodes) {
      m[n.id] = (n.ports ?? [])
        .map((p) => `${p.port}:${p.direction}:${p.type?.base ?? '∅'}`)
        .sort();
    }
    return m;
  };
  expect(portMap(actual)).toEqual(portMap(original));

  // Edges: same set of (id → source/target/sourcePort/targetPort). This is what flat formats drop.
  const edgeMap = (g: CanonicalGraph): Record<string, string> => {
    const m: Record<string, string> = {};
    for (const e of g.edges) {
      m[e.id] = `${e.source}.${e.sourcePort ?? '∅'} -> ${e.target}.${e.targetPort ?? '∅'}`;
    }
    return m;
  };
  expect(edgeMap(actual)).toEqual(edgeMap(original));
}

const nodes = (g: CanonicalGraph): GraphNode[] => byId(g.nodes);
const edges = (g: CanonicalGraph): GraphEdge[] => byId(g.edges);

// --- the benchmark ----------------------------------------------------------

describe.each([
  ['port-rich (meshed-style)', portRichGraph],
  ['entity (portless)', entityGraph],
])('round-trip: %s', (_label, make) => {
  it('serializer (nodes_and_links) is loss-free', () => {
    const g = make();
    const rt = fromNodesAndLinks(toNodesAndLinks(g));
    assertPortFidelity(g, rt);
    expect(nodes(rt)).toEqual(nodes(g));
    expect(edges(rt)).toEqual(edges(g));
    expect(rt.directed).toBe(g.directed);
    expect(rt.multigraph).toBe(g.multigraph);
    expect(rt.graph).toEqual(g.graph);
  });

  it('graphology adapter is loss-free (incl. parallel multi-edges)', () => {
    const g = make();
    const rt = fromGraphology(toGraphology(g));
    assertPortFidelity(g, rt);
    expect(nodes(rt)).toEqual(nodes(g));
    expect(edges(rt)).toEqual(edges(g));
    expect(rt.directed).toBe(g.directed);
    expect(rt.multigraph).toBe(g.multigraph);
    expect(rt.graph).toEqual(g.graph);
  });

  it('React Flow adapter preserves ports + port-level edges (handle = port)', () => {
    const g = make();
    const rt = fromReactFlow(toReactFlow(g));
    // React Flow does not carry directed/multigraph/graph-meta — compare topology only.
    assertPortFidelity(g, rt);
    expect(nodes(rt)).toEqual(nodes(g));
    expect(edges(rt)).toEqual(edges(g));
  });

  it('ELK adapter is loss-free (port-aware endpoints)', () => {
    const g = make();
    const rt = fromELK(toELK(g));
    assertPortFidelity(g, rt);
    expect(nodes(rt)).toEqual(nodes(g));
    expect(edges(rt)).toEqual(edges(g));
    expect(rt.directed).toBe(g.directed);
    expect(rt.multigraph).toBe(g.multigraph);
    expect(rt.graph).toEqual(g.graph);
  });
});

describe('React Flow handle mapping', () => {
  it('maps sourcePort/targetPort onto sourceHandle/targetHandle', () => {
    const rf = toReactFlow(portRichGraph());
    const e1 = rf.edges.find((e) => e.id === 'e1')!;
    expect(e1.sourceHandle).toBe('out');
    expect(e1.targetHandle).toBe('x');
    // The two parallel edges differ only by target handle.
    const e2 = rf.edges.find((e) => e.id === 'e2')!;
    expect(e2.source).toBe(e1.source);
    expect(e2.target).toBe(e1.target);
    expect(e2.targetHandle).toBe('y');
  });
});
