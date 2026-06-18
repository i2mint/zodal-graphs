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
import { INELIGIBLE } from './priority.js';

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

interface Scored<T> {
  entry: GraphRendererEntry<T>;
  score: number;
  degraded: CapabilityGap[];
}

/**
 * Create a fresh, user-owned renderer registry (not a global singleton).
 *
 * Testers MUST be pure: `resolve`, `select`, and `explain` all derive from one `rank()` pass over
 * the same `(graph, context)` inputs, so their winners agree by construction.
 */
export function createGraphRendererRegistry<T>(): GraphRendererRegistry<T> {
  const entries: GraphRendererEntry<T>[] = [];

  /** Score & gap every entry once, sorted by score desc. `Array.sort` is stable → ties keep
   *  registration order (the documented tiebreaker). Ineligible entries carry an empty degrade. */
  function rank(graph: GraphCapabilities, context: GraphRenderContext): Scored<T>[] {
    return entries
      .map((entry) => {
        const score = entry.tester(graph, context);
        const degraded = score > INELIGIBLE ? computeGaps(graph, entry.capabilities, context) : [];
        return { entry, score, degraded };
      })
      .sort((a, b) => b.score - a.score);
  }

  /** The top-ranked entry, or null if none is eligible (score must be strictly above INELIGIBLE). */
  function winner(graph: GraphCapabilities, context: GraphRenderContext): Scored<T> | null {
    const top = rank(graph, context)[0];
    return top && top.score > INELIGIBLE ? top : null;
  }

  return {
    get entries() {
      // Defensive copy — callers can inspect but not mutate the registry's internal state
      // (preserves the open-closed "register only appends" invariant).
      return [...entries];
    },

    register(entry) {
      entries.push(entry);
    },

    resolve(graph, context = EMPTY_CONTEXT) {
      return winner(graph, context)?.entry.renderer ?? null;
    },

    select(graph, context = EMPTY_CONTEXT) {
      const top = winner(graph, context);
      if (!top) return null;
      return {
        renderer: top.entry.renderer,
        capabilities: top.entry.capabilities,
        name: top.entry.name,
        score: top.score,
        degraded: top.degraded,
      };
    },

    explain(graph, context = EMPTY_CONTEXT) {
      return rank(graph, context).map(({ entry, score, degraded }) => ({
        name: entry.name,
        score,
        degraded,
      }));
    },
  };
}
