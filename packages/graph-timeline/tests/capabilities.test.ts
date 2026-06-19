/**
 * Tests for the timeline registry entry: it wins by OVERRIDE for an interval graph, and opts out for
 * non-temporal graphs / non-timeline views.
 */

import { describe, it, expect } from 'vitest';
import { resolveGraphCapabilities } from '@zodal/graph-core';
import { createGraphRendererRegistry, makeTester, PRIORITY } from '@zodal/graph-ui';
import { timelineCapabilities, createTimelineRendererEntry } from '../src/headless.js';

describe('timelineCapabilities', () => {
  it('is the only renderer reporting intervals: true', () => {
    expect(timelineCapabilities.intervals).toBe(true);
    expect(timelineCapabilities.views).toEqual(['timeline']);
  });
});

describe('createTimelineRendererEntry', () => {
  it('wins by OVERRIDE for an interval graph, beating an editor renderer', () => {
    const r = createGraphRendererRegistry<string>();
    // A would-be editor that scores high but must lose to the timeline override:
    r.register({ name: 'editor', renderer: 'editor', capabilities: timelineCapabilities, tester: makeTester({ base: PRIORITY.APP }) });
    r.register(createTimelineRendererEntry('timeline-view'));
    const caps = resolveGraphCapabilities({ hasIntervals: true, views: ['timeline', 'node-link'] });
    expect(r.resolve(caps, { view: 'timeline' })).toBe('timeline-view');
  });

  it('opts out when the graph has no intervals', () => {
    const r = createGraphRendererRegistry<string>();
    r.register(createTimelineRendererEntry('timeline-view'));
    expect(r.resolve(resolveGraphCapabilities({ hasIntervals: false }), { view: 'timeline' })).toBeNull();
  });

  it('opts out for a non-timeline view even when intervals exist', () => {
    const r = createGraphRendererRegistry<string>();
    r.register(createTimelineRendererEntry('timeline-view'));
    expect(r.resolve(resolveGraphCapabilities({ hasIntervals: true }), { view: 'table' })).toBeNull();
  });
});
