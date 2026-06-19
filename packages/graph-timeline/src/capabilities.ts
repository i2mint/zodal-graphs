/**
 * The timeline renderer's capabilities and its registry entry — headless (no React/visx).
 *
 * The timeline is the only renderer that reports `intervals: true`. Its selection rule (research P6
 * line 1) is an OVERRIDE: when the graph declares `hasIntervals` and the timeline view is in play,
 * the timeline wins outright (a temporal graph is a timeline, not a node-link diagram).
 */

import type { RendererCapabilities } from '@zodal/graph-core';
import { allOf, hasIntervals, makeTester, PRIORITY, viewIs, type GraphRendererEntry } from '@zodal/graph-ui';

/** The timeline's honest self-description: an interval-tier surface, the only one that draws intervals. */
export const timelineCapabilities: RendererCapabilities = {
  renderer: 'timeline',
  typedPorts: false,
  validatesConnections: false,
  editing: false,
  compoundNodes: false,
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: false,
  watchesValues: false,
  intervals: true, // THE interval renderer
  traversalOverlays: [],
  views: ['timeline'],
  maxComfortableNodes: 50_000,
  layoutEngines: [],
  rendering: 'svg',
  side: 'client',
};

/**
 * Build the registry entry for the timeline renderer. Eligible — and an OVERRIDE winner — only when
 * the graph has intervals and the timeline view is in play (unset or `timeline`); otherwise it opts
 * out so a non-temporal lens is chosen.
 */
export function createTimelineRendererEntry<T>(renderer: T): GraphRendererEntry<T> {
  return {
    name: 'timeline',
    renderer,
    capabilities: timelineCapabilities,
    tester: makeTester({
      eligible: allOf(hasIntervals, viewIs('timeline')),
      base: PRIORITY.OVERRIDE,
    }),
  };
}
