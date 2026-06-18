/**
 * The renderer registry — capability-ranked selection with honest rank-and-degrade.
 *
 * `createGraphRendererRegistry<T>()` is a factory (no class, no forced global singleton): it
 * closes over a private list of entries. `register` only appends, so adding a renderer never
 * edits an existing one (open-closed). `resolve`/`select` run EVERY tester against the
 * `(graph capabilities, context)` pair and keep the single highest score; ties resolve to the
 * first-registered entry. `select` additionally reports the capability gaps the winner can't
 * honor (degrade). `explain` returns the full ranking for debugging *why* a renderer won.
 *
 * The registry is generic over the renderer payload type `T` (e.g. a React component) and never
 * inspects it — `@zodal/graph-ui` stays headless. This single registry serves both the "renders"
 * and the "schema↔render mappings" concerns: the mappings ARE the testers registered here.
 */

import type { GraphCapabilities, RendererCapabilities } from '@zodal/graph-core';
import type { GraphRenderContext } from './context.js';
import type { GraphRendererTester } from './testers.js';
import { computeGaps, type CapabilityGap } from './gaps.js';

/** One registered renderer: its tester (the schema↔render mapping), the payload, and its honest capabilities. */
export interface GraphRendererEntry<T> {
  tester: GraphRendererTester;
  renderer: T;
  capabilities: RendererCapabilities;
  name?: string;
}

/** The outcome of selection: the winning renderer plus what it cannot honor for this graph. */
export interface GraphRenderSelection<T> {
  renderer: T;
  capabilities: RendererCapabilities;
  name?: string;
  score: number;
  /** Capabilities the graph wants that the chosen renderer can't provide (empty = clean match). */
  degraded: CapabilityGap[];
}

/** One row of the ranking, for `explain`. */
export interface RankedRenderer {
  name?: string;
  score: number;
  degraded: CapabilityGap[];
}

export interface GraphRendererRegistry<T> {
  readonly entries: ReadonlyArray<GraphRendererEntry<T>>;
  register(entry: GraphRendererEntry<T>): void;
  /** The winning renderer payload, or `null` if nothing is eligible. */
  resolve(graph: GraphCapabilities, context?: GraphRenderContext): T | null;
  /** The winning renderer with its degrade report, or `null` if nothing is eligible. */
  select(graph: GraphCapabilities, context?: GraphRenderContext): GraphRenderSelection<T> | null;
  /** Every entry ranked by score (desc), for debugging which renderer won and why. */
  explain(graph: GraphCapabilities, context?: GraphRenderContext): RankedRenderer[];
}

const EMPTY_CONTEXT: GraphRenderContext = {};

/** Create a fresh, user-owned renderer registry (not a global singleton). */
export function createGraphRendererRegistry<T>(): GraphRendererRegistry<T> {
  const entries: GraphRendererEntry<T>[] = [];

  function best(
    graph: GraphCapabilities,
    context: GraphRenderContext,
  ): { entry: GraphRendererEntry<T>; score: number } | null {
    let bestEntry: GraphRendererEntry<T> | null = null;
    let bestScore = -1;
    for (const entry of entries) {
      const score = entry.tester(graph, context);
      // Strict `>` → on a tie the FIRST-registered entry wins (documented tiebreaker).
      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }
    return bestEntry && bestScore > -1 ? { entry: bestEntry, score: bestScore } : null;
  }

  return {
    get entries() {
      return entries;
    },

    register(entry) {
      entries.push(entry);
    },

    resolve(graph, context = EMPTY_CONTEXT) {
      return best(graph, context)?.entry.renderer ?? null;
    },

    select(graph, context = EMPTY_CONTEXT) {
      const found = best(graph, context);
      if (!found) return null;
      const { entry, score } = found;
      return {
        renderer: entry.renderer,
        capabilities: entry.capabilities,
        name: entry.name,
        score,
        degraded: computeGaps(graph, entry.capabilities, context),
      };
    },

    explain(graph, context = EMPTY_CONTEXT) {
      return entries
        .map((entry) => ({
          name: entry.name,
          score: entry.tester(graph, context),
          degraded: computeGaps(graph, entry.capabilities, context),
        }))
        .sort((a, b) => b.score - a.score);
    },
  };
}
