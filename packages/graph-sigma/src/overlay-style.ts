/**
 * Overlay → sigma styling — the renderer-agnostic-overlay drawing bridge, fully headless.
 *
 * `@zodal/graph-compute` emits a `GraphOverlays` block of `{nodeId/edgeId → role}` layers, computed
 * once and drawn on any renderer. These pure functions turn that into per-node / per-edge style
 * (color, highlighted, hidden) for sigma's node/edge reducers: highlighted elements take a
 * role color, and — in focus mode — everything else dims. No sigma or React import.
 */

import type { GraphOverlays, HighlightRole } from '@zodal/graph-core';

export interface OverlayNodeStyle {
  color?: string;
  highlighted?: boolean;
  zIndex?: number;
}

export interface OverlayEdgeStyle {
  color?: string;
  hidden?: boolean;
  zIndex?: number;
}

export interface OverlayStyleOptions {
  /** Per-role color override; merged over the defaults. */
  roleColors?: Record<string, string>;
  /** Categorical palette for `component:N` roles. */
  componentPalette?: string[];
  /** When any overlay is active, dim elements that are NOT highlighted. Default `true`. */
  dimUnhighlighted?: boolean;
  /** The dim color. */
  dimColor?: string;
}

const DEFAULT_ROLE_COLORS: Record<string, string> = {
  primary: '#e8590c',
  related: '#1c7ed6',
  ancestor: '#1c7ed6',
  descendant: '#2f9e44',
  path: '#f08c00',
  stale: '#e03131',
  dimmed: '#ced4da',
};
const DEFAULT_PALETTE = ['#1c7ed6', '#2f9e44', '#e8590c', '#ae3ec9', '#0c8599', '#e03131', '#f08c00', '#5f3dc4'];
const DEFAULT_DIM = '#dee2e6';

/** Resolve the color for a role, handling `component:N` categorical roles. */
function colorForRole(role: HighlightRole, colors: Record<string, string>, palette: string[]): string {
  const text = String(role);
  if (text.startsWith('component:')) {
    const index = Number.parseInt(text.slice('component:'.length), 10);
    return palette[Number.isFinite(index) ? index % palette.length : 0];
  }
  return colors[text] ?? colors.primary;
}

/** Collapse all overlay layers into a single id→role map (later layers win on conflict). */
function rolesByNode(overlays: GraphOverlays): Map<string, HighlightRole> {
  const map = new Map<string, HighlightRole>();
  for (const layer of overlays.highlights) {
    for (const [id, role] of Object.entries(layer.nodes)) map.set(id, role);
  }
  return map;
}

function rolesByEdge(overlays: GraphOverlays): Map<string, HighlightRole> {
  const map = new Map<string, HighlightRole>();
  for (const layer of overlays.highlights) {
    for (const [id, role] of Object.entries(layer.edges ?? {})) map.set(id, role);
  }
  return map;
}

/** Build a node styler from overlays. Returns `(nodeId) => style` for use as a sigma node reducer. */
export function nodeOverlayStyle(
  overlays: GraphOverlays,
  options: OverlayStyleOptions = {},
): (nodeId: string) => OverlayNodeStyle {
  const roles = rolesByNode(overlays);
  const active = roles.size > 0;
  const colors = { ...DEFAULT_ROLE_COLORS, ...options.roleColors };
  const palette = options.componentPalette ?? DEFAULT_PALETTE;
  const dim = options.dimUnhighlighted ?? true;
  const dimColor = options.dimColor ?? DEFAULT_DIM;

  return (nodeId) => {
    const role = roles.get(nodeId);
    if (role !== undefined) return { color: colorForRole(role, colors, palette), highlighted: true, zIndex: 1 };
    if (active && dim) return { color: dimColor, zIndex: 0 };
    return {};
  };
}

/** Build an edge styler from overlays. Returns `(edgeId) => style` for use as a sigma edge reducer. */
export function edgeOverlayStyle(
  overlays: GraphOverlays,
  options: OverlayStyleOptions = {},
): (edgeId: string) => OverlayEdgeStyle {
  const roles = rolesByEdge(overlays);
  const active = roles.size > 0;
  const colors = { ...DEFAULT_ROLE_COLORS, ...options.roleColors };
  const palette = options.componentPalette ?? DEFAULT_PALETTE;
  const dim = options.dimUnhighlighted ?? true;
  const dimColor = options.dimColor ?? DEFAULT_DIM;

  return (edgeId) => {
    const role = roles.get(edgeId);
    if (role !== undefined) return { color: colorForRole(role, colors, palette), zIndex: 1 };
    if (active && dim) return { color: dimColor, zIndex: 0 };
    return {};
  };
}
