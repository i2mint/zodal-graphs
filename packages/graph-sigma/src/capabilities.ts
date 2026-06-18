/**
 * The sigma renderer's honest capabilities and its registry entry — headless (no React/sigma).
 *
 * sigma is the large-sparse VIZ renderer: it scales to ~100k nodes on WebGL but cannot draw typed
 * ports or edit. It CAN draw `@zodal/graph-compute` overlays (via `overlay-style.ts`), so it reports
 * `provenanceOverlay: true` and the overlay kinds it can colour — honestly. This entry registers it
 * into a `@zodal/graph-ui` registry; it ranks up at large scale (where the React Flow editor opts out).
 */

import type { RendererCapabilities } from '@zodal/graph-core';
import {
  makeTester,
  PRIORITY,
  scaleAtLeast,
  viewIs,
  type GraphRendererEntry,
} from '@zodal/graph-ui';

/** sigma's honest self-description: a large-scale WebGL node-link viewer that draws overlays. */
export const sigmaCapabilities: RendererCapabilities = {
  renderer: 'sigma',
  typedPorts: false, // WebGL renderers can't draw ports
  validatesConnections: false,
  editing: false,
  compoundNodes: false,
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: true, // overlays are drawn via overlay-style.ts
  watchesValues: false,
  intervals: false,
  // Overlay styling is role-based, so it can colour any overlay layer graph-compute emits.
  traversalOverlays: ['path', 'ancestors', 'descendants', 'stale', 'cycles', 'components'],
  views: ['node-link'],
  maxComfortableNodes: 100_000,
  layoutEngines: ['forceatlas2', 'noverlap'],
  rendering: 'webgl',
  side: 'client',
};

/**
 * Build the registry entry for the sigma renderer. Pass the renderer payload (e.g. `SigmaView`).
 * Eligible as a node-link view at any scale; ranked up for large graphs, so it becomes the selected
 * renderer when the small-rich editor opts out on scale.
 */
export function createSigmaRendererEntry<T>(renderer: T): GraphRendererEntry<T> {
  return {
    name: 'sigma',
    renderer,
    capabilities: sigmaCapabilities,
    tester: makeTester({
      eligible: viewIs('node-link'),
      base: PRIORITY.DEFAULT,
      bonuses: [[scaleAtLeast(2000), PRIORITY.LIBRARY]],
    }),
  };
}
