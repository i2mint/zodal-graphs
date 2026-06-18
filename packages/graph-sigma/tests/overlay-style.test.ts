/**
 * Tests for the overlay → sigma styling bridge (headless): role colours, role-priority conflict
 * resolution, focus-mode dimming (shared across nodes and edges), the component:N palette (with safe
 * parsing), and the distinct treatment of unknown / `dimmed` roles.
 */

import { describe, it, expect } from 'vitest';
import type { GraphOverlays, OverlayLayer } from '@zodal/graph-core';
import { nodeOverlayStyle, edgeOverlayStyle } from '../src/headless.js';

const overlays = (highlights: OverlayLayer[]): GraphOverlays => ({ highlights });
const DIM = '#e9ecef';
const UNKNOWN = '#868e96';
const PRIMARY = '#e8590c';

describe('nodeOverlayStyle', () => {
  it('colours highlighted nodes by role and marks them highlighted', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'descendants', nodes: { a: 'primary', b: 'descendant' } }]));
    expect(style('a').highlighted).toBe(true);
    expect(style('a').color).toBe(PRIMARY);
    expect(style('b').color).not.toBe(style('a').color);
  });

  it('dims non-highlighted nodes when an overlay is active (focus mode)', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'path', nodes: { a: 'path' } }]));
    expect(style('z').color).toBe(DIM);
    expect(style('z').highlighted).toBeUndefined();
  });

  it('does NOT dim when no overlay is active', () => {
    expect(nodeOverlayStyle(overlays([]))('z')).toEqual({});
  });

  it('can disable dimming', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'path', nodes: { a: 'path' } }]), { dimUnhighlighted: false });
    expect(style('z')).toEqual({});
  });

  it('treats a `dimmed` role as not-highlighted (z-below), distinct from focus-dim', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'x', nodes: { a: 'primary', d: 'dimmed' } }]));
    expect(style('d').highlighted).toBe(false);
    expect(style('d').zIndex).toBe(0);
    expect(style('d').color).not.toBe(DIM); // a deliberate dimmed role ≠ the focus-dim colour
  });

  it('resolves role conflicts by PRIORITY, not layer order (primary survives a later structural layer)', () => {
    const primaryFirst = nodeOverlayStyle(
      overlays([{ layer: 'focus', nodes: { n: 'primary' } }, { layer: 'components', nodes: { n: 'component:3' } }]),
    );
    const componentsFirst = nodeOverlayStyle(
      overlays([{ layer: 'components', nodes: { n: 'component:3' } }, { layer: 'focus', nodes: { n: 'primary' } }]),
    );
    expect(primaryFirst('n').color).toBe(PRIMARY);
    expect(componentsFirst('n').color).toBe(PRIMARY); // order-independent
  });

  it('assigns stable categorical colours to component:N and survives bad indices', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'components', nodes: { a: 'component:0', b: 'component:1', c: 'component:0', bad: 'component:-1', junk: 'component:abc' } }]));
    expect(style('a').color).toBe(style('c').color);
    expect(style('a').color).not.toBe(style('b').color);
    expect(style('bad').color).toBeDefined(); // not undefined (negative index normalized)
    expect(style('junk').color).toBeDefined(); // not undefined (non-integer → index 0)
  });

  it('paints an UNKNOWN role with a neutral colour, not the primary colour', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'x', nodes: { a: 'typo-role' } }]));
    expect(style('a').color).toBe(UNKNOWN);
    expect(style('a').color).not.toBe(PRIMARY);
  });

  it('respects roleColors overrides', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'x', nodes: { a: 'primary' } }]), { roleColors: { primary: '#000000' } });
    expect(style('a').color).toBe('#000000');
  });
});

describe('edgeOverlayStyle (focus is shared with nodes)', () => {
  it('colours highlighted edges and dims others', () => {
    const style = edgeOverlayStyle(overlays([{ layer: 'path', nodes: {}, edges: { e1: 'path' } }]));
    expect(style('e1').color).toBeDefined();
    expect(style('e2').color).toBe(DIM);
  });

  it('dims edges even when the overlay highlights only NODES (consistent focus mode)', () => {
    const style = edgeOverlayStyle(overlays([{ layer: 'ancestors', nodes: { a: 'primary' } }]));
    expect(style('any-edge').color).toBe(DIM); // node-only overlay still dims edges
  });
});
