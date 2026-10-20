/**
 * The shared view state every lens reads and writes — the bridge that makes linked views (brushing)
 * work across node-link, table, matrix, timeline and form lenses.
 *
 * One serializable object holds what the lenses share: the `activeView` (the `GraphView` enum, so a
 * switch is one field and everything else survives it), the `selection` (`GraphSelection`: a table's
 * selected rows ARE `selection.nodes`), the `filters` (one `GraphFilter` per owning lens or control;
 * an element is kept only when EVERY owner keeps it — crossfilter-style, so a timeline brush and a
 * facet filter compose instead of overwriting each other), and the `hovered` element.
 *
 * Three layers, each usable alone:
 *  - pure transitions (`setActiveView`, `setSelection`, `setFilter`, …) that return a new state, or
 *    the SAME object when nothing changed (so a host's equality check skips the re-render);
 *  - pure projections (`linkedFilterResult`, `linkedOverlays`) that turn the state into what a lens
 *    draws — `linkedOverlays` is the `GraphOverlays` a node-link renderer already consumes;
 *  - `createGraphViewStore`, a framework-free subscribable store over those transitions
 *    (`getState` + `subscribe` plug into React's `useSyncExternalStore`).
 *
 * Headless: plain data in, plain data out; no DOM, no React.
 */

import type {
  CanonicalGraph,
  GraphCapabilities,
  GraphFilter,
  GraphOverlays,
  GraphSelection,
  GraphView,
  OverlayLayer,
} from '@zodal/graph-core';
import { applyFilter as computeFilter } from '@zodal/graph-compute';
import type { FilterResult } from '@zodal/graph-compute';

/** The element under the pointer (or keyboard focus) in any lens. */
export interface GraphHover {
  kind: 'node' | 'edge';
  id: string;
}

/** The state every lens shares. Serializable; keyed by canonical node/edge ids. */
export interface GraphViewState {
  /** The lens currently shown (a view-switch changes only this field). */
  activeView: GraphView;
  /** The shared selection: table rows, node-link picks and matrix bands all read and write it. */
  selection: GraphSelection;
  /** Active filters by owner (a lens id such as `'timeline'`, or a control such as `'facet:type'`).
   *  An element is kept only when every owner keeps it ({@link linkedFilterResult}). */
  filters: Record<string, GraphFilter>;
  /** The hovered element, or null. */
  hovered: GraphHover | null;
}

/** Initial shared state: the graph's first declared view (or `'table'`), nothing selected, filtered
 *  or hovered. `overrides` replaces any field. */
export function initGraphViewState(
  capabilities?: Pick<GraphCapabilities, 'views'>,
  overrides: Partial<GraphViewState> = {},
): GraphViewState {
  return {
    activeView: capabilities?.views[0] ?? 'table',
    selection: { nodes: [], edges: [] },
    filters: {},
    hovered: null,
    ...overrides,
  };
}

// --- equality (structural, for the no-op guard) ------------------------------------------------

const sameList = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((x, i) => x === b[i]);

const sameSelection = (a: GraphSelection, b: GraphSelection): boolean =>
  a.name === b.name && sameList(a.nodes, b.nodes) && sameList(a.edges, b.edges);

/** JSON with object keys sorted, so key order does not make equal filters look different. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : v,
  );
}

/** Filters are plain serializable data, so a key-sorted JSON is a sound structural key. */
const sameFilter = (a: GraphFilter | undefined, b: GraphFilter | undefined): boolean =>
  a === b || (a !== undefined && b !== undefined && stableJson(a) === stableJson(b));

const sameHover = (a: GraphHover | null, b: GraphHover | null): boolean =>
  a === b || (a !== null && b !== null && a.kind === b.kind && a.id === b.id);

// --- pure transitions --------------------------------------------------------------------------

/** Switch the active lens. With `capabilities`, a view the graph does not declare is refused (the
 *  state is returned unchanged). Selection, filters and hover survive the switch. */
export function setActiveView(
  state: GraphViewState,
  view: GraphView,
  capabilities?: Pick<GraphCapabilities, 'views'>,
): GraphViewState {
  if (state.activeView === view) return state;
  if (capabilities && !capabilities.views.includes(view)) return state;
  return { ...state, activeView: view };
}

/** Replace the shared selection. A partial selection leaves the omitted ids as they were: selecting
 *  table rows of nodes does not drop selected edges unless `edges` is given. A `name` labels its
 *  contents, so new ids without a `name` drop the old one. */
export function setSelection(state: GraphViewState, selection: Partial<GraphSelection>): GraphViewState {
  const idsChanged = selection.nodes !== undefined || selection.edges !== undefined;
  const name = 'name' in selection ? selection.name : idsChanged ? undefined : state.selection.name;
  const next: GraphSelection = {
    nodes: [...(selection.nodes ?? state.selection.nodes)],
    edges: [...(selection.edges ?? state.selection.edges)],
    ...(name !== undefined ? { name } : {}),
  };
  return sameSelection(state.selection, next) ? state : { ...state, selection: next };
}

/** Clear the shared selection. */
export function clearSelection(state: GraphViewState): GraphViewState {
  return setSelection(state, { nodes: [], edges: [], name: undefined });
}

/** Set (or, with `null`, remove) the filter owned by `owner`. Other owners' filters are kept. The
 *  filter is copied in, so mutating the caller's object later does not change the state silently. */
export function setFilter(state: GraphViewState, owner: string, filter: GraphFilter | null): GraphViewState {
  if (filter === null) {
    if (!(owner in state.filters)) return state;
    const { [owner]: _removed, ...rest } = state.filters;
    return { ...state, filters: rest };
  }
  if (sameFilter(state.filters[owner], filter)) return state;
  return { ...state, filters: { ...state.filters, [owner]: JSON.parse(JSON.stringify(filter)) as GraphFilter } };
}

/** Remove every filter. */
export function clearFilters(state: GraphViewState): GraphViewState {
  return Object.keys(state.filters).length === 0 ? state : { ...state, filters: {} };
}

/**
 * The selection a click on `element` makes, the same in every lens: a plain click selects that one
 * element alone (dropping every other node and edge), an `additive` click (shift, by convention)
 * toggles it in or out and keeps the rest. Pass the result to `setSelection`.
 */
export function pickSelection(selection: GraphSelection, element: GraphHover, additive = false): GraphSelection {
  const key = element.kind === 'node' ? 'nodes' : 'edges';
  if (!additive) {
    return { nodes: key === 'nodes' ? [element.id] : [], edges: key === 'edges' ? [element.id] : [] };
  }
  const ids = selection[key];
  const toggled = ids.includes(element.id) ? ids.filter((id) => id !== element.id) : [...ids, element.id];
  return { nodes: key === 'nodes' ? toggled : [...selection.nodes], edges: key === 'edges' ? toggled : [...selection.edges] };
}

/** Set (or clear, with `null`) the hovered element. */
export function setHovered(state: GraphViewState, hovered: GraphHover | null): GraphViewState {
  return sameHover(state.hovered, hovered) ? state : { ...state, hovered: hovered && { kind: hovered.kind, id: hovered.id } };
}

// --- projections -------------------------------------------------------------------------------

/** How one owner's filter is applied to a graph — `applyFilter` from `@zodal/graph-compute` by default. */
export type ApplyFilter = (graph: CanonicalGraph, filter: GraphFilter) => FilterResult;

export interface LinkedOptions {
  /** Swap the filter engine (e.g. a columnar one for a huge graph). Default: graph-compute's. */
  applyFilter?: ApplyFilter;
}

/** What the shared filters leave of a graph: `selection` holds the ids every owner keeps, `hidden`
 *  the ids a `'hide'` owner removes, and `overlays` one `'filter'` layer dimming the ids only
 *  `'fade'` owners drop. */
export interface LinkedFilterResult extends FilterResult {
  hidden: GraphSelection;
}

/**
 * Apply every owner's filter to `graph` and combine them crossfilter-style: an element is kept only
 * when EVERY owner keeps it (each owner's own semantics hold, including edges induced by its matched
 * nodes). An element a `'hide'` owner drops is hidden — and so is an edge with a hidden endpoint; an
 * element only `'fade'` owners drop is dimmed. Null when nothing filters.
 */
export function linkedFilterResult(
  graph: CanonicalGraph,
  state: GraphViewState,
  options: LinkedOptions = {},
): LinkedFilterResult | null {
  const owners = Object.keys(state.filters).sort();
  if (owners.length === 0) return null;
  const apply = options.applyFilter ?? computeFilter;
  const keptNodes = new Set(graph.nodes.map((n) => n.id));
  const keptEdges = new Set(graph.edges.map((e) => e.id));
  const hiddenNodes = new Set<string>();
  const hiddenEdges = new Set<string>();
  for (const owner of owners) {
    const filter = state.filters[owner];
    const result = apply(graph, filter);
    const nodes = new Set(result.selection.nodes);
    const edges = new Set(result.selection.edges);
    const hides = filter.mode === 'hide';
    for (const n of graph.nodes) {
      if (nodes.has(n.id)) continue;
      keptNodes.delete(n.id);
      if (hides) hiddenNodes.add(n.id);
    }
    for (const e of graph.edges) {
      if (edges.has(e.id)) continue;
      keptEdges.delete(e.id);
      if (hides) hiddenEdges.add(e.id);
    }
  }
  for (const e of graph.edges) {
    if (hiddenNodes.has(e.source) || hiddenNodes.has(e.target)) {
      keptEdges.delete(e.id);
      hiddenEdges.add(e.id);
    }
  }

  const dimNodes: Record<string, string> = {};
  const dimEdges: Record<string, string> = {};
  for (const n of graph.nodes) if (!keptNodes.has(n.id) && !hiddenNodes.has(n.id)) dimNodes[n.id] = 'dimmed';
  for (const e of graph.edges) if (!keptEdges.has(e.id) && !hiddenEdges.has(e.id)) dimEdges[e.id] = 'dimmed';
  const overlays: GraphOverlays = { highlights: [] };
  if (Object.keys(dimNodes).length > 0 || Object.keys(dimEdges).length > 0) {
    overlays.highlights.push({ layer: 'filter', nodes: dimNodes, edges: dimEdges });
  }

  return {
    selection: { nodes: [...keptNodes], edges: [...keptEdges], name: 'filter' },
    hidden: { nodes: [...hiddenNodes], edges: [...hiddenEdges] },
    overlays,
    counts: { nodes: keptNodes.size, edges: keptEdges.size },
  };
}

/** The overlay role each kind of shared state is drawn with. */
export interface LinkedRoles {
  /** Default `'primary'`. */
  selected?: string;
  /** Default `'related'`. */
  hovered?: string;
}

/**
 * The shared state as `GraphOverlays`, ready for any node-link renderer: a `'filter'` layer that
 * dims what only `'fade'` owners drop, a `'selection'` layer (role `'primary'`), and a `'hover'`
 * layer (role `'related'`). Empty layers are omitted, so no state means no overlays.
 *
 * Overlays cannot remove elements: draw only what is not in `linkedFilterResult(...).hidden` when an
 * owner hides. Renderers resolve conflicts by role priority, so a selected node stays primary even
 * when hovered or dimmed (the selection is kept and marked, never pruned by a filter). A renderer
 * with a focus mode that fades every element without a role (graph-sigma's `dimUnhighlighted`)
 * should turn it off for these overlays, which already say what to dim.
 */
export function linkedOverlays(
  graph: CanonicalGraph,
  state: GraphViewState,
  options: LinkedOptions & { roles?: LinkedRoles } = {},
): GraphOverlays {
  const highlights: OverlayLayer[] = [];
  highlights.push(...(linkedFilterResult(graph, state, options)?.overlays.highlights ?? []));

  const selectedRole = options.roles?.selected ?? 'primary';
  const { nodes, edges } = state.selection;
  if (nodes.length > 0 || edges.length > 0) {
    highlights.push({
      layer: 'selection',
      nodes: Object.fromEntries(nodes.map((id) => [id, selectedRole])),
      edges: Object.fromEntries(edges.map((id) => [id, selectedRole])),
    });
  }

  if (state.hovered) {
    const role = options.roles?.hovered ?? 'related';
    const entry = { [state.hovered.id]: role };
    highlights.push(state.hovered.kind === 'node' ? { layer: 'hover', nodes: entry } : { layer: 'hover', nodes: {}, edges: entry });
  }
  return { highlights };
}

// --- the subscribable store --------------------------------------------------------------------

export type GraphViewListener = (state: GraphViewState, previous: GraphViewState) => void;

export interface GraphViewStore {
  getState(): GraphViewState;
  /** Subscribe to changes; returns the unsubscribe function. Not called for no-op updates. */
  subscribe(listener: GraphViewListener): () => void;
  setActiveView(view: GraphView): void;
  setSelection(selection: Partial<GraphSelection>): void;
  clearSelection(): void;
  setFilter(owner: string, filter: GraphFilter | null): void;
  clearFilters(): void;
  setHovered(hovered: GraphHover | null): void;
  /** Apply a click on `element` to the selection ({@link pickSelection}): select it alone, or with
   *  `additive` toggle it and keep the rest. */
  pick(element: GraphHover, additive?: boolean): void;
  /** Replace the whole state (e.g. restoring a saved view from a URL). Trusted as given: it is not
   *  copied or checked against `capabilities` — validate external input before calling it. */
  setState(state: GraphViewState): void;
}

export interface GraphViewStoreOptions {
  /** Starting state (default: {@link initGraphViewState} from `capabilities`). */
  initial?: GraphViewState;
  /** When given, `setActiveView` refuses views the graph does not declare. */
  capabilities?: Pick<GraphCapabilities, 'views'>;
  /** Called when a listener throws; the other listeners still run. Default: the error is dropped. */
  onListenerError?: (error: unknown) => void;
}

/** Create the shared view store every lens of one graph subscribes to. */
export function createGraphViewStore(options: GraphViewStoreOptions = {}): GraphViewStore {
  let state = options.initial ?? initGraphViewState(options.capabilities);
  const listeners = new Set<GraphViewListener>();

  const commit = (next: GraphViewState): void => {
    if (next === state) return;
    const previous = state;
    state = next;
    for (const listener of [...listeners]) {
      try {
        listener(state, previous);
      } catch (error) {
        options.onListenerError?.(error);
      }
    }
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    setActiveView: (view) => commit(setActiveView(state, view, options.capabilities)),
    setSelection: (selection) => commit(setSelection(state, selection)),
    clearSelection: () => commit(clearSelection(state)),
    setFilter: (owner, filter) => commit(setFilter(state, owner, filter)),
    clearFilters: () => commit(clearFilters(state)),
    setHovered: (hovered) => commit(setHovered(state, hovered)),
    pick: (element, additive = false) => commit(setSelection(state, pickSelection(state.selection, element, additive))),
    setState: (next) => commit(next),
  };
}
