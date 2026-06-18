/**
 * Overlay → sigma styling — the renderer-agnostic-overlay drawing bridge, fully headless.
 *
 * `@zodal/graph-compute` emits a `GraphOverlays` block of `{nodeId/edgeId → role}` layers, computed
 * once and drawn on any renderer. These pure functions turn that into per-node / per-edge style
 * (color, highlighted, hidden) for sigma's node/edge reducers: highlighted elements take a role
 * color, and — in focus mode — everything else dims. No sigma or React import.
 *
 * Conflict resolution is by ROLE PRIORITY, not iteration order: when two layers assign a node
 * different roles, the more important one wins (`primary` > path > ancestor/descendant/stale >
 * `component:*` > `dimmed`), so a focal node keeps its focus color under a later structural layer.
 * "Focus mode" (dimming the rest) is decided once across BOTH node and edge roles, so a node-only
 * overlay still dims edges.
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
  /** The focus-dim color (distinct from the `dimmed` role color). */
  dimColor?: string;
  /** Color for an unrecognized role (NOT `primary`, so a typo'd role is visibly distinct). */
  unknownColor?: string;
}

const DEFAULT_ROLE_COLORS: Record<string, string> = {
  primary: '#e8590c',
  related: '#1c7ed6',
  ancestor: '#1c7ed6',
  descendant: '#2f9e44',
  path: '#f08c00',
  stale: '#e03131',
  dimmed: '#adb5bd', // a deliberate "dimmed" role — medium gray, distinct from the faint focus-dim
};
const DEFAULT_PALETTE = ['#1c7ed6', '#2f9e44', '#e8590c', '#ae3ec9', '#0c8599', '#e03131', '#f08c00', '#5f3dc4'];
const DEFAULT_DIM = '#e9ecef'; // focus-dim — faint, clearly lighter than the `dimmed` role
const DEFAULT_UNKNOWN = '#868e96';

/** Role importance for conflict resolution (higher wins). */
const ROLE_PRIORITY: Record<string, number> = {
  primary: 100,
  path: 80,
  stale: 70,
  ancestor: 60,
  descendant: 60,
  related: 50,
  dimmed: 0,
};

function rolePriority(role: string): number {
  if (role.startsWith('component:')) return 30;
  return ROLE_PRIORITY[role] ?? 40; // unknown roles: mid priority
}

/** Palette index for a `component:N` role — only clean non-negative integers map by index. */
function componentIndex(text: string, length: number): number {
  const raw = text.slice('component:'.length);
  if (!/^\d+$/.test(raw)) return 0;
  return Number.parseInt(raw, 10) % length;
}

function colorForRole(role: HighlightRole, colors: Record<string, string>, palette: string[], unknown: string): string {
  const text = String(role);
  if (text.startsWith('component:')) return palette[componentIndex(text, palette.length)];
  return colors[text] ?? unknown;
}

/** Collapse all layers into one id→role map, keeping the highest-priority role on conflict. */
function highestRoles(layerMaps: Array<Record<string, HighlightRole> | undefined>): Map<string, HighlightRole> {
  const map = new Map<string, HighlightRole>();
  for (const layer of layerMaps) {
    if (!layer) continue;
    for (const [id, role] of Object.entries(layer)) {
      const existing = map.get(id);
      if (existing === undefined || rolePriority(String(role)) >= rolePriority(String(existing))) {
        map.set(id, role);
      }
    }
  }
  return map;
}

const nodeRoles = (overlays: GraphOverlays) => highestRoles(overlays.highlights.map((l) => l.nodes));
const edgeRoles = (overlays: GraphOverlays) => highestRoles(overlays.highlights.map((l) => l.edges));

/** Is any overlay active (any node OR edge role present)? Drives focus-mode dimming consistently. */
function isFocusActive(overlays: GraphOverlays): boolean {
  return nodeRoles(overlays).size > 0 || edgeRoles(overlays).size > 0;
}

/** Build a node styler from overlays. Returns `(nodeId) => style` for use as a sigma node reducer. */
export function nodeOverlayStyle(
  overlays: GraphOverlays,
  options: OverlayStyleOptions = {},
): (nodeId: string) => OverlayNodeStyle {
  const roles = nodeRoles(overlays);
  const active = isFocusActive(overlays);
  const colors = { ...DEFAULT_ROLE_COLORS, ...options.roleColors };
  const palette = options.componentPalette ?? DEFAULT_PALETTE;
  const dim = options.dimUnhighlighted ?? true;
  const dimColor = options.dimColor ?? DEFAULT_DIM;
  const unknown = options.unknownColor ?? DEFAULT_UNKNOWN;

  return (nodeId) => {
    const role = roles.get(nodeId);
    if (role !== undefined) {
      const isDimmedRole = String(role) === 'dimmed';
      return {
        color: colorForRole(role, colors, palette, unknown),
        highlighted: !isDimmedRole, // a 'dimmed' role is not a highlight
        zIndex: isDimmedRole ? 0 : 1,
      };
    }
    if (active && dim) return { color: dimColor, zIndex: 0 };
    return {};
  };
}

/** Build an edge styler from overlays. Returns `(edgeId) => style` for use as a sigma edge reducer. */
export function edgeOverlayStyle(
  overlays: GraphOverlays,
  options: OverlayStyleOptions = {},
): (edgeId: string) => OverlayEdgeStyle {
  const roles = edgeRoles(overlays);
  const active = isFocusActive(overlays); // shared with nodes — a node-only overlay still dims edges
  const colors = { ...DEFAULT_ROLE_COLORS, ...options.roleColors };
  const palette = options.componentPalette ?? DEFAULT_PALETTE;
  const dim = options.dimUnhighlighted ?? true;
  const dimColor = options.dimColor ?? DEFAULT_DIM;
  const unknown = options.unknownColor ?? DEFAULT_UNKNOWN;

  return (edgeId) => {
    const role = roles.get(edgeId);
    if (role !== undefined) return { color: colorForRole(role, colors, palette, unknown), zIndex: 1 };
    if (active && dim) return { color: dimColor, zIndex: 0 };
    return {};
  };
}
