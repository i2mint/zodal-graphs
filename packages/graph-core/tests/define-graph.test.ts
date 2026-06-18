/**
 * Tests for `defineGraph` — it must report HONEST capabilities: the conservative defaults for a
 * bare graph, and exactly what was declared for a rich one. Honesty is what makes
 * capability-ranked renderer selection trustworthy.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { defineGraph, DEFAULT_GRAPH_CAPABILITIES } from '../src/index.js';

describe('defineGraph', () => {
  it('a bare graph reports the conservative defaults', () => {
    const def = defineGraph({ nodeTypes: { Person: z.object({ name: z.string() }) } });
    const caps = def.getCapabilities();
    expect(caps).toEqual(DEFAULT_GRAPH_CAPABILITIES);
    expect(caps.typedPorts).toBe(false);
    expect(caps.validatesConnections).toBe(false);
    expect(caps.views).toEqual(['node-link', 'table']);
  });

  it('infers typed ports + connection validation from a port-aware edge type', () => {
    const def = defineGraph({
      nodeTypes: { Add: z.object({ x: z.number(), y: z.number() }) },
      edgeTypes: { wire: { source: 'Add', target: 'Add', portAware: true } },
    });
    const caps = def.getCapabilities();
    expect(caps.typedPorts).toBe(true);
    expect(caps.validatesConnections).toBe(true);
  });

  it('an editable graph turns on CRUD and adds the form view', () => {
    const def = defineGraph({
      nodeTypes: { Node: z.object({ label: z.string() }) },
      affordances: { editable: true },
    });
    const caps = def.getCapabilities();
    expect(caps.canAddNode).toBe(true);
    expect(caps.canEditNode).toBe(true);
    expect(caps.canDeleteEdge).toBe(true);
    expect(caps.views).toContain('form');
  });

  it('an executable graph enables stepping by default and can watch values', () => {
    const def = defineGraph({
      nodeTypes: { Fn: z.object({}) },
      affordances: { executable: true, watchesValues: true },
    });
    const caps = def.getCapabilities();
    expect(caps.executable).toBe(true);
    expect(caps.canStep).toBe(true);
    expect(caps.watchesValues).toBe(true);
  });

  it('an interval graph exposes the timeline view and puts the default view first', () => {
    const def = defineGraph({
      nodeTypes: { Annot: z.object({ tier: z.string() }) },
      affordances: { hasIntervals: true, defaultView: 'timeline' },
    });
    const caps = def.getCapabilities();
    expect(caps.hasIntervals).toBe(true);
    expect(caps.views[0]).toBe('timeline');
    expect(caps.views).toContain('node-link');
  });
});
