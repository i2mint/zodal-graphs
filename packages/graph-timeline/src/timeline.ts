/**
 * Timeline data shaping — turn a canonical graph of interval-bearing nodes (lacing-style
 * annotations) into a `TimelineModel` of tiers + annotations, plus the window / Allen-relation
 * queries a brushing timeline runs.
 *
 * Convention: a node is an annotation when its `data` carries `{ tier, start, end }` (optionally
 * `value`, `stereotype`, `parentTier`). `start`/`end` are a number or `{ v, r }` rational time.
 * Nodes without that shape are skipped — a timeline shows the interval-bearing subset of a graph.
 *
 * A tier's `stereotype`/`parentTier` are taken from the FIRST interval-bearing node seen for that
 * tier (graph node order); later nodes that disagree are ignored. Keep a tier's metadata consistent
 * across its annotations.
 */

import type { CanonicalGraph } from '@zodal/graph-core';
import type { AllenRelation, Interval } from './interval.js';
import { allen, interval, intersects } from './interval.js';
import { type RationalTime, type TimeInput, maxTime, minTime } from './time.js';
import { TIER_STEREOTYPES, type Annotation, type Tier, type TierStereotype } from './tiers.js';

export interface TimelineModel {
  tiers: Tier[];
  annotations: Annotation[];
}

interface AnnotationData {
  tier?: unknown;
  start?: unknown;
  end?: unknown;
  value?: unknown;
  stereotype?: unknown;
  parentTier?: unknown;
}

/** Build a timeline model from a canonical graph's interval-bearing nodes. */
export function toTimeline(graph: CanonicalGraph): TimelineModel {
  const annotations: Annotation[] = [];
  const tierMeta = new Map<string, { stereotype: TierStereotype; parent?: string }>();

  for (const node of graph.nodes) {
    const data = (node.data ?? {}) as AnnotationData;
    if (data.tier == null || data.start == null || data.end == null) continue;
    const tier = String(data.tier);
    annotations.push({
      id: node.id,
      tier,
      interval: interval(asTime(data.start), asTime(data.end)),
      value: data.value,
    });
    if (!tierMeta.has(tier)) {
      tierMeta.set(tier, {
        stereotype: asStereotype(data.stereotype),
        parent: data.parentTier != null ? String(data.parentTier) : undefined,
      });
    }
  }

  const tiers: Tier[] = [...tierMeta].map(([id, meta]) => ({ id, stereotype: meta.stereotype, parent: meta.parent }));
  return { tiers, annotations };
}

/** Annotations overlapping a time window (brushing). */
export function annotationsInWindow(model: TimelineModel, window: Interval): Annotation[] {
  return model.annotations.filter((a) => intersects(a.interval, window));
}

/** Annotations that relate to `target` by one of `relations` (Allen-relation query). */
export function annotationsRelated(
  model: TimelineModel,
  target: Interval,
  relations: readonly AllenRelation[],
): Annotation[] {
  return model.annotations.filter((a) => relations.includes(allen(a.interval, target)));
}

/** The full time extent (min start, max end) of the model, or null if empty. */
export function timelineExtent(model: TimelineModel): Interval | null {
  if (model.annotations.length === 0) return null;
  let start = model.annotations[0].interval.start;
  let end = model.annotations[0].interval.end;
  for (const a of model.annotations) {
    start = minTime(start, a.interval.start);
    end = maxTime(end, a.interval.end);
  }
  return { start, end };
}

function asTime(value: unknown): TimeInput {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'v' in value && 'r' in value) return value as RationalTime;
  throw new Error('graph-timeline: annotation start/end must be a number or { v, r } rational time');
}

function asStereotype(value: unknown): TierStereotype {
  return TIER_STEREOTYPES.includes(value as TierStereotype) ? (value as TierStereotype) : 'none';
}
