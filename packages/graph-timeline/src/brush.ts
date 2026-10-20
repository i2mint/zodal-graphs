/**
 * Timeline → shared-filter brushing. A brushed time window on the timeline lens becomes a
 * `GraphFilter` that every other lens honours through the shared view state (`@zodal/graph-ui`'s
 * `store.setFilter('timeline', brushFilter(model, window))`): the node-link view dims (or hides) the
 * annotations outside the window, the table drops their rows.
 *
 * The filter is plain, serializable data (an `id in [...]` predicate), so it travels with the view
 * state (URL, saved scene) like any other filter.
 */

import type { FilterPredicate, GraphFilter } from '@zodal/graph-core';
import type { AllenRelation, Interval } from './interval.js';
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
}

/** The ids of the annotations a brushed window keeps. */
export function brushedIds(model: TimelineModel, window: Interval, options: Pick<BrushFilterOptions, 'relations'> = {}): string[] {
  const kept = options.relations ? annotationsRelated(model, window, options.relations) : annotationsInWindow(model, window);
  return kept.map((a) => a.id);
}

/** The `GraphFilter` for a brushed window: the annotations it keeps (plus, by default, every node
 *  that has no interval). Edges are induced by the kept nodes. */
export function brushFilter(model: TimelineModel, window: Interval, options: BrushFilterOptions = {}): GraphFilter {
  const inWindow: FilterPredicate = { field: 'id', op: 'in', value: brushedIds(model, window, options) };
  const nodes: FilterPredicate =
    options.keepUntimed === false
      ? inWindow
      : { any: [inWindow, { not: { field: 'id', op: 'in', value: model.annotations.map((a) => a.id) } }] };
  return { nodes, mode: options.mode ?? 'fade' };
}
