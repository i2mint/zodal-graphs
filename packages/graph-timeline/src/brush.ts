/**
 * Timeline → shared-filter brushing. A brushed time window on the timeline lens becomes a
 * `GraphFilter` that every other lens honours through the shared view state (`@zodal/graph-ui`'s
 * `store.setFilter('timeline', brushFilter(model, window))`): the node-link view dims (or hides) the
 * annotations outside the window, the table drops their rows.
 *
 * The filter is plain, serializable data, so it travels with the view state (URL, saved scene) like
 * any other filter. It takes one of two forms:
 *
 * - **range** (plain numeric times, no `relations`): numeric predicates over `data.start`/`data.end`
 *   that encode the half-open overlap test. Small, and it stays correct when the graph gains nodes.
 * - **ids** (Allen `relations`, `{ v, r }` rational times, or `form: 'ids'`): an `id in [...]`
 *   snapshot of the model's annotations. Rebuild it when the graph changes (a node added later
 *   counts as untimed). graph-compute evaluates `in` lists as Sets, so a long brush costs O(1) per
 *   element.
 */

import type { FilterPredicate, GraphFilter } from '@zodal/graph-core';
import type { AllenRelation, Interval } from './interval.js';
import { isInstant } from './interval.js';
import { annotationsInWindow, annotationsRelated, type TimelineModel } from './timeline.js';

export interface BrushFilterOptions {
  /** Keep annotations related to the window by one of these Allen relations, instead of every
   *  annotation that overlaps it (e.g. `WITHIN` keeps only those inside the window). */
  relations?: readonly AllenRelation[];
  /** Keep the nodes that carry no interval (entities the timeline does not show). Default `true`:
   *  a brush narrows time, it does not remove the rest of the graph. */
  keepUntimed?: boolean;
  /** `'fade'` (default) dims what falls outside the window; `'hide'` removes it. */
  mode?: GraphFilter['mode'];
  /** `'auto'` (default) emits `data.start`/`data.end` range predicates when the times are plain
   *  numbers (`model.numericTimes`, a window with integer resolution) and no `relations` are given,
   *  else an id snapshot; `'ids'` always emits the id snapshot. */
  form?: 'auto' | 'ids';
}

/** The data fields an annotation's interval is read from (see `toTimeline`). */
const TIER = 'data.tier';
const START = 'data.start';
const END = 'data.end';

/** The ids of the annotations a brushed window keeps. */
export function brushedIds(model: TimelineModel, window: Interval, options: Pick<BrushFilterOptions, 'relations'> = {}): string[] {
  const kept = options.relations ? annotationsRelated(model, window, options.relations) : annotationsInWindow(model, window);
  return kept.map((a) => a.id);
}

/** The `GraphFilter` for a brushed window: the annotations it keeps (plus, by default, every node
 *  that has no interval). Edges are induced by the kept nodes. */
export function brushFilter(model: TimelineModel, window: Interval, options: BrushFilterOptions = {}): GraphFilter {
  const range = (options.form ?? 'auto') === 'auto' && !options.relations && numericWindow(model, window);
  const inWindow: FilterPredicate = range
    ? rangePredicate(window.start.v, window.end.v, isInstant(window))
    : { field: 'id', op: 'in', value: brushedIds(model, window, options) };
  const untimed: FilterPredicate = range
    ? { not: { all: [TIER, START, END].map((field) => ({ field, op: 'exists' as const })) } }
    : { not: { field: 'id', op: 'in', value: model.annotations.map((a) => a.id) } };
  const nodes: FilterPredicate = options.keepUntimed === false ? inWindow : { any: [inWindow, untimed] };
  return { nodes, mode: options.mode ?? 'fade' };
}

/** Can the window be written as plain-number predicates without losing exactness? */
function numericWindow(model: TimelineModel, window: Interval): boolean {
  return model.numericTimes === true && window.start.r === 1 && window.end.r === 1;
}

/**
 * The half-open overlap test of `intersects` (`[s, e)` against the window `[ws, we)`) as predicates
 * over `data.start`/`data.end` (on nodes that carry a `data.tier`). A proper window keeps `s < we && e > ws`, plus an instant sitting on
 * the window's start (`s === e === ws`); an instant window `[t, t)` keeps `s <= t < e`, plus an
 * instant at `t`.
 */
function rangePredicate(ws: number, we: number, instantWindow: boolean): FilterPredicate {
  const overlap: FilterPredicate = instantWindow
    ? { all: [{ field: START, op: 'lte', value: ws }, { field: END, op: 'gt', value: ws }] }
    : { all: [{ field: START, op: 'lt', value: we }, { field: END, op: 'gt', value: ws }] };
  const instantAtStart: FilterPredicate = {
    all: [{ field: START, op: 'eq', value: ws }, { field: END, op: 'eq', value: ws }],
  };
  // `data.tier` too: toTimeline only counts a node with a tier as an annotation.
  return { all: [{ field: TIER, op: 'exists' }, { any: [overlap, instantAtStart] }] };
}
