/**
 * Tests for the traversal/provenance overlay engine — the reachability primitive and every
 * overlay producer, plus capability gating. Overlays are renderer-agnostic id→role maps.
 */

import { describe, it, expect } from 'vitest';
import type { CanonicalGraph } from '@zodal/graph-core';
import { resolveGraphCapabilities, nodeId, edgeId } from '@zodal/graph-core';
import { createTraversalEngine, computeOverlays } from '../src/index.js';
import { dag, cyclic, parallelUndirected } from './fixtures.js';

const rolesWith = (nodes: Record<string, string>, role: string): string[] =>
  Object.keys(nodes)
    .filter((k) => nodes[k] === role)
    .sort();

describe('reachability-driven overlays on a DAG', () => {
  const eng = createTraversalEngine(dag());

  it('descendants: node = primary, forward-reachable = descendant', () => {
    const l = eng.descendants('a');
    expect(l.nodes['a']).toBe('primary');
    expect(rolesWith(l.nodes, 'descendant')).toEqual(['b', 'c', 'd', 'e']);
  });

  it('ancestors: node = primary, backward-reachable = ancestor', () => {
    const l = eng.ancestors('d');
    expect(l.nodes['d']).toBe('primary');
    expect(rolesWith(l.nodes, 'ancestor')).toEqual(['a', 'b', 'c']);
  });

  it('stale set: the downstream-impacted set after a change', () => {
    const l = eng.stale(['b']);
    expect(l.nodes['b']).toBe('primary');
    expect(rolesWith(l.nodes, 'stale')).toEqual(['d', 'e']);
  });

  it('provenance: upstream sources, reusing the ancestors layer (research §4.4)', () => {
    const l = eng.provenance('e');
    expect(l.layer).toBe('ancestors'); // provenance reuses the declared vocabulary
    expect(l.nodes['e']).toBe('primary');
    expect(rolesWith(l.nodes, 'ancestor')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('shortest path highlights the path nodes AND the edges along it', () => {
    const l = eng.path('a', 'e')!;
    expect(l).not.toBeNull();
    expect(l.nodes['a']).toBe('path');
    expect(l.nodes['e']).toBe('path');
    expect(Object.keys(l.nodes)).toHaveLength(4); // a → _ → d → e
    expect(Object.keys(l.edges ?? {})).toHaveLength(3);
  });

  it('returns null for an unreachable path', () => {
    expect(eng.path('e', 'a')).toBeNull(); // no back-path in a DAG
    expect(eng.path('a', 'x')).toBeNull(); // separate component
  });

  it('topological order respects edge direction', () => {
    const order = eng.topologicalOrder();
    expect(order).not.toBeNull();
    const pos = (id: string) => order!.indexOf(id);
    expect(pos('a')).toBeLessThan(pos('d'));
    expect(pos('d')).toBeLessThan(pos('e'));
  });

  it('has no cycle', () => {
    expect(eng.cycles()).toBeNull();
  });

  it('weakly-connected components: {a..e} and {x,y}', () => {
    const l = eng.components();
    const roles = new Set(Object.values(l.nodes));
    expect(roles.size).toBe(2);
    expect(l.nodes['a']).toBe(l.nodes['e']);
    expect(l.nodes['x']).toBe(l.nodes['y']);
    expect(l.nodes['a']).not.toBe(l.nodes['x']);
  });
});

describe('cycle detection on a cyclic graph', () => {
  const eng = createTraversalEngine(cyclic());

  it('detects and highlights a cycle (nodes + edges)', () => {
    const l = eng.cycles()!;
    expect(l).not.toBeNull();
    expect(Object.keys(l.nodes).sort()).toEqual(['a', 'b', 'c']);
    expect(Object.keys(l.edges ?? {}).length).toBeGreaterThanOrEqual(2);
  });

  it('has no topological order', () => {
    expect(eng.topologicalOrder()).toBeNull();
  });
});

describe('computeOverlays capability gating (honest refusal report)', () => {
  it('emits only permitted layers AND reports the refused ones', () => {
    const caps = resolveGraphCapabilities({ traversal: ['descendants'], hasProvenance: false });
    const { overlays, refused } = computeOverlays(
      dag(),
      { descendantsOf: 'a', ancestorsOf: 'd', provenanceOf: 'e', cycles: true },
      caps,
    );
    expect(overlays.highlights.map((l) => l.layer)).toEqual(['descendants']);
    // ancestors + cycles refused (not in traversal); provenance refused (hasProvenance false)
    expect(refused.map((r) => r.request).sort()).toEqual(['ancestorsOf', 'cycles', 'provenanceOf']);
    expect(refused.find((r) => r.request === 'provenanceOf')?.reason).toBe('provenance');
    expect(refused.find((r) => r.request === 'ancestorsOf')?.kind).toBe('ancestors');
  });

  it('computes everything requested (no refusals) when no capabilities are supplied', () => {
    const { overlays, refused } = computeOverlays(dag(), { descendantsOf: 'a', ancestorsOf: 'd' });
    expect(overlays.highlights.map((l) => l.layer).sort()).toEqual(['ancestors', 'descendants']);
    expect(refused).toEqual([]);
  });

  it('gates provenance on hasProvenance', () => {
    const allowed = computeOverlays(dag(), { provenanceOf: 'e' }, resolveGraphCapabilities({ hasProvenance: true }));
    expect(allowed.overlays.highlights.map((l) => l.layer)).toEqual(['ancestors']);
    expect(allowed.refused).toEqual([]);
    const blocked = computeOverlays(dag(), { provenanceOf: 'e' }, resolveGraphCapabilities({ hasProvenance: false }));
    expect(blocked.overlays.highlights).toEqual([]);
    expect(blocked.refused).toEqual([{ request: 'provenanceOf', reason: 'provenance' }]);
  });
});

describe('multigraph & robustness regressions', () => {
  it('detects a cycle from two parallel UNDIRECTED edges, highlighting BOTH edges', () => {
    const eng = createTraversalEngine(parallelUndirected());
    const l = eng.cycles()!;
    expect(l).not.toBeNull();
    expect(Object.keys(l.nodes).sort()).toEqual(['a', 'b']);
    expect(Object.keys(l.edges ?? {}).sort()).toEqual(['e1', 'e2']); // both parallel edges form the 2-cycle
  });

  it('detects a directed self-loop', () => {
    const g: CanonicalGraph = {
      directed: true,
      multigraph: true,
      nodes: [{ id: nodeId('a'), kind: 'entity' }],
      edges: [{ id: edgeId('loop'), source: nodeId('a'), target: nodeId('a') }],
      graph: {},
    };
    const l = createTraversalEngine(g).cycles()!;
    expect(l.nodes['a']).toBe('path');
    expect(l.edges?.['loop']).toBe('path');
  });

  it('cycle detection is depth-safe on a long acyclic chain (no stack overflow)', () => {
    const N = 20_000;
    const nodes = Array.from({ length: N }, (_, i) => ({ id: nodeId(`n${i}`), kind: 'entity' as const }));
    const edges = Array.from({ length: N - 1 }, (_, i) => ({
      id: edgeId(`e${i}`),
      source: nodeId(`n${i}`),
      target: nodeId(`n${i + 1}`),
    }));
    const eng = createTraversalEngine({ directed: true, multigraph: false, nodes, edges, graph: {} });
    expect(eng.cycles()).toBeNull(); // returns null instead of throwing
    expect(eng.topologicalOrder()).toHaveLength(N);
  });
});
