/**
 * Tests for the sigma registry entry — honest capabilities and that it wins at large scale (the
 * degrade target) where the small-rich editor opts out. Headless.
 */

import { describe, it, expect } from 'vitest';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { createGraphRendererRegistry } from '@zodal/graph-ui';
import { sigmaCapabilities, createSigmaRendererEntry } from '../src/headless.js';

describe('sigmaCapabilities', () => {
  it('honestly reports a large-scale WebGL viewer that draws overlays but not ports/editing', () => {
    expect(sigmaCapabilities.typedPorts).toBe(false);
    expect(sigmaCapabilities.editing).toBe(false);
    expect(sigmaCapabilities.provenanceOverlay).toBe(true); // it DOES draw overlays
    expect(sigmaCapabilities.rendering).toBe('webgl');
    expect(sigmaCapabilities.maxComfortableNodes).toBeGreaterThan(10_000);
  });
});

describe('createSigmaRendererEntry', () => {
  function registryWith(renderer = 'sigma-view') {
    const r = createGraphRendererRegistry<string>();
    r.register(createSigmaRendererEntry(renderer));
    return r;
  }

  it('wins (cleanly) for a large portless node-link explore graph', () => {
    const caps = resolveGraphCapabilities({ scaleClass: 'large' });
    const sel = registryWith().select(caps, { nodeCount: 20_000, view: 'node-link', intent: 'explore' });
    expect(sel?.renderer).toBe('sigma-view');
    expect(sel?.degraded).toEqual([]);
  });

  it('is eligible at any scale (node-link), so it also covers small graphs when alone', () => {
    const caps = resolveGraphCapabilities({});
    expect(registryWith().resolve(caps, { nodeCount: 5, view: 'node-link' })).toBe('sigma-view');
  });

  it('opts out of non-node-link views', () => {
    expect(registryWith().resolve(resolveGraphCapabilities({}), { view: 'table' })).toBeNull();
  });
});
