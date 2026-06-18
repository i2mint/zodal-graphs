/**
 * Paper renderers for the selection tests: three reference renderer entries (React Flow editor,
 * sigma WebGL viz, table fallback) with honest `RendererCapabilities` and capability-ranked
 * testers. The payload type is just `string` (the registry is generic and never inspects it).
 */

import type { RendererCapabilities } from '@zodal/graph-core';
import {
  makeTester,
  allOf,
  PRIORITY,
  isTypedPortGraph,
  wantsEditing,
  scaleAtMost,
  scaleAtLeast,
  viewIs,
  viewRequested,
  type GraphRendererEntry,
} from '../src/index.js';

export const reactFlowCaps: RendererCapabilities = {
  renderer: 'react-flow',
  typedPorts: true,
  editing: true,
  compoundNodes: true,
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: true,
  maxComfortableNodes: 2000,
  layoutEngines: ['dagre', 'elk'],
  rendering: 'svg',
  side: 'client',
};

export const sigmaCaps: RendererCapabilities = {
  renderer: 'sigma',
  typedPorts: false, // WebGL renderers cannot draw ports — honest report
  editing: false,
  compoundNodes: false,
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: true,
  maxComfortableNodes: 100_000,
  layoutEngines: ['forceatlas2'],
  rendering: 'webgl',
  side: 'client',
};

export const tableCaps: RendererCapabilities = {
  renderer: 'table',
  typedPorts: false,
  editing: true,
  compoundNodes: false,
  directed: true,
  undirected: true,
  multigraph: true,
  provenanceOverlay: false,
  maxComfortableNodes: 1_000_000, // virtualized
  layoutEngines: [],
  rendering: 'svg',
  side: 'client',
};

/** Small-rich editor: eligible only as node-link up to ~2k nodes; specialized for ports + editing. */
export const reactFlowEntry: GraphRendererEntry<string> = {
  name: 'react-flow',
  renderer: 'react-flow',
  capabilities: reactFlowCaps,
  tester: makeTester({
    eligible: allOf(scaleAtMost(2000), viewIs('node-link')),
    base: PRIORITY.DEFAULT,
    bonuses: [
      [isTypedPortGraph, PRIORITY.LIBRARY],
      [wantsEditing, PRIORITY.LIBRARY],
    ],
  }),
};

/** Large-sparse viz: eligible as node-link at any scale; specialized for big graphs. */
export const sigmaEntry: GraphRendererEntry<string> = {
  name: 'sigma',
  renderer: 'sigma',
  capabilities: sigmaCaps,
  tester: makeTester({
    eligible: viewIs('node-link'),
    base: PRIORITY.DEFAULT,
    bonuses: [[scaleAtLeast(2000), PRIORITY.LIBRARY]],
  }),
};

/** Universal fallback: always eligible (renders anything as a table); wins when table is requested. */
export const tableEntry: GraphRendererEntry<string> = {
  name: 'table',
  renderer: 'table',
  capabilities: tableCaps,
  tester: makeTester({
    base: PRIORITY.FALLBACK,
    bonuses: [[viewRequested('table'), PRIORITY.APP]],
  }),
};
