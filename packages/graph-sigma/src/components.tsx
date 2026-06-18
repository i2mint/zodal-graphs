/**
 * The thin React shell — renders a canonical graph as a sigma WebGL canvas and applies overlays.
 *
 * Minimal this checkpoint: it loads the graph via `@zodal/graph-core`'s graphology hub (the same
 * structure `@zodal/graph-compute` runs on), seeds default coordinates (a real layout pass —
 * ForceAtlas2 / noverlap — is deferred), and wires the overlay stylers into sigma's reducers. Give
 * the view a parent with a definite height.
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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

    const styleNode = overlays ? nodeOverlayStyle(overlays, styleOptions) : undefined;
    const styleEdge = overlays ? edgeOverlayStyle(overlays, styleOptions) : undefined;

    const renderer = new Sigma(g, container, {
      nodeReducer: styleNode ? (node, data) => ({ ...data, ...styleNode(node) }) : undefined,
      edgeReducer: styleEdge ? (edge, data) => ({ ...data, ...styleEdge(edge) }) : undefined,
    });
    return () => renderer.kill();
  }, [graph, overlays, styleOptions]);

  return <div className="zodal-sigma-view" ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
