/**
 * Composable tester authoring.
 *
 * A `GraphRendererTester` maps `(graph capabilities, runtime context) → score`. Rather than hand-
 * write the scoring arithmetic for every renderer, author one declaratively with {@link makeTester}:
 * a hard **eligibility** gate (return `INELIGIBLE` when the renderer genuinely cannot render the
 * graph), a **base** band, and additive **bonus** bands for capabilities the renderer is
 * specialized for. Predicates compose via {@link allOf} / {@link anyOf} / {@link not}.
 *
 * Eligibility is for true impossibility only — the rank-and-degrade philosophy prefers rendering
 * with a reported gap over rendering nothing (see `gaps.ts`).
 */

import type { GraphCapabilities, GraphView } from '@zodal/graph-core';
import type { GraphRenderContext } from './context.js';
import { PRIORITY, INELIGIBLE, type Priority } from './priority.js';

export type GraphRendererTester = (graph: GraphCapabilities, context: GraphRenderContext) => number;

export type GraphPredicate = (graph: GraphCapabilities, context: GraphRenderContext) => boolean;

// === predicates ===========================================================

export const isTypedPortGraph: GraphPredicate = (g) => g.typedPorts;
export const isExecutable: GraphPredicate = (g) => g.executable;
export const watchesValues: GraphPredicate = (g) => g.watchesValues;
export const hasProvenance: GraphPredicate = (g) => g.hasProvenance;
export const hasIntervals: GraphPredicate = (g) => g.hasIntervals;

export const wantsEditing: GraphPredicate = (g, ctx) => {
  if (ctx.intent === 'edit') return true;
  if (ctx.intent === 'view' || ctx.intent === 'explore') return false;
  return g.canEditNode || g.canAddNode || g.canAddEdge;
};

/** True when the live node count is at most `n` (or unknown — unknown does not disqualify). */
export const scaleAtMost = (n: number): GraphPredicate => (_g, ctx) =>
  ctx.nodeCount === undefined || ctx.nodeCount <= n;

/** True when the live node count is known and at least `n`. */
export const scaleAtLeast = (n: number): GraphPredicate => (_g, ctx) =>
  ctx.nodeCount !== undefined && ctx.nodeCount >= n;

/** True when the requested view is `v` (or no view was requested) — for ELIGIBILITY gates. */
export const viewIs = (v: GraphView): GraphPredicate => (_g, ctx) =>
  ctx.view === undefined || ctx.view === v;

/** True only when the view was EXPLICITLY requested as `v` — for bonuses ("user asked for me"). */
export const viewRequested = (v: GraphView): GraphPredicate => (_g, ctx) => ctx.view === v;

/** True when the graph declares `v` among its supported views. */
export const supportsView = (v: GraphView): GraphPredicate => (g) => g.views.includes(v);

// === predicate combinators ================================================

export const allOf = (...ps: GraphPredicate[]): GraphPredicate => (g, ctx) => ps.every((p) => p(g, ctx));
export const anyOf = (...ps: GraphPredicate[]): GraphPredicate => (g, ctx) => ps.some((p) => p(g, ctx));
export const not = (p: GraphPredicate): GraphPredicate => (g, ctx) => !p(g, ctx);

// === tester factory =======================================================

export interface TesterSpec {
  /** Hard gate: if present and false, the renderer opts out entirely (`INELIGIBLE`). */
  eligible?: GraphPredicate;
  /** Score when eligible, before bonuses. A named {@link Priority} band; defaults to `DEFAULT`. */
  base?: Priority;
  /** Additive {@link Priority} band for each predicate that holds — specialization raises the score. */
  bonuses?: Array<[GraphPredicate, Priority]>;
}

/** Build a {@link GraphRendererTester} from an eligibility gate + base band + additive bonuses. */
export function makeTester(spec: TesterSpec): GraphRendererTester {
  const base = spec.base ?? PRIORITY.DEFAULT;
  const bonuses = spec.bonuses ?? [];
  return (graph, context) => {
    if (spec.eligible && !spec.eligible(graph, context)) return INELIGIBLE;
    let score = base;
    for (const [predicate, band] of bonuses) {
      if (predicate(graph, context)) score += band;
    }
    return score;
  };
}
