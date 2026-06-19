/**
 * The thin React shell — renders the timeline model as interval-tier lanes (visx scales + SVG).
 *
 * Minimal this checkpoint: tiers become horizontal lanes (`scaleBand`), annotations become rects
 * positioned by time (`scaleLinear`), with an optional brushed window highlighted. Real brushing
 * interaction (`@visx/brush`), tier labels, zoom, and the rational-time axis are deferred — the
 * tested substance is the headless interval / Allen / tier model. Give the SVG a parent with size.
 */

import { scaleBand, scaleLinear } from '@visx/scale';
import type { ReactElement } from 'react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { intersects, type Interval } from './interval.js';
import { toNumber } from './time.js';
import { toTimeline, timelineExtent } from './timeline.js';

export interface TimelineViewProps {
  graph: CanonicalGraph;
  /** Optional brushed window — annotations intersecting it are marked. */
  window?: Interval;
  width?: number;
  height?: number;
}

export function TimelineView({ graph, window, width = 800, height = 300 }: TimelineViewProps): ReactElement {
  const model = toTimeline(graph);
  const extent = timelineExtent(model);

  // Pad a zero-width extent (all annotations at one instant) so they don't collapse onto a 1px sliver.
  const lo = extent ? toNumber(extent.start) : 0;
  const hi = extent ? toNumber(extent.end) : 1;
  const domain: [number, number] = lo === hi ? [lo - 0.5, hi + 0.5] : [lo, hi];

  const xScale = scaleLinear<number>({ domain, range: [0, width] });
  const yScale = scaleBand<string>({
    domain: model.tiers.map((t) => t.id),
    range: [0, height],
    padding: 0.2,
  });
  const laneHeight = yScale.bandwidth();

  return (
    <svg className="zodal-timeline" width={width} height={height}>
      {model.annotations.map((a) => {
        const x = xScale(toNumber(a.interval.start));
        const w = Math.max(1, xScale(toNumber(a.interval.end)) - x);
        const y = yScale(a.tier) ?? 0;
        const inWindow = window ? intersects(a.interval, window) : false;
        return (
          <rect
            key={a.id}
            className={inWindow ? 'zodal-timeline__annotation--in-window' : 'zodal-timeline__annotation'}
            x={x}
            y={y}
            width={w}
            height={laneHeight}
            rx={2}
          />
        );
      })}
    </svg>
  );
}
