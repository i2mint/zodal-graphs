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
 */

import Sigma from 'sigma';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { CanonicalGraph, GraphOverlays } from '@zodal/graph-core';
import { toGraphology } from '@zodal/graph-core/graphology';
import { edgeOverlayStyle, nodeOverlayStyle, type OverlayStyleOptions } from './overlay-style.js';
import { resolveNodeRenderStyle } from './node-style.js';

export interface SigmaViewProps {
  graph: CanonicalGraph;
  overlays?: GraphOverlays;
  styleOptions?: OverlayStyleOptions;
}

export function SigmaView({ graph, overlays, styleOptions }: SigmaViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isEmpty = graph.nodes.length === 0;

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
      renderer = new Sigma(g, container); // throws where WebGL is unavailable (SSR, jsdom/happy-dom, headless)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Sigma could not initialise (WebGL unavailable).');
      return;
    }
    sigmaRef.current = renderer;
    return () => {
      renderer.kill();
      sigmaRef.current = null;
    };
  }, [graph, isEmpty]);

  // Apply overlays/styling on the EXISTING instance (no rebuild → camera preserved).
  useEffect(() => {
    const renderer = sigmaRef.current;
    if (!renderer) return;
    const styleNode = overlays ? nodeOverlayStyle(overlays, styleOptions) : undefined;
    const styleEdge = overlays ? edgeOverlayStyle(overlays, styleOptions) : undefined;
    renderer.setSetting('nodeReducer', styleNode ? (node, data) => ({ ...data, ...styleNode(node) }) : null);
    renderer.setSetting('edgeReducer', styleEdge ? (edge, data) => ({ ...data, ...styleEdge(edge) }) : null);
    renderer.refresh();
  }, [overlays, styleOptions]);

  return (
    <div className="zodal-sigma-view" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {isEmpty ? <div className="zodal-sigma-view--empty">Empty graph.</div> : null}
      {error && !isEmpty ? <div className="zodal-sigma-view--error">Cannot render: {error}</div> : null}
    </div>
  );
}
