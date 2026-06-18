/**
 * View switching — letting the user move the SAME graph between table / matrix / node-link / form
 * lenses while selection and filters are shared by construction.
 *
 * The key idea (from the research): view switching is a single field over one shared state, so
 * everything else (selection, filters) survives the switch. These pure helpers model that field;
 * a host stores the rest of the state alongside `activeView`.
 */

import type { GraphCapabilities, GraphView } from '@zodal/graph-core';

export interface ViewState {
  activeView: GraphView;
}

/** The views this graph supports, per its declared capabilities. */
export function availableViews(capabilities: GraphCapabilities): GraphView[] {
  return capabilities.views;
}

/** Initial view state — the graph's first declared view (or `table` as the universal fallback). */
export function initViewState(capabilities: GraphCapabilities): ViewState {
  return { activeView: capabilities.views[0] ?? 'table' };
}

/** Pure setter: switch the active view, preserving every other field of `state`. */
export function switchView<S extends ViewState>(state: S, view: GraphView): S {
  return { ...state, activeView: view };
}

/** Is `view` available for this graph? */
export function canSwitchTo(capabilities: GraphCapabilities, view: GraphView): boolean {
  return capabilities.views.includes(view);
}
