/**
 * The presentation layer — overlays, styling, selection, and layout.
 *
 * Physically separate from topology (`model.ts`) and serializable on its own, keyed by
 * canonical node/edge ids. This is the layer that makes overlays *renderer-agnostic*: a
 * single `GraphOverlays` result (computed once by `@zodal/graph-compute`) is drawn as
 * highlights on whatever renderer is active. Renderer formats that fuse position/selection
 * into their node/edge objects (React Flow, Cytoscape) must strip that state back into this
 * layer on the way in, or round-trips drift.
 */

/** The visual role a node/edge plays in an overlay layer (drives color / ring / dim). */
export type HighlightRole =
  | 'primary'
  | 'related'
  | 'dimmed'
  | 'stale'
  | 'path'
  | 'ancestor'
  | 'descendant'
  | (string & {});

/** One overlay layer: a named set of node (and optional edge) highlight roles. */
export interface OverlayLayer {
  /** e.g. `'path'`, `'ancestors'`, `'stale'` — also the legend key. */
  layer: string;
  nodes: Record<string, HighlightRole>;
  edges?: Record<string, HighlightRole>;
}

/** All active overlays. The small-graph shape; huge-scale uses a columnar projection (P2/P3). */
export interface GraphOverlays {
  highlights: OverlayLayer[];
}

/** A named selection = a reusable scene/subgraph; drives `extract-subgraph`. */
export interface GraphSelection {
  nodes: string[];
  edges: string[];
  name?: string;
}

export type StyleChannel = 'color' | 'size' | 'shape' | 'opacity' | 'stroke';
export type ScaleKind = 'categorical' | 'linear' | 'threshold';

/** One styling rule: encode a field onto a visual channel via a scale. */
export interface StyleRule {
  target: 'node' | 'edge' | 'port';
  field: string;
  channel: StyleChannel;
  scale: { kind: ScaleKind; domain?: unknown[]; range: unknown[] };
}

export interface GraphStyling {
  rules: StyleRule[];
  legends?: Array<{ field: string; title?: string }>;
}

export type LayoutAlgorithm =
  | 'preset'
  | 'dagre'
  | 'elk'
  | 'force'
  | 'circular'
  | 'hierarchical'
  | 'radial'
  | 'swimlane';

/** A layout *hint*, not state — the renderer or a layout engine computes actual positions. */
export interface GraphLayout {
  algorithm: LayoutAlgorithm;
  params?: Record<string, unknown>;
  direction?: 'TB' | 'LR' | 'BT' | 'RL';
  /** Optional precomputed positions, keyed by node id. */
  positions?: Record<string, { x: number; y: number }>;
}

/** Empty presentation state — a convenient starting point. */
export const emptyOverlays = (): GraphOverlays => ({ highlights: [] });
export const emptySelection = (): GraphSelection => ({ nodes: [], edges: [] });
