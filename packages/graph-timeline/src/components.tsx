/**
 * The React timeline — interval-tier lanes with labels, a time axis, and an interactive visx brush.
 *
 * Tiers become labelled horizontal lanes (`scaleBand`); annotations become time-positioned rects
 * (`scaleLinear`); `@visx/axis` draws the time axis and `@visx/brush` provides a draggable window
 * selection that reports back as a rational-time {@link Interval} via `onWindowChange`.
 *
 * The brush rectangle and the controlled `window` prop are INDEPENDENT visuals: `window` is a
 * read-only highlight (intersecting annotations get `--in-window`); the brush keeps its own internal
 * selection and only *reports* via `onWindowChange`. Setting `window` does not move the brush. Also
 * note visx pads a brushed window by ~2px-of-data on each edge (its deliberate "tolerant delta"), so
 * the reported {@link Interval} is slightly wider than the literal pixels dragged. Presentational +
 * themeable via class names.
 *
 * Linked views: give it the shared `view` store (`@zodal/graph-ui`'s `createGraphViewStore`) and the
 * brush writes a `brushFilter` for the brushed window under the `'timeline'` owner (clearing the
 * brush removes it; removing the filter elsewhere clears the brush), so every other lens fades or
 * hides what falls outside the window. The timeline in turn draws the shared state: selected
 * annotations are outlined, hovered ones marked, and what OTHER owners' filters drop is dimmed or
 * left out (its own window is shown by the brush, crossfilter style, not by dimming itself).
 */

import { AxisBottom } from '@visx/axis';
import { Brush } from '@visx/brush';
import type { Bounds } from '@visx/brush';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { useEffect, useMemo, useRef, type ComponentProps, type ReactElement } from 'react';
import type { CanonicalGraph } from '@zodal/graph-core';
import type { GraphViewStore } from '@zodal/graph-ui';
import { useLinkedView } from '@zodal/graph-ui/react';
import { brushFilter, type BrushFilterOptions } from './brush.js';
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
/** visx's brush instance (its `reset()` clears the drawn window); the class is not exported by name. */
type BrushHandle = NonNullable<NonNullable<ComponentProps<typeof Brush>['innerRef']>['current']>;

/** The filter owner a brushed window is written under, by default. */
export const TIMELINE_FILTER_OWNER = 'timeline';
/** Opacity of an annotation other owners' fade filters drop. */
const DIMMED_OPACITY = 0.3;

/**
 * Convert a visx brush {@link Bounds} (already in the xScale data domain, and SAFE_PIXEL-padded by
 * visx) to a rational-time window; `null` for a cleared/empty brush. Exported so the conversion is
 * unit-testable without a layout engine (happy-dom can't drag the brush).
 */
export function boundsToWindow(bounds: Bounds | null): Interval | null {
  if (!bounds) return null;
  // visx's getDomainFromExtent already returns x0=min, x1=max; min/max here is cheap insurance.
  return interval(Math.min(bounds.x0, bounds.x1), Math.max(bounds.x0, bounds.x1));
}

export interface TimelineViewProps {
  graph: CanonicalGraph;
  /** Read-only highlight window — intersecting annotations are marked `--in-window` (independent of the brush). */
  window?: Interval;
  /** Fired when the user brushes a time window (null when cleared). The window is visx-padded (~2px). */
  onWindowChange?: (window: Interval | null) => void;
  width?: number;
  height?: number;
  /** Lane-label gutter (left) + axis (bottom) live in the margin. */
  margin?: TimelineMargin;
  /** The shared view store (linked views): the brush sets `brushFilter(model, window)` as the
   *  `filterOwner`'s filter, and the shared selection, hover and other owners' filters are drawn. */
  view?: GraphViewStore;
  /** The owner the brush filter is written under. Default `'timeline'`. */
  filterOwner?: string;
  /** How a brushed window becomes a filter (Allen relations, untimed nodes, fade/hide). Pass a
   *  memoised object. */
  brushOptions?: BrushFilterOptions;
}

export function TimelineView({
  graph,
  window,
  onWindowChange,
  width = 800,
  height = 300,
  margin = DEFAULT_MARGIN,
  view,
  filterOwner = TIMELINE_FILTER_OWNER,
  brushOptions,
}: TimelineViewProps): ReactElement {
  const model = useMemo(() => toTimeline(graph), [graph]);
  const linkedOptions = useMemo(() => ({ excludeOwners: [filterOwner] }), [filterOwner]);
  const linked = useLinkedView(graph, view, linkedOptions);

  // Clear the brush when the window's filter is removed by someone else (another lens, a "clear
  // filters" button) — but not when this brush cleared it, which would reset a drag in progress.
  const brushRef = useRef<BrushHandle | null>(null);
  const clearedByBrush = useRef(false);
  const hasOwnFilter = linked ? filterOwner in linked.state.filters : false;
  const hadOwnFilter = useRef(hasOwnFilter);
  useEffect(() => {
    if (hadOwnFilter.current && !hasOwnFilter && !clearedByBrush.current) brushRef.current?.reset();
    hadOwnFilter.current = hasOwnFilter;
    clearedByBrush.current = false;
  }, [hasOwnFilter]);
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const xScale = useMemo(() => {
    const extent = timelineExtent(model);
    // toNumber is intentionally lossy (v/r → float): this drives PIXELS only; intersection math stays rational.
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

  const handleBrush =
    onWindowChange || view
      ? (bounds: Bounds | null) => {
          const brushed = boundsToWindow(bounds);
          onWindowChange?.(brushed);
          if (view) {
            clearedByBrush.current = brushed === null;
            view.setFilter(filterOwner, brushed ? brushFilter(model, brushed, brushOptions) : null);
          }
        }
      : undefined;
  const selected = linked ? new Set(linked.state.selection.nodes) : undefined;
  const hovered = linked?.state.hovered?.kind === 'node' ? linked.state.hovered.id : undefined;

  if (model.tiers.length === 0) {
    return <div className="zodal-timeline zodal-timeline--empty">No annotated intervals to show.</div>;
  }

  return (
    <svg
      className="zodal-timeline"
      width={width}
      height={height}
      role="img"
      aria-label={`timeline, ${model.tiers.length} tiers, ${model.annotations.length} intervals`}
    >
      <title>{`Interval timeline — ${model.tiers.length} tiers, ${model.annotations.length} annotations`}</title>

      {/* Tier labels in the left gutter (own Group so they share the rects' vertical origin) */}
      <Group top={margin.top}>
        {model.tiers.map((tier) => (
          <text
            key={tier.id}
            className="zodal-timeline__tier-label"
            x={8}
            y={(yScale(tier.id) ?? 0) + laneHeight / 2}
            dominantBaseline="middle"
            fontSize={12}
          >
            {tier.id}
          </text>
        ))}
      </Group>

      <Group left={margin.left} top={margin.top}>
        {model.annotations.map((a) => {
          const y = yScale(a.tier);
          if (y === undefined) return null; // annotation on a tier not in the band domain — skip, don't stack on lane 0
          const x = xScale(toNumber(a.interval.start));
          const w = Math.max(1, xScale(toNumber(a.interval.end)) - x);
          if (linked?.hidden.nodes.has(a.id)) return null; // another owner hides it
          const inWindow = window ? intersects(a.interval, window) : false;
          const isSelected = selected?.has(a.id) ?? false;
          // Selection outranks dimming, as in the node-link overlays.
          const dimmed = linked?.kept !== undefined && !linked.kept.nodes.has(a.id) && !isSelected;
          const isHovered = hovered === a.id;
          return (
            <rect
              key={a.id}
              className={[
                inWindow ? 'zodal-timeline__annotation--in-window' : 'zodal-timeline__annotation',
                isSelected && 'zodal-timeline__annotation--selected',
                dimmed && 'zodal-timeline__annotation--dimmed',
                isHovered && 'zodal-timeline__annotation--hovered',
              ]
                .filter(Boolean)
                .join(' ')}
              data-id={a.id}
              opacity={dimmed ? DIMMED_OPACITY : undefined}
              stroke={isSelected || isHovered ? 'currentColor' : undefined}
              strokeWidth={isSelected ? 2 : isHovered ? 1 : undefined}
              x={x}
              y={y}
              width={w}
              height={laneHeight}
              rx={2}
            >
              <title>{`${a.tier}: [${toNumber(a.interval.start)}, ${toNumber(a.interval.end)})`}</title>
            </rect>
          );
        })}

        <AxisBottom top={innerHeight} scale={xScale} numTicks={6} />

        {handleBrush ? (
          <Brush
            xScale={xScale}
            yScale={yScale}
            width={Math.max(1, innerWidth)}
            height={Math.max(1, innerHeight)}
            brushDirection="horizontal"
            onChange={handleBrush}
            innerRef={brushRef}
          />
        ) : null}
      </Group>
    </svg>
  );
}
