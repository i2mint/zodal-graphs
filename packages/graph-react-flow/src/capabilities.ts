/**
 * The React Flow renderer's honest capabilities and its registry entry — headless (no React).
 *
 * This is the "schema↔render mapping" half: a `GraphRendererEntry` that registers the React Flow
 * renderer into a `@zodal/graph-ui` registry and ranks it for the small-rich, typed-port, editable
 * regime. The renderer payload is passed in by the consumer (the React component), so this module
 * stays React-free.
 */

import type { RendererCapabilities } from '@zodal/graph-core';
import {
  makeTester,
  PRIORITY,
  allOf,
  isTypedPortGraph,
  wantsEditing,
  scaleAtMost,
  viewIs,
  type GraphRendererEntry,
} from '@zodal/graph-ui';

/** React Flow's honest self-description: a small-rich SVG editor with first-class typed handles. */
export const reactFlowCapabilities: RendererCapabilities = {
  renderer: 'react-flow',
  typedPorts: true,
  validatesConnections: true,
  editing: true,
  compoundNodes: true,
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: true,
  watchesValues: true,
  intervals: false,
  traversalOverlays: ['path', 'ancestors', 'descendants', 'stale', 'cycles', 'topological', 'critical-path'],
  views: ['node-link'],
  maxComfortableNodes: 2000,
  layoutEngines: ['dagre', 'elk'],
  rendering: 'svg',
  side: 'client',
};

/**
 * Build the registry entry for the React Flow renderer. Pass the renderer payload (e.g. the
 * `GraphFlowView` component, or a wrapper of it) as `renderer`. Eligible only as a node-link view
 * up to its comfortable scale; specialized — and so ranked up — for typed ports and editing.
 */
export function createReactFlowRendererEntry<T>(renderer: T): GraphRendererEntry<T> {
  return {
    name: 'react-flow',
    renderer,
    capabilities: reactFlowCapabilities,
    tester: makeTester({
      eligible: allOf(scaleAtMost(reactFlowCapabilities.maxComfortableNodes), viewIs('node-link')),
      base: PRIORITY.DEFAULT,
      bonuses: [
        [isTypedPortGraph, PRIORITY.LIBRARY],
        [wantsEditing, PRIORITY.LIBRARY],
      ],
    }),
  };
}
