/**
 * Tests for resolveNodeRenderStyle (issue #35): data-driven node color/size/label, with top-level
 * attribute precedence and safe defaults. Pure — no WebGL/sigma needed.
 */

import { describe, it, expect } from 'vitest';
import { resolveNodeRenderStyle, DEFAULT_NODE_SIZE } from '../src/node-style.js';

describe('resolveNodeRenderStyle', () => {
  it('promotes color/size/label from attrs.data', () => {
    const s = resolveNodeRenderStyle({ data: { color: '#FF0000', size: 9, label: 'Donor X' } }, 'n1');
    expect(s).toEqual({ size: 9, label: 'Donor X', color: '#FF0000' });
  });

  it('top-level attribute wins over the data fallback', () => {
    const s = resolveNodeRenderStyle({ size: 3, color: '#00FF00', data: { size: 9, color: '#FF0000' } }, 'n1');
    expect(s.size).toBe(3);
    expect(s.color).toBe('#00FF00');
  });

  it('defaults: size = DEFAULT_NODE_SIZE, label = id, no color', () => {
    expect(resolveNodeRenderStyle({}, 'node-42')).toEqual({
      size: DEFAULT_NODE_SIZE,
      label: 'node-42',
      color: undefined,
    });
  });

  it('ignores wrong-typed values (non-string color, non-number size) → defaults', () => {
    const s = resolveNodeRenderStyle({ data: { color: 123, size: 'big', label: '' } }, 'n');
    expect(s.color).toBeUndefined();
    expect(s.size).toBe(DEFAULT_NODE_SIZE);
    expect(s.label).toBe('n'); // empty label falls back to id
  });
});
