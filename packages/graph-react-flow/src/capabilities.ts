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

/**
 * React Flow's honest self-description: a small-rich SVG editor with first-class typed handles.
 *
 * Capabilities report only what this package actually delivers NOW (the honesty principle that
 * makes graph-ui's degrade report trustworthy). Not yet built ⇒ reported `false`/omitted, so a
 * graph that needs them is degraded honestly rather than silently mis-served:
 *  - `compoundNodes` (collapse↔expand), `watchesValues` (value overlay), `provenanceOverlay`
 *    (overlay drawing) are all deferred → `false`;
 *  - `traversalOverlays` lists only the overlay kinds `@zodal/graph-compute` can emit as layers.
 */
export const reactFlowCapabilities: RendererCapabilities = {
  renderer: 'react-flow',
  typedPorts: true,
  validatesConnections: true,
  editing: true,
  compoundNodes: false, // collapse↔expand not yet implemented (deferred — research §5 risk 3)
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: false, // no overlay→canvas drawing path yet (Horizon 3+)
  watchesValues: false, // value-watch overlay deferred (Horizon 3+, P6A)
  intervals: false,
  // Only the kinds graph-compute actually emits as overlay layers today.
  traversalOverlays: ['path', 'ancestors', 'descendants', 'stale', 'cycles', 'components'],
  views: ['node-link'],
  // React Flow renders to SVG/DOM, so it stays comfortable into the low thousands of nodes; 2000 is
  // a benchmark default for the "small" scaleClass, to measure, not a hard limit.
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
