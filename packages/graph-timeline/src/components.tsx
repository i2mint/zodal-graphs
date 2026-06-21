/**
 * The React timeline — interval-tier lanes with labels, a time axis, and an interactive visx brush.
 *
 * Tiers become labelled horizontal lanes (`scaleBand`); annotations become time-positioned rects
 * (`scaleLinear`); `@visx/axis` draws the time axis and `@visx/brush` provides a draggable window
 * selection that reports back as a rational-time {@link Interval} via `onWindowChange`. The optional
 * controlled `window` highlights intersecting annotations. Presentational + themeable via class names.
 */

import { AxisBottom } from '@visx/axis';
import { Brush } from '@visx/brush';
import type { Bounds } from '@visx/brush';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useMemo, type ReactElement } from 'react';
import type { CanonicalGraph } from '@zodal/graph-core';
import { intersects, interval, type Interval } from './interval.js';
import { toNumber } from './time.js';
import { toTimeline, timelineExtent } from './timeline.js';

export interface TimelineMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const DEFAULT_MARGIN: TimelineMargin = { top: 8, right: 12, bottom: 28, left: 120 };

export interface TimelineViewProps {
  graph: CanonicalGraph;
  /** Controlled brushed window — annotations intersecting it are marked `--in-window`. */
  window?: Interval;
  /** Fired when the user brushes a time window (null when the brush is cleared). */
  onWindowChange?: (window: Interval | null) => void;
  width?: number;
  height?: number;
  /** Lane-label gutter (left) + axis (bottom) live in the margin. */
  margin?: TimelineMargin;
}

export function TimelineView({
  graph,
  window,
  onWindowChange,
  width = 800,
  height = 300,
  margin = DEFAULT_MARGIN,
}: TimelineViewProps): ReactElement {
  const model = useMemo(() => toTimeline(graph), [graph]);
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const xScale = useMemo(() => {
    const extent = timelineExtent(model);
    const lo = extent ? toNumber(extent.start) : 0;
    const hi = extent ? toNumber(extent.end) : 1;
    // Pad a zero-width extent so single-instant timelines don't collapse onto a sliver.
    const domain: [number, number] = lo === hi ? [lo - 0.5, hi + 0.5] : [lo, hi];
    return scaleLinear<number>({ domain, range: [0, innerWidth] });
  }, [model, innerWidth]);

  const yScale = useMemo(
    () => scaleBand<string>({ domain: model.tiers.map((t) => t.id), range: [0, innerHeight], padding: 0.2 }),
    [model.tiers, innerHeight],
  );
  const laneHeight = yScale.bandwidth();

  const handleBrush = (bounds: Bounds | null): void => {
    if (!onWindowChange) return;
    if (!bounds) return onWindowChange(null);
    const lo = Math.min(bounds.x0, bounds.x1);
    const hi = Math.max(bounds.x0, bounds.x1);
    onWindowChange(interval(lo, hi));
  };

  if (model.tiers.length === 0) {
    return <div className="zodal-timeline zodal-timeline--empty">No annotated intervals to show.</div>;
  }

  return (
    <svg className="zodal-timeline" width={width} height={height}>
      {/* Tier labels in the left gutter */}
      {model.tiers.map((tier) => {
        const y = (yScale(tier.id) ?? 0) + margin.top;
        return (
          <text
            key={tier.id}
            className="zodal-timeline__tier-label"
            x={8}
            y={y + laneHeight / 2}
            dominantBaseline="middle"
            fontSize={12}
          >
            {tier.id}
          </text>
        );
      })}

      <Group left={margin.left} top={margin.top}>
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

        <AxisBottom top={innerHeight} scale={xScale} numTicks={6} />

        {onWindowChange ? (
          <Brush
            xScale={xScale}
            yScale={yScale}
            width={Math.max(1, innerWidth)}
            height={Math.max(1, innerHeight)}
            brushDirection="horizontal"
            onChange={handleBrush}
            onClick={() => onWindowChange(null)}
          />
        ) : null}
      </Group>
    </svg>
  );
}
