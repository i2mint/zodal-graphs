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
 * warns if the container has zero size at construction.
 */

import Sigma from 'sigma';
import { useEffect, useRef, type ReactElement } from 'react';
import type { CanonicalGraph, GraphOverlays } from '@zodal/graph-core';
import { toGraphology } from '@zodal/graph-core/graphology';
import { edgeOverlayStyle, nodeOverlayStyle, type OverlayStyleOptions } from './overlay-style.js';

export interface SigmaViewProps {
  graph: CanonicalGraph;
  overlays?: GraphOverlays;
  styleOptions?: OverlayStyleOptions;
}

export function SigmaView({ graph, overlays, styleOptions }: SigmaViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);

  // Create the Sigma instance ONCE per graph — overlay changes must not reset the camera.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
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
      g.mergeNodeAttributes(node, {
        x: position?.x ?? Math.cos(angle),
        y: position?.y ?? Math.sin(angle),
        size: (attrs.size as number | undefined) ?? 6,
        label: (attrs.label as string | undefined) ?? node,
      });
      i += 1;
    });

    const renderer = new Sigma(g, container);
    sigmaRef.current = renderer;
    return () => {
      renderer.kill();
      sigmaRef.current = null;
    };
  }, [graph]);

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

  return <div className="zodal-sigma-view" ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
