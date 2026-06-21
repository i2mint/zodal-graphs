/**
 * Tests for view switching — the active-view field is a pure setter, so selection/filters survive.
 */

import { describe, it, expect } from 'vitest';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { availableViews, initViewState, switchView, switchViewChecked, canSwitchTo } from '../src/headless.js';

const caps = resolveGraphCapabilities({ views: ['node-link', 'table', 'matrix'] });

describe('view switching', () => {
  it('lists the graph’s available views', () => {
    expect(availableViews(caps)).toEqual(['node-link', 'table', 'matrix']);
  });

  it('inits to the first declared view', () => {
    expect(initViewState(caps).activeView).toBe('node-link');
  });

  it('switchView changes the view but preserves all other state', () => {
    const state = { activeView: 'node-link' as const, selection: ['a', 'b'], filter: 'x' };
    const next = switchView(state, 'table');
    expect(next.activeView).toBe('table');
    expect(next.selection).toEqual(['a', 'b']); // preserved by construction
    expect(next.filter).toBe('x');
  });

  it('canSwitchTo respects the declared views', () => {
    expect(canSwitchTo(caps, 'matrix')).toBe(true);
    expect(canSwitchTo(caps, 'timeline')).toBe(false);
  });

  it('switchViewChecked refuses a view the graph does not declare', () => {
    const state = { activeView: 'table' as const };
    expect(switchViewChecked(caps, state, 'matrix').activeView).toBe('matrix'); // available → switches
    expect(switchViewChecked(caps, state, 'timeline')).toBe(state); // unavailable → unchanged (same ref)
  });
});
