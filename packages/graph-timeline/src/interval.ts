/**
 * Half-open intervals `[start, end)` over rational time, and Allen's 13 interval relations.
 *
 * No JS/TS library implements Allen's 13 relations natively, so this is the hand-written glue the
 * research calls for. Intervals are half-open: `start <= end`, and `start === end` is a zero-measure
 * INSTANT conceptually at `start`. `allen(a, b)` returns the single relation between two intervals
 * (endpoint algebra, correct for proper intervals); `intersects` and `relate` are the unambiguous
 * query helpers a brushing timeline actually uses (and they handle instants correctly).
 */

import type { RationalTime, TimeInput } from './time.js';
import { compareTime, timeLt, timeLte, toRational } from './time.js';

export interface Interval {
  start: RationalTime;
  end: RationalTime;
}

/** The 13 Allen relations (a relates to b). Inverses are paired (precedes/preceded-by, …). */
export type AllenRelation =
  | 'precedes'
  | 'meets'
  | 'overlaps'
  | 'finished-by'
  | 'contains'
  | 'starts'
  | 'equals'
  | 'started-by'
  | 'during'
  | 'finishes'
  | 'overlapped-by'
  | 'met-by'
  | 'preceded-by';

/** Construct a half-open interval; throws if `end < start`. */
export function interval(start: TimeInput, end: TimeInput): Interval {
  const s = toRational(start);
  const e = toRational(end);
  if (compareTime(e, s) < 0) {
    throw new Error('graph-timeline: interval end must be >= start (half-open [start, end))');
  }
  return { start: s, end: e };
}

/** A zero-measure interval (`start === end`) — an instant. */
export function isInstant(i: Interval): boolean {
  return compareTime(i.start, i.end) === 0;
}

const INVERSE: Record<AllenRelation, AllenRelation> = {
  precedes: 'preceded-by',
  meets: 'met-by',
  overlaps: 'overlapped-by',
  'finished-by': 'finishes',
  contains: 'during',
  starts: 'started-by',
  equals: 'equals',
  'started-by': 'starts',
  during: 'contains',
  finishes: 'finished-by',
  'overlapped-by': 'overlaps',
  'met-by': 'meets',
  'preceded-by': 'precedes',
};

/** The converse relation: `allen(a, b) === inverse(allen(b, a))`. */
export function inverse(relation: AllenRelation): AllenRelation {
  return INVERSE[relation];
}

/**
 * The single Allen relation of `a` to `b`. Endpoint algebra — correct and exhaustive for proper
 * intervals. For instants the result follows the endpoint rules (e.g. an instant exactly at `b.end`
 * of a half-open `b` reads as `met-by`); use {@link intersects} for the "is it in the window" query.
 */
export function allen(a: Interval, b: Interval): AllenRelation {
  const aEndVsBStart = compareTime(a.end, b.start);
  if (aEndVsBStart < 0) return 'precedes';
  if (aEndVsBStart === 0) return 'meets';
  const aStartVsBEnd = compareTime(a.start, b.end);
  if (aStartVsBEnd > 0) return 'preceded-by';
  if (aStartVsBEnd === 0) return 'met-by';

  // The intervals genuinely overlap; classify by their start and end comparisons.
  const ss = compareTime(a.start, b.start);
  const ee = compareTime(a.end, b.end);
  if (ss < 0) return ee < 0 ? 'overlaps' : ee === 0 ? 'finished-by' : 'contains';
  if (ss === 0) return ee < 0 ? 'starts' : ee === 0 ? 'equals' : 'started-by';
  return ee < 0 ? 'during' : ee === 0 ? 'finishes' : 'overlapped-by';
}

/** Does `a` relate to `b` by any of `relations`? */
export function relate(a: Interval, b: Interval, relations: readonly AllenRelation[]): boolean {
  return relations.includes(allen(a, b));
}

/**
 * Do `a` and `b` share any time? Unambiguous (unlike `allen` boundary cases) and instant-correct:
 * an instant at `t` intersects `[s, e)` iff `s <= t < e`.
 */
export function intersects(a: Interval, b: Interval): boolean {
  if (isInstant(a)) return timeLte(b.start, a.start) && timeLt(a.start, b.end);
  if (isInstant(b)) return timeLte(a.start, b.start) && timeLt(b.start, a.end);
  return timeLt(a.start, b.end) && timeLt(b.start, a.end);
}

/** Relations that mean "a is within b" (used by tier containment checks). */
export const WITHIN: readonly AllenRelation[] = ['during', 'starts', 'finishes', 'equals'];

/** Relations that mean "a and b are disjoint" (don't share time). */
export const DISJOINT: readonly AllenRelation[] = ['precedes', 'meets', 'preceded-by', 'met-by'];
