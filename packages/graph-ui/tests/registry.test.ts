/**
 * Renderer-selection tests — the heart of @zodal/graph-ui: capability-ranked selection with
 * honest rank-and-degrade across scale / edit / view thresholds.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { createGraphRendererRegistry, type GraphRendererRegistry } from '../src/index.js';
import { reactFlowEntry, sigmaEntry, tableEntry } from './fixtures.js';

function fullRegistry(): GraphRendererRegistry<string> {
  const r = createGraphRendererRegistry<string>();
  // Registration order is the documented tie-break; specialized renderers still outrank by score.
  r.register(tableEntry);
  r.register(sigmaEntry);
  r.register(reactFlowEntry);
  return r;
}

describe('selection across regimes', () => {
  let registry: GraphRendererRegistry<string>;
  beforeEach(() => {
    registry = fullRegistry();
  });

  it('small + typed-ports + editable → React Flow, no degrade', () => {
    const caps = resolveGraphCapabilities({
      typedPorts: true,
      validatesConnections: true,
      canEditNode: true,
      canAddNode: true,
      scaleClass: 'small',
    });
    const sel = registry.select(caps, { nodeCount: 50, intent: 'edit', view: 'node-link' });
    expect(sel?.renderer).toBe('react-flow');
    expect(sel?.degraded).toEqual([]);
  });

  it('huge + typed-ports + editable → sigma, degrading typed ports AND editing (honest)', () => {
    const caps = resolveGraphCapabilities({ typedPorts: true, canEditNode: true, scaleClass: 'huge' });
    const sel = registry.select(caps, { nodeCount: 50_000 });
    expect(sel?.renderer).toBe('sigma'); // React Flow opted out on scale
    expect(sel?.degraded).toContain('typedPorts');
    expect(sel?.degraded).toContain('editing');
  });

  it('large + portless + explore → sigma, clean (no ports/editing wanted)', () => {
    const caps = resolveGraphCapabilities({ scaleClass: 'large' });
    const sel = registry.select(caps, { nodeCount: 20_000, intent: 'explore' });
    expect(sel?.renderer).toBe('sigma');
    expect(sel?.degraded).toEqual([]);
  });

  it('explicit table view always wins, degrading what the table cannot show', () => {
    const caps = resolveGraphCapabilities({ typedPorts: true, canEditNode: true, scaleClass: 'small' });
    const sel = registry.select(caps, { nodeCount: 50, view: 'table' });
    expect(sel?.renderer).toBe('table');
    expect(sel?.degraded).toContain('typedPorts'); // a table can't draw ports
  });

  it('an unsupported view (no matching renderer) degrades to the table fallback', () => {
    const caps = resolveGraphCapabilities({ scaleClass: 'small' });
    const sel = registry.select(caps, { nodeCount: 50, view: 'matrix' });
    expect(sel?.renderer).toBe('table'); // only entry still eligible
  });

  it('flags a multigraph the chosen renderer cannot honor', () => {
    const caps = resolveGraphCapabilities({ scaleClass: 'small', canEditNode: true });
    // table reports multigraph:true, so no gap; a renderer reporting multigraph:false would gap.
    const sel = registry.select(caps, { nodeCount: 10, view: 'table', multigraph: true });
    expect(sel?.degraded).not.toContain('multigraph');
  });
});

describe('registry mechanics', () => {
  it('resolve returns just the renderer payload', () => {
    const r = fullRegistry();
    const caps = resolveGraphCapabilities({ typedPorts: true, canEditNode: true, scaleClass: 'small' });
    expect(r.resolve(caps, { nodeCount: 10, view: 'node-link' })).toBe('react-flow');
  });

  it('an empty registry resolves to null', () => {
    const r = createGraphRendererRegistry<string>();
    expect(r.resolve(resolveGraphCapabilities())).toBeNull();
    expect(r.select(resolveGraphCapabilities())).toBeNull();
  });

  it('explain ranks every entry by score, descending', () => {
    const r = fullRegistry();
    const caps = resolveGraphCapabilities({ typedPorts: true, canEditNode: true, scaleClass: 'small' });
    const ranked = r.explain(caps, { nodeCount: 10, view: 'node-link' });
    expect(ranked[0]?.name).toBe('react-flow');
    const scores = ranked.map((x) => x.score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('ties resolve to the first-registered entry', () => {
    const r = createGraphRendererRegistry<string>();
    const flat = { tester: () => 10, capabilities: tableEntry.capabilities };
    r.register({ ...flat, renderer: 'first', name: 'first' });
    r.register({ ...flat, renderer: 'second', name: 'second' });
    expect(r.resolve(resolveGraphCapabilities())).toBe('first');
  });
});
