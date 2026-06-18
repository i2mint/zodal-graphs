/**
 * Capability-gap computation — the "degrade" half of rank-and-degrade.
 *
 * When the best-ranked renderer cannot honor everything the graph declares (e.g. a huge graph
 * forces a WebGL viz renderer that cannot draw typed ports or edit nodes), selection still
 * succeeds but reports honestly WHAT was dropped. Consumers use this to hide affordances the
 * active renderer can't deliver — the same honesty principle as a store's `getCapabilities()`.
 *
 * Every gap has a mirror field on `RendererCapabilities`. Capabilities that are NOT a renderer's
 * concern — `canStep`, `canTimeTravel`, `canExtractSubgraph`, `canAddNode/…` beyond editing — are
 * intentionally not reported here; they belong to the runtime/store layer, not the view.
 */

import type { GraphCapabilities, RendererCapabilities } from '@zodal/graph-core';
import type { GraphRenderContext } from './context.js';
import { wantsEditing } from './testers.js';

/** A specific thing the graph wants that the chosen renderer cannot provide. */
export type CapabilityGap =
  | 'typedPorts'
  | 'validatesConnections'
  | 'editing'
  | 'compoundNodes'
  | 'multigraph'
  | 'directed'
  | 'undirected'
  | 'provenanceOverlay'
  | 'watchesValues'
  | 'intervals'
  | 'traversal'
  | 'view'
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
  if (graph.validatesConnections && !renderer.validatesConnections) gaps.push('validatesConnections');
  if (wantsEditing(graph, context) && !renderer.editing) gaps.push('editing');
  if (graph.canCollapseToComponent && !renderer.compoundNodes) gaps.push('compoundNodes');
  if (graph.hasProvenance && !renderer.provenanceOverlay) gaps.push('provenanceOverlay');
  if (graph.watchesValues && !renderer.watchesValues) gaps.push('watchesValues');
  if (graph.hasIntervals && !renderer.intervals) gaps.push('intervals');

  // Any requested traversal overlay the renderer can't draw.
  if (
    graph.traversal.length > 0 &&
    !graph.traversal.every((kind) => renderer.traversalOverlays.includes(kind))
  ) {
    gaps.push('traversal');
  }

  // An explicitly requested view the renderer doesn't present (e.g. matrix → table fallback).
  if (context.view !== undefined && !renderer.views.includes(context.view)) gaps.push('view');

  // Directedness/multigraph are structural facts of the instance, supplied via context. Report a
  // gap ONLY when the fact is known — an omitted flag is "unknown", not "directed", so no phantom gap.
  if (context.directed === true && !renderer.directed) gaps.push('directed');
  if (context.directed === false && !renderer.undirected) gaps.push('undirected');
  if (context.multigraph === true && !renderer.multigraph) gaps.push('multigraph');

  if (context.nodeCount !== undefined && context.nodeCount > renderer.maxComfortableNodes) {
    gaps.push('scale');
  }

  return gaps;
}
