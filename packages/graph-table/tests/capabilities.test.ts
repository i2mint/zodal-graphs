/**
 * Tests for the table + matrix registry entries: table is the universal fallback (and wins when
 * requested); matrix is only selected when the matrix view is requested.
 */

import { describe, it, expect } from 'vitest';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { createGraphRendererRegistry } from '@zodal/graph-ui';
import { createTableRendererEntry, createMatrixRendererEntry } from '../src/headless.js';

const caps = resolveGraphCapabilities({ views: ['node-link', 'table', 'matrix'] });

function registry() {
  const r = createGraphRendererRegistry<string>();
  r.register(createTableRendererEntry('table-view'));
  r.register(createMatrixRendererEntry('matrix-view'));
  return r;
}

describe('table + matrix registry entries', () => {
  it('table wins when the table view is requested', () => {
    expect(registry().resolve(caps, { view: 'table' })).toBe('table-view');
  });

  it('matrix wins when the matrix view is requested', () => {
    expect(registry().resolve(caps, { view: 'matrix' })).toBe('matrix-view');
  });

  it('table is the fallback when no view-specific renderer fits (e.g. node-link requested, none registered)', () => {
    expect(registry().resolve(caps, { view: 'node-link' })).toBe('table-view');
  });

  it('the matrix entry opts out unless matrix is explicitly requested', () => {
    const r = createGraphRendererRegistry<string>();
    r.register(createMatrixRendererEntry('matrix-view'));
    expect(r.resolve(caps, { view: 'table' })).toBeNull(); // matrix ineligible, nothing else registered
  });
});
