/**
 * Analysis view-recipes (issue #31): named one-click *intents* that compose the building blocks
 * (#25 layout, #26 neighborhood, #27 filter, #28 aggregation, #29 centrality/community/critical-path)
 * into a single declarative {@link ViewSpec}. A recipe is a pure `params → ViewSpec` function — it
 * decides nothing about rendering; it just says "for *this* analytical question, lay it out *this*
 * way, request *these* overlays, size/colour by *that*". The app/renderer interprets the spec
 * (feed `layout` to graph-layout, `overlays` to `computeOverlays`, `style` to the node styling).
 *
 * Keeping recipes pure + declarative means they are trivially testable and renderer-agnostic — the
 * same spec drives sigma, react-flow, or a table. This is the top of the analysis stack: primitives
 * at the bottom, recipes as the curated intents on top.
 */

import type { GraphLayout, GraphFilter } from '@zodal/graph-core';
import type { OverlayRequest } from './overlays.js';
import type { CentralityKind } from './metrics.js';

/** A declarative description of how to render a graph for one analytical intent. */
export interface ViewSpec {
  /** Layout hint (algorithm + direction + params) — fed to `@zodal/graph-layout`. */
  layout: GraphLayout;
  /** Overlay layers to compute — fed to `computeOverlays`. */
  overlays?: OverlayRequest;
  /** A pre-render filter (fade/remove) — fed to `applyFilter`. */
  filter?: GraphFilter;
  /** Node-styling hints: size nodes by a centrality, colour by type or detected community. */
  style?: { sizeBy?: CentralityKind; colorBy?: 'type' | 'community' };
  /** Human-readable description of what the view shows. */
  note: string;
}

/** Inputs a recipe may use. `focus` is required by focus-based recipes (`needsFocus`). */
export interface RecipeParams {
  focus?: string;
  radius?: number;
}

/** A named analytical intent that builds a {@link ViewSpec}. */
export interface Recipe {
  id: string;
  label: string;
  description: string;
  /** True if the recipe needs a focus node (`buildView` returns null without one). */
  needsFocus: boolean;
  build: (params?: RecipeParams) => ViewSpec;
}

/** The built-in recipes. Each composes only the existing primitives — no new computation here. */
export const RECIPES: readonly Recipe[] = [
  {
    id: 'importance-map',
    label: 'Importance map',
    description: 'Size nodes by PageRank and highlight the most central; the “what matters most” view.',
    needsFocus: false,
    build: () => ({
      layout: { algorithm: 'circular' },
      style: { sizeBy: 'pagerank', colorBy: 'type' },
      overlays: { centrality: { kind: 'pagerank', topFraction: 0.1 } },
      note: 'Nodes sized by PageRank; the top 10% most-central nodes highlighted.',
    }),
  },
  {
    id: 'communities',
    label: 'Communities',
    description: 'Colour nodes by detected community (label propagation) to reveal clusters.',
    needsFocus: false,
    build: () => ({
      layout: { algorithm: 'circular' },
      style: { colorBy: 'community' },
      overlays: { community: true },
      note: 'Nodes coloured by detected community.',
    }),
  },
  {
    id: 'results-chain',
    label: 'Results chain',
    description: 'The impact → outcome → output → activity chain, laid out left-to-right by level.',
    needsFocus: false,
    build: () => ({
      layout: { algorithm: 'hierarchical', direction: 'LR' },
      style: { colorBy: 'type' },
      note: 'Layered results chain, left to right.',
    }),
  },
  {
    id: 'critical-path',
    label: 'Critical path',
    description: 'Highlight the longest dependency path through the graph.',
    needsFocus: false,
    build: () => ({
      layout: { algorithm: 'hierarchical', direction: 'LR' },
      style: { colorBy: 'type' },
      overlays: { criticalPath: true },
      note: 'The longest dependency (critical) path highlighted.',
    }),
  },
  {
    id: 'trace-lineage',
    label: 'Trace lineage',
    description: 'Everything upstream and downstream of a focused node (its full provenance chain).',
    needsFocus: true,
    build: (p) => {
      const focus = p?.focus;
      if (!focus) throw new Error('recipe "trace-lineage" requires a focus node (params.focus)');
      return {
        layout: { algorithm: 'hierarchical', direction: 'LR' },
        overlays: { ancestorsOf: focus, descendantsOf: focus },
        note: 'Ancestors and descendants of the focused node.',
      };
    },
  },
  {
    id: 'ego-network',
    label: 'Ego network',
    description: 'The k-hop neighbourhood around a focused node, with per-hop distance bands.',
    needsFocus: true,
    build: (p) => {
      const focus = p?.focus;
      if (!focus) throw new Error('recipe "ego-network" requires a focus node (params.focus)');
      const radius = p?.radius ?? 2;
      return {
        layout: { algorithm: 'radial', params: { focus: [focus] } },
        overlays: { neighborhood: { focus: [focus], radius, direction: 'both' } },
        note: `${radius}-hop neighbourhood around the focused node.`,
      };
    },
  },
];

/** Look up a recipe by id. */
export function recipe(id: string): Recipe | undefined {
  return RECIPES.find((r) => r.id === id);
}

/**
 * Build the {@link ViewSpec} for a recipe. Returns null for an unknown id, or for a focus-based
 * recipe invoked without a `focus` param (so callers can refuse cleanly rather than render garbage).
 */
export function buildView(id: string, params?: RecipeParams): ViewSpec | null {
  const r = recipe(id);
  if (!r) return null;
  if (r.needsFocus && !params?.focus) return null;
  return r.build(params);
}
