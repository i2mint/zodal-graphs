/**
 * End-to-end integration: the four zodal-graphs packages compose across their REAL published
 * boundaries (imported by package name, resolved to built dist — not src). One typed-port
 * executable graph flows through the whole facade:
 *
 *   defineGraph (graph-core) → GraphCapabilities
 *     → graph-ui selects a renderer and degrades honestly
 *     → graph-react-flow validates connections from the canonical port types
 *     → graph-compute emits renderer-agnostic overlays keyed by the same node ids
 *     → graph-core round-trips the graph through the wire format
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  defineGraph,
  nodeId,
  edgeId,
  toNodesAndLinks,
  fromNodesAndLinks,
  type CanonicalGraph,
  type RendererCapabilities,
} from '@zodal/graph-core';
import { createGraphRendererRegistry, makeTester, PRIORITY, scaleAtLeast, viewIs } from '@zodal/graph-ui';
import { computeOverlays } from '@zodal/graph-compute';
import {
  makeIsValidConnection,
  createReactFlowRendererEntry,
  reactFlowCapabilities,
} from '@zodal/graph-react-flow/headless';

// A meshed-style typed-port pipeline: f1 emits a number → f2 adds (x:number, y:string) → f3 sinks.
function pipelineGraph(): CanonicalGraph {
  return {
    directed: true,
    multigraph: true,
    nodes: [
      { id: nodeId('f1'), kind: 'func', funcRef: { ref: 'pkg:source', lang: 'ts' }, ports: [{ port: 'out', direction: 'out', type: { base: 'number' } }] },
      {
        id: nodeId('f2'),
        kind: 'func',
        funcRef: { ref: 'pkg:add', lang: 'ts' },
        ports: [
          { port: 'x', direction: 'in', type: { base: 'number' } },
          { port: 'y', direction: 'in', type: { base: 'string' } },
          { port: 'out', direction: 'out', type: { base: 'number' } },
        ],
      },
      { id: nodeId('f3'), kind: 'func', funcRef: { ref: 'pkg:sink', lang: 'ts' }, ports: [{ port: 'in', direction: 'in', type: { base: 'number' } }] },
    ],
    edges: [
      { id: edgeId('e1'), source: nodeId('f1'), target: nodeId('f2'), sourcePort: 'out', targetPort: 'x' },
      { id: edgeId('e2'), source: nodeId('f2'), target: nodeId('f3'), sourcePort: 'out', targetPort: 'in' },
    ],
    graph: {},
  };
}

// A paper large-sparse viz renderer (sigma-like) for the degrade path.
const sigmaCaps: RendererCapabilities = {
  renderer: 'sigma',
  typedPorts: false,
  validatesConnections: false,
  editing: false,
  compoundNodes: false,
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: true,
  watchesValues: false,
  intervals: false,
  traversalOverlays: ['path', 'ancestors', 'descendants', 'components'],
  views: ['node-link'],
  maxComfortableNodes: 100_000,
  layoutEngines: ['forceatlas2'],
  rendering: 'webgl',
  side: 'client',
};

const def = defineGraph({
  nodeTypes: { Fn: z.object({}) },
  edgeTypes: { wire: { source: 'Fn', target: 'Fn', portAware: true } },
  affordances: { editable: true, executable: true, traversal: ['descendants', 'path', 'cycles'] },
});
const caps = def.getCapabilities();
const graph = pipelineGraph();

function registry() {
  const r = createGraphRendererRegistry<string>();
  r.register(createReactFlowRendererEntry('react-flow'));
  r.register({
    name: 'sigma',
    renderer: 'sigma',
    capabilities: sigmaCaps,
    tester: makeTester({ eligible: viewIs('node-link'), base: PRIORITY.DEFAULT, bonuses: [[scaleAtLeast(2000), PRIORITY.LIBRARY]] }),
  });
  return r;
}

describe('the four packages compose end-to-end', () => {
  it('defineGraph reports the declared capabilities (typed ports + validation + executable)', () => {
    expect(caps.typedPorts).toBe(true);
    expect(caps.validatesConnections).toBe(true);
    expect(caps.executable).toBe(true);
    expect(caps.canEditNode).toBe(true);
  });

  it('graph-ui selects the React Flow editor for the small typed-port editable graph (no degrade)', () => {
    const sel = registry().select(caps, { nodeCount: graph.nodes.length, view: 'node-link', intent: 'edit' });
    expect(sel?.renderer).toBe('react-flow');
    expect(sel?.degraded).toEqual([]);
    expect(reactFlowCapabilities.typedPorts).toBe(true);
  });

  it('graph-ui degrades to the viz renderer at huge scale, reporting the dropped capabilities', () => {
    const sel = registry().select(caps, { nodeCount: 50_000, view: 'node-link' });
    expect(sel?.renderer).toBe('sigma'); // React Flow opted out on scale
    expect(sel?.degraded).toContain('typedPorts'); // sigma can't draw ports
    expect(sel?.degraded).toContain('validatesConnections');
    expect(sel?.degraded).toContain('editing');
  });

  it('graph-react-flow validates connections from the canonical port types', () => {
    const isValid = makeIsValidConnection(graph, caps);
    expect(isValid({ source: 'f1', sourceHandle: 'out', target: 'f2', targetHandle: 'x' })).toBe(true); // number → number
    expect(isValid({ source: 'f1', sourceHandle: 'out', target: 'f2', targetHandle: 'y' })).toBe(false); // number → string
    expect(isValid({ source: 'f1', sourceHandle: 'out', target: 'f1', targetHandle: 'out' })).toBe(false); // self / wrong direction
  });

  it('graph-compute emits renderer-agnostic overlays keyed by the same canonical node ids', () => {
    const { overlays, refused } = computeOverlays(graph, { descendantsOf: 'f1', path: { source: 'f1', target: 'f3' } }, caps);
    const layers = overlays.highlights.map((l) => l.layer);
    expect(layers).toContain('descendants');
    expect(layers).toContain('path');
    expect(refused).toEqual([]); // both kinds are in caps.traversal
    const descendants = overlays.highlights.find((l) => l.layer === 'descendants')!;
    expect(descendants.nodes['f1']).toBe('primary');
    expect(descendants.nodes['f2']).toBe('descendant');
    expect(descendants.nodes['f3']).toBe('descendant');
  });

  it('graph-compute honestly refuses an overlay the capabilities do not permit', () => {
    const { refused } = computeOverlays(graph, { provenanceOf: 'f3' }, caps); // hasProvenance defaulted false
    expect(refused).toEqual([{ request: 'provenanceOf', reason: 'provenance' }]);
  });

  it('graph-core round-trips the same graph through the nodes_and_links wire format', () => {
    const rt = fromNodesAndLinks(toNodesAndLinks(graph));
    expect(rt.nodes.map((n) => n.id).sort()).toEqual(['f1', 'f2', 'f3']);
    const e1 = rt.edges.find((e) => e.id === 'e1')!;
    expect(e1.sourcePort).toBe('out');
    expect(e1.targetPort).toBe('x'); // the typed-port edge survives
  });
});
