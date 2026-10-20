/**
 * The thin React shell — renders a canonical graph as a sigma WebGL canvas and applies overlays.
 *
 * Minimal this checkpoint, but it does NOT thrash the renderer: the Sigma instance is created once
 * per `graph` (preserving camera zoom/pan across overlay changes); overlay/style changes update the
 * reducers live via `setSetting` + `refresh()`. It loads the graph via `@zodal/graph-core`'s
 * graphology hub (the same structure `@zodal/graph-compute` runs on) and seeds default coordinates
 * (a real layout pass — ForceAtlas2 / noverlap — is deferred).
 *
 * Give the view a parent with a definite height (sigma renders into its parent's box); the component
 * warns if the container has zero size at construction. An empty graph shows an empty state (no Sigma
 * init); when Sigma fails to initialise (e.g. a browser/container with no usable WebGL context) it
 * degrades to an error overlay rather than throwing. (This is a client-only component — `sigma`
 * references WebGL globals at import, so don't import it in a non-DOM server runtime.)
 *
 * Linked views: give it the shared `view` store (`@zodal/graph-ui`'s `createGraphViewStore`) and it
 * draws `linkedOverlays` (on top of any `overlays` passed), leaves out what a `'hide'` filter removes,
 * and writes back: a click on a node or edge selects it (shift-click toggles it), a click on the
 * empty stage clears the selection, and hovering a node or edge sets the shared hover.
 */

import Sigma from 'sigma';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import type { CanonicalGraph, GraphOverlays } from '@zodal/graph-core';
import type { GraphViewStore } from '@zodal/graph-ui';
import { useLinkedView } from '@zodal/graph-ui/react';
import { toGraphology } from '@zodal/graph-core/graphology';
import { edgeOverlayStyle, nodeOverlayStyle, type OverlayStyleOptions } from './overlay-style.js';
import { resolveNodeRenderStyle } from './node-style.js';

export interface SigmaViewProps {
  graph: CanonicalGraph;
  overlays?: GraphOverlays;
  styleOptions?: OverlayStyleOptions;
  /** The shared view store (linked views): draw its state and write clicks/hover back to it. */
  view?: GraphViewStore;
}

/** A sigma pointer event's original DOM event: shift marks an additive (toggle) pick. */
const isAdditive = (payload: { event: { original: MouseEvent | TouchEvent } }): boolean => payload.event.original.shiftKey;

export function SigmaView({ graph, overlays, styleOptions, view }: SigmaViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  // Bumped when an instance is created, so the effects below re-apply to the NEW instance.
  const [instance, setInstance] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = graph.nodes.length === 0;
  const linked = useLinkedView(graph, view);
  // The host's overlays first, the shared state's on top (roles resolve by priority, not order).
  const drawn = useMemo<GraphOverlays | undefined>(() => {
    if (!linked || linked.overlays.highlights.length === 0) return overlays;
    if (!overlays) return linked.overlays;
    return { highlights: [...overlays.highlights, ...linked.overlays.highlights] };
  }, [overlays, linked]);
  const hidden = linked?.hidden;

  // Create the Sigma instance ONCE per graph — overlay changes must not reset the camera.
  useEffect(() => {
    setError(null);
    const container = containerRef.current;
    if (!container || isEmpty) return; // nothing to render (no DOM target / empty graph)
    if (container.clientWidth === 0 || container.clientHeight === 0) {
      console.warn('SigmaView: the container has zero size — give it a parent with a definite height.');
    }

    const g = toGraphology(graph);
    // sigma needs coordinates + size; seed a default circle from node.position (real layout deferred).
    const total = Math.max(g.order, 1);
    let i = 0;
    g.forEachNode((node, attrs: Record<string, unknown>) => {
      const position = attrs.position as { x: number; y: number } | undefined;
      const angle = (2 * Math.PI * i) / total;
      // size/label/color resolve from the top-level attr or attrs.data (data-driven styling).
      const style = resolveNodeRenderStyle(attrs, node);
      g.mergeNodeAttributes(node, {
        x: position?.x ?? Math.cos(angle),
        y: position?.y ?? Math.sin(angle),
        size: style.size,
        label: style.label,
        ...(style.color ? { color: style.color } : {}),
      });
      i += 1;
    });

    let renderer: Sigma;
    try {
      // Throws when WebGL CONTEXT creation fails (headless browser / happy-dom — getContext yields
      // null). NB: a true non-DOM runtime throws earlier, at sigma's import (see the module docstring).
      renderer = new Sigma(g, container);
    } catch (cause) {
      // Normalize sigma's internal error (often a null-deref) into a stable, user-facing message —
      // never leak an internal stack string. The raw cause is logged for debugging.
      console.warn('SigmaView: Sigma failed to initialise:', cause);
      setError('WebGL is unavailable in this environment.');
      return;
    }
    sigmaRef.current = renderer;
    setInstance((n) => n + 1);
    return () => {
      renderer.kill();
      sigmaRef.current = null;
    };
  }, [graph, isEmpty]);

  // Pointer → shared state. Re-wired when the store or the instance changes, never rebuilding sigma.
  useEffect(() => {
    const renderer = sigmaRef.current;
    if (!renderer || !view) return;
    renderer.setSetting('enableEdgeEvents', true);
    const handlers = {
      clickNode: (p: { node: string; event: { original: MouseEvent | TouchEvent } }) =>
        view.pick({ kind: 'node', id: p.node }, isAdditive(p)),
      clickEdge: (p: { edge: string; event: { original: MouseEvent | TouchEvent } }) =>
        view.pick({ kind: 'edge', id: p.edge }, isAdditive(p)),
      clickStage: () => view.clearSelection(),
      enterNode: (p: { node: string }) => view.setHovered({ kind: 'node', id: p.node }),
      leaveNode: () => view.setHovered(null),
      enterEdge: (p: { edge: string }) => view.setHovered({ kind: 'edge', id: p.edge }),
      leaveEdge: () => view.setHovered(null),
    };
    for (const [event, handler] of Object.entries(handlers)) renderer.on(event as never, handler as never);
    return () => {
      for (const [event, handler] of Object.entries(handlers)) renderer.off(event as never, handler as never);
      // On unmount or a new graph the instance is already killed (its effect cleans up first):
      // a setting change would re-render a torn-down renderer.
      if (sigmaRef.current === renderer) renderer.setSetting('enableEdgeEvents', false);
    };
  }, [view, instance]);

  // Apply overlays/styling on the EXISTING instance (no rebuild → camera preserved). NB: pass
  // referentially-stable `overlays`/`styleOptions` (memoize them) — a new identity each render
  // re-runs setSetting+refresh; a mutated-in-place object won't re-run at all.
  // With `view`, the shared state changes these on every selection/hover/filter change.
  useEffect(() => {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    const styleNode = drawn ? nodeOverlayStyle(drawn, styleOptions) : undefined;
    const styleEdge = drawn ? edgeOverlayStyle(drawn, styleOptions) : undefined;
    const hideNodes = hidden && hidden.nodes.size > 0 ? hidden.nodes : undefined;
    const hideEdges = hidden && hidden.edges.size > 0 ? hidden.edges : undefined;
    renderer.setSetting(
      'nodeReducer',
      styleNode || hideNodes
        ? (node, data) => ({ ...data, ...styleNode?.(node), ...(hideNodes?.has(node) ? { hidden: true } : {}) })
        : null,
    );
    renderer.setSetting(
      'edgeReducer',
      styleEdge || hideEdges
        ? (edge, data) => ({ ...data, ...styleEdge?.(edge), ...(hideEdges?.has(edge) ? { hidden: true } : {}) })
        : null,
    );
    renderer.refresh();
  }, [drawn, hidden, styleOptions, instance]);

  return (
    <div className="zodal-sigma-view" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {isEmpty ? <div className="zodal-sigma-view--empty">Empty graph.</div> : null}
      {error && !isEmpty ? <div className="zodal-sigma-view--error">Cannot render: {error}</div> : null}
    </div>
  );
}
