/**
 * The runtime context fed to renderer testers alongside the graph's declared capabilities.
 *
 * `GraphCapabilities` says what the graph *is*; the context says what's happening *now* — how
 * many nodes are actually in view, which view the user asked for, and what they're trying to do.
 * Testers gate and rank on both. The open index signature lets a host pass extra signals.
 */

import type { GraphView } from '@zodal/graph-core';

export interface GraphRenderContext {
  /** Number of nodes to render right now — drives scale eligibility (not the declared scaleClass). */
  nodeCount?: number;
  /** Which lens the user is asking for. */
  view?: GraphView;
  /** What the user is trying to do — sharpens editor-vs-viewer ranking. */
  intent?: 'edit' | 'explore' | 'view';
  /** Structural fact of the instance being rendered (topology, not a declared capability).
   *  Defaults to directed when unset. */
  directed?: boolean;
  /** Structural fact of the instance being rendered (parallel edges present). */
  multigraph?: boolean;
  /** Extra host-supplied signals. */
  [key: string]: unknown;
}
