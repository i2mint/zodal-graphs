/**
 * Tests for the React Flow registry entry — that it reports honest capabilities and wins selection
 * for the regime it's specialized for. Headless: registers a string payload, never renders.
 */

import { describe, it, expect } from 'vitest';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { createGraphRendererRegistry } from '@zodal/graph-ui';
import { reactFlowCapabilities, createReactFlowRendererEntry } from '../src/capabilities.js';

describe('reactFlowCapabilities', () => {
  it('honestly reports typed-port editing', () => {
    expect(reactFlowCapabilities.typedPorts).toBe(true);
    expect(reactFlowCapabilities.validatesConnections).toBe(true);
    expect(reactFlowCapabilities.editing).toBe(true);
    expect(reactFlowCapabilities.views).toEqual(['node-link']);
  });
});

describe('createReactFlowRendererEntry in a graph-ui registry', () => {
  function registryWith(renderer = 'react-flow-view') {
    const r = createGraphRendererRegistry<string>();
    r.register(createReactFlowRendererEntry(renderer));
    return r;
  }

  it('wins (cleanly) for a small typed-port editable node-link graph', () => {
    const caps = resolveGraphCapabilities({
      typedPorts: true,
      validatesConnections: true,
      canEditNode: true,
      scaleClass: 'small',
    });
    const sel = registryWith().select(caps, { nodeCount: 50, view: 'node-link', intent: 'edit' });
    expect(sel?.renderer).toBe('react-flow-view');
    expect(sel?.degraded).toEqual([]);
  });

  it('opts out beyond its comfortable scale', () => {
    const caps = resolveGraphCapabilities({ typedPorts: true, scaleClass: 'huge' });
    // Ineligible at 50k nodes; with no fallback registered, selection is null.
    expect(registryWith().resolve(caps, { nodeCount: 50_000 })).toBeNull();
  });

  it('opts out when a non-node-link view is requested', () => {
    const caps = resolveGraphCapabilities({ typedPorts: true, scaleClass: 'small' });
    expect(registryWith().resolve(caps, { nodeCount: 10, view: 'table' })).toBeNull();
  });
});
