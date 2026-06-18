/**
 * Tests for the overlay → sigma styling bridge (headless). This is the renderer-agnostic-overlay
 * drawing logic: a GraphOverlays block becomes per-element style (role colour, focus-mode dimming).
 */

import { describe, it, expect } from 'vitest';
import type { GraphOverlays, OverlayLayer } from '@zodal/graph-core';
import { nodeOverlayStyle, edgeOverlayStyle } from '../src/headless.js';

const overlays = (highlights: OverlayLayer[]): GraphOverlays => ({ highlights });
const DIM = '#dee2e6';
const PRIMARY = '#e8590c';

describe('nodeOverlayStyle', () => {
  it('colours highlighted nodes by role and marks them highlighted', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'descendants', nodes: { a: 'primary', b: 'descendant' } }]));
    expect(style('a').highlighted).toBe(true);
    expect(style('a').color).toBe(PRIMARY);
    expect(style('b').color).not.toBe(style('a').color); // different role → different colour
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

  it('assigns stable categorical colours to component:N roles', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'components', nodes: { a: 'component:0', b: 'component:1', c: 'component:0' } }]));
    expect(style('a').color).toBe(style('c').color); // same component → same colour
    expect(style('a').color).not.toBe(style('b').color); // different component → different colour
  });

  it('respects roleColors overrides', () => {
    const style = nodeOverlayStyle(overlays([{ layer: 'x', nodes: { a: 'primary' } }]), { roleColors: { primary: '#000000' } });
    expect(style('a').color).toBe('#000000');
  });

  it('later layers win on a node-role conflict', () => {
    const style = nodeOverlayStyle(
      overlays([
        { layer: 'a', nodes: { n: 'descendant' } },
        { layer: 'b', nodes: { n: 'primary' } },
      ]),
    );
    expect(style('n').color).toBe(PRIMARY);
  });
});

describe('edgeOverlayStyle', () => {
  it('colours highlighted edges and dims others when active', () => {
    const style = edgeOverlayStyle(overlays([{ layer: 'path', nodes: {}, edges: { e1: 'path' } }]));
    expect(style('e1').color).toBeDefined();
    expect(style('e2').color).toBe(DIM);
  });
});
