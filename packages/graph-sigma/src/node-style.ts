/**
 * Resolve a node's sigma render style (size / label / color) from its graphology attributes.
 *
 * `@zodal/graph-core`'s adapter nests a node's domain fields under `attrs.data`, so a renderer that
 * only reads top-level attributes can't style by data. This resolves each visual channel from the
 * top-level attribute first, then falls back to the same key inside `attrs.data` — letting a
 * consumer drive color/size/label from data (e.g. by type or centrality). Pure and dependency-free
 * so it is unit-testable without a WebGL context.
 */

export interface NodeRenderStyle {
  size: number;
  label: string;
  color?: string;
}

export const DEFAULT_NODE_SIZE = 6;

export function resolveNodeRenderStyle(
  attrs: Record<string, unknown>,
  id: string,
): NodeRenderStyle {
  const data = (attrs.data ?? {}) as Record<string, unknown>;
  const pick = (key: string): unknown => (attrs[key] !== undefined ? attrs[key] : data[key]);
  const size = pick('size');
  const label = pick('label');
  const color = pick('color');
  return {
    size: typeof size === 'number' ? size : DEFAULT_NODE_SIZE,
    label: typeof label === 'string' && label ? label : id,
    color: typeof color === 'string' ? color : undefined,
  };
}
