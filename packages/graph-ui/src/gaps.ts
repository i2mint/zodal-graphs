/**
 * Capability-gap computation — the "degrade" half of rank-and-degrade.
 *
 * When the best-ranked renderer cannot honor everything the graph declares (e.g. a huge graph
 * forces a WebGL viz renderer that cannot draw typed ports or edit nodes), selection still
 * succeeds but reports honestly WHAT was dropped. Consumers use this to hide affordances the
 * active renderer can't deliver — the same honesty principle as a store's `getCapabilities()`.
 */

import type { GraphCapabilities, RendererCapabilities } from '@zodal/graph-core';
import type { GraphRenderContext } from './context.js';
import { wantsEditing } from './testers.js';

/** A specific thing the graph wants that the chosen renderer cannot provide. */
export type CapabilityGap =
  | 'typedPorts'
  | 'editing'
  | 'multigraph'
  | 'directed'
  | 'undirected'
  | 'provenanceOverlay'
  | 'compoundNodes'
  | 'scale';

/**
 * Compute what the graph asks for that `renderer` cannot honor. An empty array means a clean,
 * fully-capable match.
 */
export function computeGaps(
  graph: GraphCapabilities,
  renderer: RendererCapabilities,
  context: GraphRenderContext,
): CapabilityGap[] {
  const gaps: CapabilityGap[] = [];

  if (graph.typedPorts && !renderer.typedPorts) gaps.push('typedPorts');
  if (wantsEditing(graph, context) && !renderer.editing) gaps.push('editing');
  // directed/multigraph are structural facts of the instance, supplied via context (default directed).
  const directed = context.directed ?? true;
  if (directed && !renderer.directed) gaps.push('directed');
  if (!directed && !renderer.undirected) gaps.push('undirected');
  if (context.multigraph && !renderer.multigraph) gaps.push('multigraph');
  if (graph.canCollapseToComponent && !renderer.compoundNodes) gaps.push('compoundNodes');
  if (graph.hasProvenance && !renderer.provenanceOverlay) gaps.push('provenanceOverlay');
  if (context.nodeCount !== undefined && context.nodeCount > renderer.maxComfortableNodes) {
    gaps.push('scale');
  }

  return gaps;
}
