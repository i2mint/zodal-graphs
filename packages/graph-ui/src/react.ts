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

import { useMemo, useSyncExternalStore } from 'react';
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

const noSubscribe = (): (() => void) => () => {};
const noState = (): undefined => undefined;

/** The current shared view state of `store`, re-rendering on every change. `undefined` when no
 *  store is given (a lens used standalone). */
export function useGraphView(store: GraphViewStore): GraphViewState;
export function useGraphView(store: GraphViewStore | undefined): GraphViewState | undefined;
export function useGraphView(store: GraphViewStore | undefined): GraphViewState | undefined {
  return useSyncExternalStore(store?.subscribe ?? noSubscribe, store?.getState ?? noState, store?.getState ?? noState);
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

/** Subscribe to `store` and project its state onto `graph`. `undefined` without a store. Pass a
 *  memoised `options` object (or none): a new identity each render recomputes the projection. */
export function useLinkedView(
  graph: CanonicalGraph,
  store: GraphViewStore | undefined,
  options?: UseLinkedViewOptions,
): LinkedView | undefined {
  const state = useGraphView(store);
  return useMemo(() => {
    if (!state) return undefined;
    const excluded = options?.excludeOwners ?? [];
    const filters =
      excluded.length === 0
        ? state.filters
        : Object.fromEntries(Object.entries(state.filters).filter(([owner]) => !excluded.includes(owner)));
    const scoped = filters === state.filters ? state : { ...state, filters };
    const filter = linkedFilterResult(graph, scoped, options);
    return {
      state,
      filter,
      kept: filter ? { nodes: new Set(filter.selection.nodes), edges: new Set(filter.selection.edges) } : undefined,
      hidden: filter ? { nodes: new Set(filter.hidden.nodes), edges: new Set(filter.hidden.edges) } : EMPTY_HIDDEN,
      overlays: linkedOverlays(graph, scoped, options),
    };
  }, [graph, state, options]);
}
