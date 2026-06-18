/**
 * Capabilities + registry entries for the table and matrix lenses (headless).
 *
 * The table is the universal lens (every graph can be shown as one), so its entry registers as the
 * FALLBACK and wins when `table` is explicitly requested. The matrix lens is only eligible when
 * `matrix` is requested. Both register into a `@zodal/graph-ui` registry; the renderer payload (the
 * consumer's TanStack / heat-cell component) is passed in.
 */

import type { RendererCapabilities } from '@zodal/graph-core';
import { makeTester, PRIORITY, viewRequested, type GraphRendererEntry } from '@zodal/graph-ui';

/** The table lens: the universal, virtualizable grid surface (no graph drawing). */
export const tableCapabilities: RendererCapabilities = {
  renderer: 'table',
  typedPorts: false,
  validatesConnections: false,
  editing: true, // cell / property editing
  compoundNodes: false,
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: false, // a table doesn't draw graph overlays
  watchesValues: false,
  intervals: false,
  traversalOverlays: [],
  views: ['table'],
  maxComfortableNodes: 1_000_000, // virtualized
  layoutEngines: [],
  rendering: 'svg',
  side: 'client',
};

/** The matrix lens: an adjacency/relation heat-grid. */
export const matrixCapabilities: RendererCapabilities = {
  renderer: 'matrix',
  typedPorts: false,
  validatesConnections: false,
  editing: false,
  compoundNodes: false,
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: false,
  watchesValues: false,
  intervals: false,
  traversalOverlays: [],
  views: ['matrix'],
  maxComfortableNodes: 5_000, // quadratic screen cost
  layoutEngines: [],
  rendering: 'canvas',
  side: 'client',
};

/** Register the table renderer: the universal fallback, winning when `table` is requested. */
export function createTableRendererEntry<T>(renderer: T): GraphRendererEntry<T> {
  return {
    name: 'table',
    renderer,
    capabilities: tableCapabilities,
    tester: makeTester({
      base: PRIORITY.FALLBACK,
      bonuses: [[viewRequested('table'), PRIORITY.APP]],
    }),
  };
}

/** Register the matrix renderer: eligible (and selected) only when `matrix` is requested. */
export function createMatrixRendererEntry<T>(renderer: T): GraphRendererEntry<T> {
  return {
    name: 'matrix',
    renderer,
    capabilities: matrixCapabilities,
    tester: makeTester({
      eligible: viewRequested('matrix'),
      base: PRIORITY.APP,
    }),
  };
}
