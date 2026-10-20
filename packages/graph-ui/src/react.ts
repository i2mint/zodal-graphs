/**
 * @zodal/graph-ui/react — the React side of the shared view state: one subscription hook every lens
 * uses, so no lens re-implements the store subscription.
 *
 * `useGraphView(store)` reads a {@link GraphViewStore} through React's `useSyncExternalStore`, so a
 * lens re-renders exactly when the shared state changes (the store skips no-op updates, so an
 * unchanged selection does not re-render anything). Pass `undefined` when a lens is used without a
 * store: the hook then returns `undefined` and never subscribes, which keeps the hook call
 * unconditional.
 *
 * `useLinkedView(graph, store)` adds what a lens draws from that state, memoised on the graph and
 * state: the combined filter result (`kept` / `hidden` id sets) for tables and timelines, and the
 * `linkedOverlays` a node-link renderer consumes.
 *
 * `react` is an optional peer dependency of `@zodal/graph-ui`: only this entry imports it.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { CanonicalGraph, GraphOverlays } from '@zodal/graph-core';
import {
  linkedFilterResult,
  linkedOverlays,
  type GraphViewState,
  type GraphViewStore,
  type LinkedFilterResult,
  type LinkedOptions,
  type LinkedRoles,
} from './view-state.js';

const whole = (state: GraphViewState): GraphViewState => state;

/** The current shared view state of `store`, re-rendering on every change. `undefined` when no
 *  store is given (a lens used standalone). With a `selector`, only that slice is read and the
 *  component re-renders only when the slice changes (by `Object.is`): select an existing field such
 *  as `(s) => s.selection`, never a freshly built object. */
export function useGraphView(store: GraphViewStore): GraphViewState;
export function useGraphView(store: GraphViewStore | undefined): GraphViewState | undefined;
export function useGraphView<T>(store: GraphViewStore, selector: (state: GraphViewState) => T): T;
export function useGraphView<T>(store: GraphViewStore | undefined, selector: (state: GraphViewState) => T): T | undefined;
export function useGraphView<T>(
  store: GraphViewStore | undefined,
  selector: (state: GraphViewState) => T = whole as (state: GraphViewState) => T,
): T | undefined {
  // Called through the store (not detached), so a custom store whose methods use `this` works.
  const subscribe = useCallback((onChange: () => void) => (store ? store.subscribe(onChange) : () => {}), [store]);
  const snapshot = () => (store ? selector(store.getState()) : undefined);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

/** What a lens draws from the shared state (see {@link useLinkedView}). */
export interface LinkedView {
  state: GraphViewState;
  /** The combined filter (null when nothing filters). */
  filter: LinkedFilterResult | null;
  /** Ids every filter owner keeps; `undefined` when nothing filters (everything is kept). */
  kept: { nodes: ReadonlySet<string>; edges: ReadonlySet<string> } | undefined;
  /** Ids a `'hide'` owner removes: do not draw them. Empty when nothing hides. */
  hidden: { nodes: ReadonlySet<string>; edges: ReadonlySet<string> };
  /** The shared state as overlays for a node-link renderer. */
  overlays: GraphOverlays;
}

export interface UseLinkedViewOptions extends LinkedOptions {
  /** Overlay roles for the selection and hover layers (see `linkedOverlays`). */
  roles?: LinkedRoles;
  /** Leave these filter owners out (crossfilter style: a timeline does not dim itself with the
   *  window it brushed). */
  excludeOwners?: readonly string[];
}

const EMPTY_HIDDEN = { nodes: new Set<string>(), edges: new Set<string>() };

/** Subscribe to `store` and project its state onto `graph`. `undefined` without a store. The
 *  projection is recomputed when the graph, the state, or an option's value changes (an inline
 *  `options` object is fine; pass a stable `applyFilter` function). */
export function useLinkedView(
  graph: CanonicalGraph,
  store: GraphViewStore | undefined,
  options?: UseLinkedViewOptions,
): LinkedView | undefined {
  const state = useGraphView(store);
  const excludedKey = JSON.stringify(options?.excludeOwners ?? []);
  const { applyFilter } = options ?? {};
  const selectedRole = options?.roles?.selected;
  const hoveredRole = options?.roles?.hovered;
  return useMemo(() => {
    if (!state) return undefined;
    const excluded = JSON.parse(excludedKey) as string[];
    const projection = { applyFilter, roles: { selected: selectedRole, hovered: hoveredRole } };
    const filters =
      excluded.length === 0
        ? state.filters
        : Object.fromEntries(Object.entries(state.filters).filter(([owner]) => !excluded.includes(owner)));
    const scoped = filters === state.filters ? state : { ...state, filters };
    const filter = linkedFilterResult(graph, scoped, projection);
    return {
      state,
      filter,
      kept: filter ? { nodes: new Set(filter.selection.nodes), edges: new Set(filter.selection.edges) } : undefined,
      hidden: filter ? { nodes: new Set(filter.hidden.nodes), edges: new Set(filter.hidden.edges) } : EMPTY_HIDDEN,
      overlays: linkedOverlays(graph, scoped, projection),
    };
  }, [graph, state, excludedKey, applyFilter, selectedRole, hoveredRole]);
}
